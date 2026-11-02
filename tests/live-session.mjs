import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';
import { mkdir, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import questions from '../src/questions.json' with { type: 'json' };
import { answerMask } from '../src/quiz-core.mjs';
import { PROTOCOL, normalizeCode, readRoomCode, joinUrl, validateProgress, questionStats, STALE_MS, LOST_MS } from '../src/live-protocol.mjs';
await mkdir('.test-runtime', { recursive: true });
await build({ entryPoints: ['src/live-session.ts'], outfile: '.test-runtime/live-session.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' });
const { TrainerSession, LearnerSession } = await import(pathToFileURL(resolve('.test-runtime/live-session.mjs')).href);
after(() => rm('.test-runtime', { recursive: true, force: true }));
const flush = async () => { for (let i = 0; i < 18; i++) await Promise.resolve(); };

function broker() {
  const peers = new Map(); let next = 0;
  class Connection extends EventEmitter {
    open = false; peer; remote;
    constructor(peer) { super(); this.peer = peer; }
    send(data) { if (this.open) queueMicrotask(() => { if (this.remote.open) this.remote.emit('data', structuredClone(data)); }); }
    close() { if (!this.open) return; this.open = false; this.emit('close'); if (this.remote.open) { this.remote.open = false; this.remote.emit('close'); } }
  }
  class Peer extends EventEmitter {
    destroyed = false; disconnected = false; connections = [];
    constructor(id) { super(); this.id = id; }
    connect(id) {
      const local = new Connection(id); const remote = new Connection(this.id); local.remote = remote; remote.remote = local;
      this.connections.push(local);
      queueMicrotask(() => {
        const other = peers.get(id);
        if (!other || other.destroyed) { this.emit('error', { type: 'peer-unavailable' }); return; }
        other.connections.push(remote); other.emit('connection', remote);
        queueMicrotask(() => { local.open = remote.open = true; remote.emit('open'); local.emit('open'); });
      });
      return local;
    }
    reconnect() { this.disconnected = false; queueMicrotask(() => this.emit('open', this.id)); }
    destroy() { this.destroyed = true; peers.delete(this.id); this.connections.forEach(c => c.close()); }
  }
  const factory = async id => {
    const peer = new Peer(id || `guest-${++next}`); peers.set(peer.id, peer);
    // The caller must attach handlers before the simulated signaling server replies.
    queueMicrotask(() => queueMicrotask(() => peer.emit('open', peer.id)));
    return peer;
  };
  return { factory, peers };
}

test('sessiecodes, relatieve publicatie-URL en antwoordvalidatie', () => {
  assert.equal(normalizeCode('abcd - efgh - 2345'), 'ABCDEFGH2345');
  assert.equal(normalizeCode('invalid'), '');
  assert.equal(readRoomCode(joinUrl('https://example.org/training/?trainer=1', 'ABCDEFGH2345')), 'ABCDEFGH2345');
  assert.equal(new URL(joinUrl('https://example.org/sub/index.html', 'ABCDEFGH2345')).pathname, '/sub/index.html');
  const base = { revision: 1, answers: { 1: 1 }, current: 1, finished: false };
  assert.ok(validateProgress(base, questions));
  assert.equal(validateProgress({ ...base, answers: { 1: 3 } }, questions), null);
  assert.equal(validateProgress({ ...base, answers: { 99: 1 } }, questions), null);
  assert.equal(validateProgress({ ...base, finished: true }, questions), null);
  assert.equal(validateProgress({ ...base, revision: Infinity }, questions), null);
});

test('twee deelnemers, live ontvangst, alle 12 antwoorden, selectie, verbergen en wissen', async () => {
  const net = broker(); let hostState; let firstState; let secondState;
  const host = new TrainerSession(s => hostState = s, net.factory);
  await host.start(); await flush(); assert.equal(hostState.status, 'ready');
  const roomCode = hostState.code;
  const first = new LearnerSession(roomCode, s => firstState = s, net.factory);
  const second = new LearnerSession(roomCode, s => secondState = s, net.factory);
  try {
    await first.start('Jos'); await second.start('Test deelnemer'); await flush();
    assert.equal(firstState.status, 'connected'); assert.equal(secondState.status, 'connected');
    assert.equal(hostState.participants.length, 2); assert.equal(hostState.participants.filter(p => p.online).length, 2);
    assert.equal(hostState.revealed, false);
    let answers = {};
    for (const q of questions) {
      answers = { ...answers, [q.n]: answerMask(q.key) };
      first.update({ answers, current: q.n, finished: q.n === 12 }); await flush();
      assert.equal(hostState.participants[0].answers[q.n], answerMask(q.key));
    }
    assert.equal(hostState.participants[0].finished, true);
    assert.equal(firstState.acknowledged, firstState.progress.revision);
    second.update({ answers: { 1: 1 }, current: 2, finished: false }); await flush();
    assert.equal(questionStats(questions[0], hostState.participants).received, 2);
    host.review(8, false); await flush();
    assert.equal(firstState.question, 8); assert.equal(secondState.phase, 'review'); assert.equal(firstState.revealed, false);
    const before = secondState.progress.revision;
    second.update({ answers: { 1: 2 }, current: 1, finished: false }); await flush();
    assert.equal(secondState.progress.revision, before, 'Tijdens nabespreking worden geen antwoorden gewijzigd.');
    host.review(8, true); await flush(); assert.equal(firstState.revealed, true);
    host.review(9, false); await flush(); assert.equal(firstState.revealed, false);
    host.resume(); await flush(); assert.equal(secondState.phase, 'practice');
    second.dispose(); await flush(); assert.equal(hostState.participants.filter(p => p.online).length, 1);
    host.close(); await flush();
    assert.equal(hostState.active, false); assert.deepEqual(hostState.participants, []); assert.equal(hostState.code, '');
    assert.equal(firstState.status, 'closed'); assert.equal(firstState.name, ''); assert.deepEqual(firstState.progress.answers, {});
    assert.equal(secondState.name, ''); assert.deepEqual(secondState.progress.answers, {});
  } finally { first.dispose(); second.dispose(); host.close(true); }
});

test('transport accepteert geen vervalste payload; een oude revisie overschrijft niets', async () => {
  const net = broker(); let state; let learnerState;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => learnerState = s, net.factory);
  await learner.start('<script>naam</script>'); await flush();
  try {
    learner.update({ answers: { 1: 2 }, current: 2, finished: false }); await flush();
    const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-'));
    const connection = guestPeer.connections[0];
    connection.send({ protocol: PROTOCOL, type: 'update', progress: { revision: 999, answers: { 1: 15 }, current: 1, finished: false } }); await flush();
    assert.equal(state.participants[0].answers[1], 2);
    connection.send({ protocol: PROTOCOL, type: 'update', progress: { revision: 0, answers: { 1: 1 }, current: 1, finished: false } }); await flush();
    assert.equal(state.participants[0].answers[1], 2);
    assert.equal(learnerState.progress.answers[1], 2);
  } finally { learner.dispose(); host.close(true); }
});

