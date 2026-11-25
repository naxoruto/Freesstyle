// Run from the repository root against a disposable database named freestyle_test.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { io } = require('../apps/web/node_modules/socket.io-client');
const { PrismaClient } = require('../apps/server/node_modules/@prisma/client');
const root = path.resolve(__dirname, '..');
const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (database.pathname !== '/freestyle_test') throw new Error('This check requires a disposable database named freestyle_test');
const port = process.env.RECOVERY_TEST_PORT || '3113';
const url = `http://127.0.0.1:${port}`;
const prisma = new PrismaClient();
const rooms = [];
const sockets = [];
let child;
function wait(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, listener); reject(new Error(`Timed out: ${event}`)); }, 15000);
    const listener = value => { if (!predicate(value)) return; clearTimeout(timer); socket.off(event, listener); resolve(value); };
    socket.on(event, listener);
  });
}
async function start() {
  child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: path.join(root, 'apps/server'), env: { ...process.env, WS_PORT: port, NODE_ENV: 'test' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    let errors = '';
    const timer = setTimeout(() => reject(new Error(`Startup timeout: ${errors.slice(-500)}`)), 15000);
    child.stderr.on('data', data => { errors += data; });
    child.stdout.on('data', data => { if (String(data).includes('corriendo en')) { clearTimeout(timer); resolve(); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code} ${errors.slice(-500)}`)); });
  });
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.close();
  if (child && child.exitCode === null) {
    const done = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await done;
  }
}
async function connect() {
  const socket = io(url, { transports: ['websocket'], reconnection: false }); sockets.push(socket);
  await wait(socket, 'connect'); return socket;
}
async function check(votingSystem, clockRecovery = false) {
  await start();
  const response = await fetch(`${url}/api/battles`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: { votingSystem, rounds: 1, ...(votingSystem === 'patron' ? { timerMode: 'manual', entriesPerParticipant: 2 } : {}) } }) });
  if (!response.ok) throw new Error('Could not create test battle');
  const battle = await response.json(); rooms.push(battle.id);
  const members = {};
  const sessions = {};
  for (const [name, role] of [['admin', 'admin'], ['mc1', 'participant'], ['mc2', 'participant'], ['j1', 'judge'], ['j2', 'judge'], ['j3', 'judge']]) {
    const socket = await connect(); members[name] = socket;
    const session = wait(socket, 'battle:session');
    socket.emit('battle:join', { battleId: battle.id, user: { id: `${battle.id}-${name}`, name, alias: name, ...(role === 'admin' ? { role } : {}) }, adminToken: role === 'admin' ? battle.adminToken : undefined });
    sessions[name] = (await session).sessionId;
    if (role !== 'admin') {
      const changed = wait(members.admin, 'battle:state', state => state.members.some(member => member.userId === `${battle.id}-${name}` && member.roles.includes(role)));
      members.admin.emit('battle:change_role', { targetUserId: `${battle.id}-${name}`, newRole: role }); await changed;
    }
  }
  const started = wait(members.admin, 'battle:state', state => state.status === 'in_progress');
  members.admin.emit('battle:start', {}); let state = await started;
  if (clockRecovery) {
    await stop();
    await new Promise(resolve => setTimeout(resolve, 4100));
    await start();
    for (const [name, sessionId] of Object.entries(sessions)) {
      const socket = await connect(); members[name] = socket;
      const recovered = wait(socket, 'battle:state', next => next.recovery?.paused);
      socket.emit('battle:reconnect', { battleId: battle.id, sessionId }); state = await recovered;
    }
    if (state.roundPhase !== 'countdown') throw new Error('Expired phase advanced during restart');
    const rejected = wait(members.admin, 'battle:error');
    members.admin.emit('battle:resume', { action: 'continue' }); await rejected;
    const resumed = wait(members.admin, 'battle:state', next => !next.recovery);
    members.admin.emit('battle:resume', { action: 'restart_clock' }); await resumed;
    await wait(members.admin, 'battle:phase', next => next.phase.endsWith('_turn'));
    await stop();
    console.log('expired clock: remained paused, explicit decision, timer resumed OK');
    return;
  }
  const steps = votingSystem === 'patron' ? 1 : 4;
  for (let i = 0; i < steps; i++) {
    const phase = wait(members.admin, 'battle:state', next => next.phaseToken !== state.phaseToken);
    members.admin.emit('battle:next_phase', { phaseToken: state.phaseToken }); state = await phase;
  }
  if (votingSystem === 'patron') {
    const entry = wait(members.admin, 'battle:state', next => next.roundPhase === 'entry_voting');
    members.admin.emit('battle:complete_entry', {}); state = await entry;
  }
  const [mc1, mc2] = state.participants;
  const scores = { flow: 7, lirica: 7, ingenio: 7, presencia: 7, tecnica: 7 };
  function cast(socket) {
    if (votingSystem === 'rubrica') socket.emit('judge:vote_rubric', { battleId: battle.id, round: 1, mc1Id: mc1.userId, mc2Id: mc2.userId, mc1Scores: scores, mc2Scores: scores });
    if (votingSystem === 'free_vote') socket.emit('judge:vote_free', { battleId: battle.id, votedForId: mc1.userId });
    if (votingSystem === 'room_vote') socket.emit('room:vote', { battleId: battle.id, votedForId: mc1.userId });
    if (votingSystem === 'patron') socket.emit('judge:vote_entry', { battleId: battle.id, points: 3 });
  }
  const firstVote = wait(members.admin, 'battle:state'); cast(members.j1); await firstVote;
  await stop(); await start();
  for (const [name, sessionId] of Object.entries(sessions)) {
    const socket = await connect(); members[name] = socket;
    const recovered = wait(socket, 'battle:state', next => next.id === battle.id && next.recovery?.paused);
    socket.emit('battle:reconnect', { battleId: battle.id, sessionId }); state = await recovered;
  }
  const forbidden = wait(members.j1, 'battle:error');
  members.j1.emit('battle:resume', { action: 'continue' }); await forbidden;
  const resumed = wait(members.admin, 'battle:state', next => !next.recovery);
  members.admin.emit('battle:resume', { action: 'continue' }); await resumed;
  for (const name of ['j2', 'j3', ...(votingSystem === 'room_vote' ? ['admin'] : [])]) {
    const updated = wait(members.admin, 'battle:state'); cast(members[name]); await updated;
  }
  if (votingSystem === 'patron') {
    const saved = await prisma.liveBattle.findUnique({ where: { id: battle.id } });
    if (saved.roundPhase === 'entry_voting') throw new Error('Recovered entry did not finish');
  } else {
    // The result transaction precedes its notification; allow queued event completion.
    for (let i = 0; i < 50; i++) {
      if (await prisma.liveBattleRoundResult.count({ where: { roomId: battle.id } }) === 1) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (await prisma.liveBattleRoundResult.count({ where: { roomId: battle.id } }) !== 1) throw new Error('Round result missing or duplicated');
  }
  await stop();
  console.log(`${votingSystem}: process restart, credentials, saved votes, resume and result OK`);
}
(async () => {
  for (const mode of ['rubrica', 'free_vote', 'room_vote', 'patron']) await check(mode);
  await check('rubrica', true);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await stop();
  await prisma.liveBattle.deleteMany({ where: { id: { in: rooms } } });
  await prisma.$disconnect();
});
