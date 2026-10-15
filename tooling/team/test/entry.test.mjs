import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, assign } from '../lib/team.mjs';
import { scanOutboxes } from '../lib/outbox.mjs';
import { tick, requestWatcherStop, watcherStatus } from '../lib/controller.mjs';
import { processAlive } from '../lib/store.mjs';
import { main, ensureBackgroundWatcher } from '../cli.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const none = () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' });

// Stops the watcher gracefully and waits until its process is really gone, so the temp directory can be removed.
async function stopAndWait(teamDir, pid, timeoutMs = 20000) {
  try { requestWatcherStop(teamDir); } catch {}
  const until = Date.now() + timeoutMs;
  while (pid && processAlive(pid) && Date.now() < until) await new Promise(r => setTimeout(r, 100));
  if (pid && processAlive(pid)) { try { process.kill(pid); } catch {} } // our own test child, last resort
}

// The minimum event a role writes by hand, exactly as documented in the skill.
const minimal = (extra = {}) => ({ schemaVersion: 1, teamId: 'team-e', memberId: 'PG-1', eventId: 'ev-minimal-001', createdAt: new Date().toISOString(), type: 'progress', summary: '做了一半', ...extra });

function setup(dir) {
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(exampleConfig(), { teamId: 'team-e', taskName: 't', cwd: dir }));
  store.update(s => { addInitialMembers(s, ['PG']); });
  return store;
}
const write = (store, event) => {
  const dir = path.join(store.dir, 'outbox', event.memberId); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${event.eventId}.json`), JSON.stringify(event));
};

test('the documented minimal event is accepted; type+summary alone is rejected as invalid, not dropped', () => tempDir(dir => {
  const store = setup(dir);
  write(store, minimal());
  write(store, { ...minimal({ eventId: 'ev-bare-00001' }), schemaVersion: undefined, teamId: undefined, memberId: 'PG-1' });
  write(store, minimal({ eventId: 'ev-withtask-01', type: 'completed', taskId: 'task-1', paths: ['out.md'] }));
  const { events, invalid } = scanOutboxes(store.dir, { teamId: 'team-e', members: store.read().members });
  assert.deepEqual(events.map(e => e.eventId).sort(), ['ev-minimal-001', 'ev-withtask-01']);
  assert.deepEqual(invalid.map(i => [i.eventId, i.error]), [['ev-bare-00001', 'EVENT_TEAM_MISMATCH']]);
}));

test('an event whose eventId does not match its file name is rejected', () => tempDir(dir => {
  const store = setup(dir);
  const d = path.join(store.dir, 'outbox', 'PG-1'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'ev-file-name-01.json'), JSON.stringify(minimal({ eventId: 'ev-other-id-001' })));
  const { events, invalid } = scanOutboxes(store.dir, { teamId: 'team-e', members: store.read().members });
  assert.equal(events.length, 0);
  assert.equal(invalid[0].error, 'EVENT_ID_MISMATCH');
}));

test('an ack without taskId is accepted at start-up but does not touch an assignment; with taskId it does', async () => tempDir(async dir => {
  const store = setup(dir);
  const world = fakeHerdrWorld();
  store.update(s => { const a = assign(s, { memberId: 'PG-1', summary: 'x', taskId: 'task-1' }); a.sentAt = new Date().toISOString(); a.status = 'sent'; });
  write(store, minimal({ eventId: 'ev-ack-notask-1', type: 'ack' }));
  await tick({ teamDir: store.dir, herdr: world.herdr, diagnose: false });
  assert.equal(store.read().assignments['task-1'].ackAt, null);
  write(store, minimal({ eventId: 'ev-ack-withtask', type: 'ack', taskId: 'task-1' }));
  await tick({ teamDir: store.dir, herdr: world.herdr, diagnose: false });
  assert.ok(store.read().assignments['task-1'].ackAt);
}));

test('start launches the PM and ensures exactly one background watcher (reused on a second ask)', () => tempDir(async dir => {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  const cfgFile = path.join(dir, 'team.json'); fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  const world = fakeHerdrWorld();
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async () => none() });
  const teamDir = path.join(dir, 'team');
  let result;
  try {
    result = await main(['start', '--config', cfgFile, '--task', '入口', '--cwd', dir, '--team-dir', teamDir, '--tab', 'Existing', '--interval', '5'], { herdr: world.herdr, env: { HERDR_WORKSPACE_ID: 'w3' }, providerState });
    assert.equal(result.pm.step, 'prompted');
    assert.equal(result.watcher.background, true);
    assert.equal(result.watcher.reused, false);
    const status = watcherStatus(teamDir);
    assert.equal(status.running, true);
    assert.equal(status.pid, result.watcher.pid);
    const again = await ensureBackgroundWatcher(teamDir, { interval: 5 });
    assert.equal(again.reused, true);
    assert.equal(again.pid, result.watcher.pid, 'no second watcher');
    assert.equal(world.gridCalls.length, 1, 'only the PM pane exists');
  } finally { await stopAndWait(teamDir, result?.watcher?.pid); }
}));

test('start --no-watch skips the watcher and says so', () => tempDir(async dir => {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  const cfgFile = path.join(dir, 'team.json'); fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  const world = fakeHerdrWorld();
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async () => none() });
  const r = await main(['start', '--config', cfgFile, '--task', '入口', '--cwd', dir, '--team-dir', path.join(dir, 'team'), '--tab', 'Existing', '--no-watch'], { herdr: world.herdr, env: { HERDR_WORKSPACE_ID: 'w3' }, providerState });
  assert.equal(r.watcher.skipped, 'no-watch');
  assert.equal(watcherStatus(path.join(dir, 'team')).running, false);
}));