test('verbroken verbinding herstelt dezelfde deelnemer met alle ontvangen antwoorden', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Herstel'); await flush();
  try {
    learner.update({ answers: { 1: 4, 5: 2 }, current: 6, finished: false }); await flush();
    const id = state.participants[0].id;
    const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-'));
    guestPeer.connections[0].close(); await flush();
    assert.equal(guest.status, 'reconnecting'); assert.equal(state.participants[0].online, false);
    t.mock.timers.tick(35000); await flush();
    assert.equal(guest.status, 'connected'); assert.equal(state.participants.length, 1);
    assert.equal(state.participants[0].id, id); assert.equal(state.participants[0].online, true);
    assert.deepEqual(state.participants[0].answers, { 1: 4, 5: 2 });
  } finally { learner.dispose(); host.close(true); t.mock.timers.reset(); }
});

test('geen ontvangst van afsluitbericht: offline telefoon wist na timeout alsnog zijn geheugen', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 100000 });
  const net = broker(); let state; let guest;
  const host = new TrainerSession(s => state = s, net.factory); await host.start(); await flush();
  const learner = new LearnerSession(state.code, s => guest = s, net.factory); await learner.start('Offline'); await flush();
  learner.update({ answers: { 1: 1 }, current: 1, finished: false }); await flush();
  const guestPeer = [...net.peers.values()].find(p => p.id.startsWith('guest-')); guestPeer.connections[0].close();
  host.close(true); await flush();
  t.mock.timers.tick(LOST_MS + 10000); await flush();
  assert.equal(guest.status, 'error'); assert.equal(guest.name, ''); assert.deepEqual(guest.progress.answers, {});
  learner.dispose(); t.mock.timers.reset();
});

