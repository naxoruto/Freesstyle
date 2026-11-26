// Lanzador de desarrollo Windows. Nunca aplica migraciones ni elimina datos.
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { createRequire } = require('node:module');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'apps/server');
const webDir = path.join(root, 'apps/web');
const checkOnly = process.argv.includes('--check');
const children = new Set();
let stopping = false;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function tcpReady(host, port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1500);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

function command(executable, args, cwd = root) {
  return new Promise(resolve => {
    const child = spawn(executable, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
  });
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log('\nDeteniendo frontend y backend... PostgreSQL queda disponible.');
  const pending = [...children].map(child => {
    if (process.platform === 'win32') {
      return command('taskkill.exe', ['/PID', String(child.pid), '/T', '/F']);
    }
    child.kill('SIGTERM');
    return Promise.resolve();
  });
  Promise.allSettled(pending).then(() => process.exit(code));
}

function service(label, entry, args, cwd, env) {
  const child = spawn(process.execPath, [entry, ...args], { cwd, env, stdio: 'inherit', windowsHide: true });
  children.add(child);
  child.once('error', () => {
    children.delete(child);
    console.error(`No se pudo iniciar ${label}.`);
    stop(1);
  });
  child.once('exit', code => {
    children.delete(child);
    if (!stopping) {
      console.error(`${label} se detuvo (codigo ${code}). Revisa su mensaje anterior.`);
      stop(1);
    }
  });
}

async function waitHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      await response.body?.cancel();
      if (response.ok) return true;
    } catch { /* El servicio puede estar compilando o recuperando salas. */ }
    await delay(1000);
  }
  return false;
}

async function main() {
  console.log('Freestyle Arena - Inicio local\n');
  const serverRequire = createRequire(path.join(serverDir, 'package.json'));
  const webRequire = createRequire(path.join(webDir, 'package.json'));
  let dotenv, prismaEntry, tsxEntry, nextEntry;
  try {
    dotenv = serverRequire('dotenv');
    prismaEntry = serverRequire.resolve('prisma/build/index.js');
    tsxEntry = path.join(path.dirname(serverRequire.resolve('tsx/package.json')), 'dist/cli.mjs');
    nextEntry = webRequire.resolve('next/dist/bin/next');
    if (!existsSync(tsxEntry)) throw new Error();
  } catch {
    throw new Error('Faltan dependencias. Ejecuta pnpm install --frozen-lockfile en la carpeta del proyecto.');
  }

  // Mismo orden que loadEnv.ts. No imprimir configuracion ni credenciales.
  const serverEnv = { ...process.env };
  for (const file of ['apps/server/.env.local', 'apps/server/.env', '.env']) {
    dotenv.config({ path: path.join(root, file), processEnv: serverEnv, quiet: true });
  }
  let database;
  try {
    database = new URL(serverEnv.DATABASE_URL);
    if (!['postgresql:', 'postgres:'].includes(database.protocol)) throw new Error();
  } catch {
    throw new Error('Configura DATABASE_URL en el entorno local del servidor. Consulta docs/ENTORNO_LOCAL.md.');
  }
  const dbPort = Number(database.port || 5432);
  const dbHost = database.hostname;
  if (!await tcpReady(dbHost, dbPort)) {
    if (!checkOnly && ['localhost', '127.0.0.1'].includes(dbHost) && dbPort === 5433) {
      console.log('PostgreSQL no responde. Intentando iniciar el contenedor existente freestyle-db...');
      const started = await command('docker', ['start', 'freestyle-db']);
      if (started) {
        for (let attempt = 0; attempt < 15; attempt++) {
          if (await tcpReady(dbHost, dbPort)) break;
          await delay(1000);
        }
      }
    }
    if (!await tcpReady(dbHost, dbPort)) {
      throw new Error('PostgreSQL no responde. Abre Docker Desktop. Si aun no existe el contenedor local, ejecuta docker compose up -d postgres desde la raiz y vuelve a abrir este lanzador.');
    }
  }

  console.log('Comprobando conexion y migraciones (solo lectura)...');
  // La configuracion Prisma usa el entorno preparado arriba; status no modifica la BD.
  const migrated = await new Promise(resolve => {
    const child = spawn(process.execPath, [prismaEntry, 'migrate', 'status'], {
      cwd: serverDir, env: serverEnv, stdio: 'inherit', windowsHide: true,
    });
    child.once('error', () => resolve(false));
    child.once('exit', code => resolve(code === 0));
  });
  if (!migrated) {
    throw new Error('La base necesita atencion. Revisa el resultado anterior. Si solo hay migraciones pendientes, haz un respaldo y aplica: pnpm --filter @freestyle/server exec prisma migrate deploy. Despues vuelve a abrir este lanzador.');
  }
  if (checkOnly) {
    console.log('Requisitos comprobados. No se iniciaron servicios ni se modifico la base.');
    return;
  }

  const backendPort = Number(serverEnv.WS_PORT) || 3001;
  const webPort = 3002;
  const backendUrl = `http://localhost:${backendPort}`;
  const webUrl = `http://localhost:${webPort}`;
  for (const port of [backendPort, webPort]) {
    if (await tcpReady('127.0.0.1', port)) {
      throw new Error(`El puerto ${port} ya esta ocupado. Si tienes pnpm dev abierto, detenlo con Ctrl+C antes de usar el lanzador.`);
    }
  }
  console.log('\nIniciando backend y frontend. Conserva esta ventana abierta.');
  console.log('Para detener ambos, pulsa Ctrl+C en esta ventana.\n');
  service('Backend', tsxEntry, ['watch', 'src/index.ts'], serverDir, serverEnv);
  service('Frontend', nextEntry, ['dev', '--port', String(webPort)], webDir, {
    ...process.env,
    // El lanzador local conecta REST y Socket.IO al backend que acaba de iniciar.
    SERVER_INTERNAL_URL: `http://127.0.0.1:${backendPort}`,
    NEXT_PUBLIC_WS_URL: backendUrl,
  });
  if (!await waitHttp(`${backendUrl}/api/ready`, 90000)) {
    throw new Error('El backend no pudo quedar listo. Revisa los mensajes de esta ventana.');
  }
  if (!await waitHttp(webUrl, 90000)) {
    throw new Error('El frontend no pudo quedar listo. Revisa los mensajes de esta ventana.');
  }
  console.log(`\nListo. Backend: ${backendUrl} | Pagina: ${webUrl}\n`);
  if (process.platform === 'win32') {
    await command('rundll32.exe', ['url.dll,FileProtocolHandler', webUrl]);
  }
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
process.once('SIGHUP', () => stop());
main().catch(error => {
  console.error(`\n${error.message}`);
  if (children.size) stop(1);
  else process.exitCode = 1;
});
