const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const { io } = require('../apps/web/node_modules/socket.io-client');
const { PrismaClient } = require('../apps/server/node_modules/@prisma/client');
const root = path.resolve(__dirname, '..');
const serverDir = path.join(root, 'apps/server');
const url = 'http://127.0.0.1:3111';
const env = { ...process.env, WS_PORT: '3111', NODE_ENV: 'test', DATABASE_URL: 'postgresql://freestyle_test:freestyle_test_local@127.0.0.1:55433/freestyle_test' };
process.env.DATABASE_URL = env.DATABASE_URL;
const prisma = new PrismaClient();
let child, room;
let databaseStopped = false;
const sockets = [];
function start() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: serverDir, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let error = '';
    const timer = setTimeout(() => reject(new Error('server startup timeout: ' + error.slice(-500))), 10000);
    child.stderr.on('data', data => { error += data; });
    child.stdout.on('data', data => { if (String(data).includes('corriendo en')) { clearTimeout(timer); resolve(); } });
    child.on('exit', code => { if (code !== null) { clearTimeout(timer); reject(new Error('server exited: ' + code + ' ' + error.slice(-500))); } });
  });
}
function stop() { return new Promise(resolve => { if (!child || child.exitCode !== null) return resolve(); child.once('exit', resolve); child.kill(); }); }
function wait(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('timeout waiting for ' + event)); }, 5000);
    const listener = data => { if (!predicate(data)) return; clearTimeout(timer); socket.off(event, listener); resolve(data); };
    socket.on(event, listener);
  });
}
async function connect() {
  const socket = io(url, { transports: ['websocket'], reconnection: false }); sockets.push(socket);
  await wait(socket, 'connect'); return socket;
}
async function join(socket, user, token) {
  const session = wait(socket, 'battle:session'); const joined = wait(socket, 'room:joined');
  socket.emit('battle:join', { battleId: room.id, user, adminToken: token });
  return { token: (await session).sessionId, member: await joined };
}
(async () => {
  await start();
  const response = await fetch(url + '/api/battles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (!response.ok) throw new Error('create failed'); room = await response.json();
  const admin = await connect();
  const adminSession = await join(admin, { id: 'probe-admin', name: 'Admin', alias: 'Admin', role: 'admin' }, room.adminToken);
  const guest = await connect();
  const guestSession = await join(guest, { id: 'probe-guest', name: 'Guest', alias: 'Guest' });
  const roleSaved = wait(admin, 'battle:state', state => state.members.some(member => member.userId === 'probe-guest' && member.roles.includes('participant')));
  admin.emit('battle:change_role', { targetUserId: 'probe-guest', newRole: 'participant' }); await roleSaved;
  const grantSaved = wait(admin, 'battle:state', state => state.members.some(member => member.userId === 'probe-guest' && member.roles.includes('admin')));
  admin.emit('battle:grant_admin', { targetUserId: 'probe-guest' }); await grantSaved;
  const revokeSaved = wait(admin, 'battle:state', state => state.members.some(member => member.userId === 'probe-guest' && !member.roles.includes('admin')));
  admin.emit('battle:revoke_admin', { targetUserId: 'probe-guest' }); await revokeSaved;
  await stop();
  await start();
  const admin2 = await connect(); const adminJoined = wait(admin2, 'room:joined');
  admin2.emit('battle:reconnect', { battleId: room.id, sessionId: adminSession.token });
  const adminRecovered = await adminJoined;
  const guest2 = await connect(); const guestJoined = wait(guest2, 'room:joined');
  guest2.emit('battle:reconnect', { battleId: room.id, sessionId: guestSession.token });
  const guestRecovered = await guestJoined;
  if (!adminRecovered.roles.includes('admin') || !guestRecovered.roles.includes('participant') || guestRecovered.roles.includes('admin')) throw new Error('roles not restored safely');
  const invite = wait(admin2, 'battle:invitation'); admin2.emit('battle:create_invitation', {}); await invite;
  execFileSync('docker', ['stop', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); databaseStopped = true;
  const storageError = wait(admin2, 'battle:error', error => error.message.includes('guardar los permisos'));
  admin2.emit('battle:grant_admin', { targetUserId: 'probe-guest' }); await storageError;
  execFileSync('docker', ['start', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); databaseStopped = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { execFileSync('docker', ['exec', 'freestyle-audit-postgres', 'pg_isready', '-U', 'freestyle_test'], { windowsHide: true, stdio: 'pipe' }); break; }
    catch { await new Promise(resolve => setTimeout(resolve, 200)); }
  }
  await stop(); await start();
  const guest3 = await connect(); const recovered = wait(guest3, 'room:joined');
  guest3.emit('battle:reconnect', { battleId: room.id, sessionId: guestSession.token });
  if ((await recovered).roles.includes('admin')) throw new Error('failed grant restored admin');
  console.log('lobby_reinicio=ok administrador=ok participante=ok revocacion=ok invitacion=ok fallo_db=seguro');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (databaseStopped) { try { execFileSync('docker', ['start', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); } catch {} }
  for (const socket of sockets) socket.close();
  await stop();
  if (room?.id) await prisma.liveBattle.deleteMany({ where: { id: room.id } });
  await prisma.$disconnect();
});
