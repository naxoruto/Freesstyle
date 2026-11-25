const { spawn, execFileSync } = require('node:child_process');
const path = require('node:path');
const { io } = require('../apps/web/node_modules/socket.io-client');
const { PrismaClient } = require('../apps/server/node_modules/@prisma/client');
const root = path.resolve(__dirname, '..');
const env = { ...process.env, WS_PORT: '3112', NODE_ENV: 'test', DATABASE_URL: 'postgresql://freestyle_test:freestyle_test_local@127.0.0.1:55433/freestyle_test' };
process.env.DATABASE_URL = env.DATABASE_URL;
const prisma = new PrismaClient();
let child, room, dbStopped = false;
const sockets = [];
function wait(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, listener); reject(new Error('timeout: ' + event)); }, 12000);
    const listener = data => { if (!predicate(data)) return; clearTimeout(timer); socket.off(event, listener); resolve(data); };
    socket.on(event, listener);
  });
}
async function connect(user, token) {
  const socket = io('http://127.0.0.1:3112', { transports: ['websocket'], reconnection: false }); sockets.push(socket);
  await wait(socket, 'connect');
  const joined = wait(socket, 'room:joined');
  socket.emit('battle:join', { battleId: room.id, user, adminToken: token });
  await joined; return socket;
}
(async () => {
  child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: path.join(root, 'apps/server'), env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let log = ''; const timer = setTimeout(() => reject(new Error('startup timeout ' + log)), 12000);
    child.stderr.on('data', d => { log += d; });
    child.stdout.on('data', d => { if (String(d).includes('corriendo en')) { clearTimeout(timer); resolve(); } });
    child.on('exit', code => { clearTimeout(timer); reject(new Error('server exited ' + code + ' ' + log)); });
  });
  const response = await fetch('http://127.0.0.1:3112/api/battles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: process.env.PROBE_ROOM_SUCCESS === '1' ? JSON.stringify({ mode: { votingSystem: 'room_vote' } }) : '{}' });
  if (!response.ok) throw new Error('create failed'); room = await response.json();
  const admin = await connect({ id: 'probe-admin', name: 'Admin', alias: 'Admin', role: 'admin' }, room.adminToken);
  const members = {};
  for (const [id, role] of [['mc1', 'participant'], ['mc2', 'participant'], ['judge1', 'judge']]) {
    members[id] = await connect({ id, name: id, alias: id });
    const changed = wait(admin, 'battle:state', b => b.members.some(m => m.userId === id && m.roles.includes(role)));
    admin.emit('battle:change_role', { targetUserId: id, newRole: role }); await changed;
  }
  if (process.env.PROBE_START_FAILURE === '1') {
    execFileSync('docker', ['stop', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); dbStopped = true;
    let started = false;
    admin.on('battle:phase', p => { if (p.phase === 'countdown') started = true; });
    const failed = wait(admin, 'battle:error', e => e.message.includes('No se pudo guardar el inicio'));
    admin.emit('battle:start', {}); await failed;
    if (started) throw new Error('start broadcast after failed write');
    console.log('inicio_fallo_db=bloqueado inicio_no_anunciado=ok');
    return;
  }
  const countdown = wait(admin, 'battle:phase', p => p.phase === 'countdown');
  admin.emit('battle:start', {}); await countdown;
  if (process.env.PROBE_ROOM_SUCCESS === '1') {
    for (const expected of ['mc1_turn', 'pause', 'mc2_turn', 'voting']) {
      const phase = wait(admin, 'battle:phase', p => expected.endsWith('_turn') ? p.phase.endsWith('_turn') : p.phase === expected);
      admin.emit('battle:next_phase', {}); await phase;
    }
    const roster = await prisma.liveBattleVotingRoster.findUnique({ where: { roomId_replica_round: { roomId: room.id, replica: 0, round: 1 } } });
    if (!roster || roster.voterIds.sort().join(',') !== 'judge1,probe-admin') throw new Error('incorrect roster');
    const voted = wait(admin, 'battle:state');
    members.judge1.emit('room:vote', { battleId: room.id, votedForId: 'mc1' }); await voted;
    const result = wait(admin, 'battle:round_result');
    admin.emit('room:vote', { battleId: room.id, votedForId: 'mc2' }); await result;
    const votes = await prisma.liveBattleRoomVote.findMany({ where: { roomId: room.id } });
    if (votes.length !== 2) throw new Error('room votes not stored');
    console.log('padron_y_votos_sala=ok');
    return;
  }
  execFileSync('docker', ['stop', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); dbStopped = true;
  let advanced = false;
  admin.on('battle:phase', p => { if (p.phase === 'mc1_turn' || p.phase === 'mc2_turn') advanced = true; });
  const failed = wait(admin, 'battle:error', e => e.message.includes('No se pudo guardar el avance'));
  admin.emit('battle:next_phase', {}); await failed;
  if (advanced) throw new Error('phase broadcast after failed write');
  console.log('fallo_db=bloqueado fase_no_anunciada=ok');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (dbStopped) {
    try { execFileSync('docker', ['start', 'freestyle-audit-postgres'], { windowsHide: true, stdio: 'pipe' }); } catch {}
    for (let i = 0; i < 30; i++) { try { execFileSync('docker', ['exec', 'freestyle-audit-postgres', 'pg_isready', '-U', 'freestyle_test'], { stdio: 'pipe' }); break; } catch { await new Promise(resolve => setTimeout(resolve, 200)); } }
  }
  for (const socket of sockets) socket.close();
  if (child && child.exitCode === null) { const done = new Promise(resolve => child.once('exit', resolve)); child.kill(); await done; }
  if (room?.id) await prisma.liveBattle.deleteMany({ where: { id: room.id } });
  await prisma.$disconnect();
});
