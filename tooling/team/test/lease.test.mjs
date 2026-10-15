import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, currentPm } from '../lib/team.mjs';
import { ensurePlacement, launchMember, handoff, resumeHandoffs, tick } from '../lib/controller.mjs';
import { acquire, release, withOperation, holders } from '../lib/lease.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const none = () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' });
const fast = { waitSessionPollMs: 5 };

async function ready(dir, { members = [] } = {}) {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-ls', taskName: '租約', cwd: dir }));
  if (members.length) store.update(s => { addInitialMembers(s, members); });
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async () => none() });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  return { world, store, providerState, teamDir: store.dir };
}

// --- the lease itself ---------------------------------------------------------------------

test('a live owner keeps the lease; the second caller is told it is in progress and fn is not called', () => tempDir(async dir => {
  const first = acquire(dir, 'launch', 'PM-1');
  assert.equal(first.acquired, true);
  const second = acquire(dir, 'launch', 'PM-1');
  assert.equal(second.acquired, false);
  assert.equal(second.owner.nonce, first.lease.nonce);
  let called = false;
  const r = await withOperation(dir, 'launch', 'PM-1', async () => { called = true; });
  assert.equal(r.busy, true);
  assert.equal(called, false);
  assert.equal(acquire(dir, 'launch', 'SA1-1').acquired, true, 'another member is independent');
  assert.equal(release(dir, first.lease), true);
  assert.equal(release(dir, first.lease), false, 'only the owning nonce releases');
}));

test('a dead owner is taken over (resume), a live one is not; release is in finally even when fn throws', () => tempDir(async dir => {
  fs.writeFileSync(path.join(dir, 'operations.json'), JSON.stringify({ leases: { 'launch:PM-1': { kind: 'launch', key: 'PM-1', pid: 999999, nonce: 'dead', since: new Date().toISOString() } } }));
  const taken = acquire(dir, 'launch', 'PM-1', { isAlive: () => false });
  assert.equal(taken.acquired, true);
  assert.equal(taken.tookOver, true);
  await assert.rejects(withOperation(dir, 'handoff', 'PG-1', async () => { throw new Error('boom'); }), /boom/);
  assert.equal(holders(dir)['handoff:PG-1'], undefined, 'lease freed after a failure');
}));

// --- launch ---------------------------------------------------------------------------------

test('two concurrent launches of the same member: one grid, one agent start, the loser reports in-progress', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.gridDelayMs = 60; world.startDelayMs = 40;
  const [a, b] = await Promise.allSettled([
    launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, ...fast }),
    launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, ...fast }),
  ]);
  assert.equal(a.status, 'fulfilled'); assert.equal(b.status, 'fulfilled');
  assert.equal(world.gridCalls.length, 1, 'only one pane is created even though the grid is slow');
  assert.equal(world.started.length, 1, 'only one agent start');
  const results = [a.value, b.value];
  assert.equal(results.filter(r => r.inProgress).length, 1);
  assert.equal(results.filter(r => !r.inProgress && r.launch.step === 'prompted').length, 1);
  assert.equal(world.prompts.length, 1, 'the role prompt is sent once');
  // Once finished, a rerun is a plain no-op.
  const again = await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, ...fast });
  assert.ok(!again.inProgress);
  assert.equal(world.started.length, 1);
}));

test('launch whose owner died resumes from the journal: no second pane, no second start', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.failAfterStart = true;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /HERDR_TIMEOUT/);
  // A crashed owner would leave its lease behind; simulate a dead pid.
  fs.writeFileSync(path.join(teamDir, 'operations.json'), JSON.stringify({ leases: { 'launch:PM-1': { kind: 'launch', key: 'PM-1', pid: 999999, nonce: 'dead', since: new Date().toISOString() } } }));
  const m = await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, ...fast, lease: { isAlive: pid => pid !== 999999 } });
  assert.equal(m.launch.step, 'prompted');
  assert.equal(world.gridCalls.length, 1);
  assert.equal(world.started.length, 1);
}));

// --- handoff ------------------------------------------------------------------------------

async function handoffSetup(dir) {
  const ctx = await ready(dir, { members: ['PG'] });
  for (const id of ['PM-1', 'PG-1']) await launchMember(ctx.store, ctx.world.herdr, id, { teamDir: ctx.teamDir, providerState: ctx.providerState, ...fast });
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'progress');
  return { ...ctx, cp };
}

test('a manual handoff and the watcher resume at the same time: one reserve, one close, one successor', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir, cp } = await handoffSetup(dir);
  const oldPane = store.read().members['PG-1'].paneId;
  world.gridDelayMs = 60; // the reserve pane takes a while to appear
  const manual = handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  // The watcher notices the recorded request and tries to resume it at once.
  await new Promise(r => setTimeout(r, 15));
  const resumed = resumeHandoffs({ store, herdr: world.herdr, teamDir, providerState });
  const [m, r] = await Promise.all([manual, resumed]);
  assert.equal(m.phase, 'successor-launched');
  assert.equal(r.length === 0 || r.every(x => x.inProgress || x.phase === 'successor-launched'), true, JSON.stringify(r));
  const s = store.read();
  assert.equal(world.gridCalls.filter(c => /→/.test(c[c.indexOf('--name') + 1])).length, 1, 'exactly one reserved pane');
  assert.equal(world.closed.filter(id => id === oldPane).length, 1, 'the old pane is closed once');
  assert.equal(Object.values(s.members).filter(x => x.predecessor === 'PG-1').length, 1, 'one successor');
  assert.equal(s.handoffs['PG-1'].successor, m.to);
  assert.equal(world.started.filter(x => x.pane === s.members[m.to].paneId).length, 1, 'the successor agent is started once');
}));

test('two concurrent manual handoffs of the same member: the second reports in-progress with the same phase data', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir, cp } = await handoffSetup(dir);
  world.gridDelayMs = 50;
  const [a, b] = await Promise.all([
    handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }),
    handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }),
  ]);
  assert.equal([a, b].filter(x => x.inProgress).length, 1);
  const done = [a, b].find(x => !x.inProgress);
  assert.equal(done.phase, 'successor-launched');
  assert.equal(Object.values(store.read().members).filter(x => x.predecessor === 'PG-1').length, 1);
  assert.equal(world.gridCalls.filter(c => /→/.test(c[c.indexOf('--name') + 1])).length, 1);
}));

test('a handoff whose owner died is resumed by the next caller from the recorded phase', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir, cp } = await handoffSetup(dir);
  const original = world.herdr.startAgent;
  let crash = true;
  world.herdr.startAgent = async (...a) => { if (crash) { crash = false; throw new Error('CRASH_AT_SUCCESSOR_START'); } return original(...a); };
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }), /CRASH_AT_SUCCESSOR_START/);
  const successor = store.read().handoffs['PG-1'].successor;
  fs.writeFileSync(path.join(teamDir, 'operations.json'), JSON.stringify({ leases: { 'handoff:PG-1': { kind: 'handoff', key: 'PG-1', pid: 999999, nonce: 'dead', since: new Date().toISOString() } } }));
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true, lease: { isAlive: pid => pid !== 999999 } });
  assert.equal(r.to, successor, 'same successor');
  assert.equal(r.phase, 'successor-launched');
  assert.equal(Object.values(store.read().members).filter(x => x.predecessor === 'PG-1').length, 1);
}));

test('the watcher tick resuming while the CLI hands off does not duplicate anything', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir, cp } = await handoffSetup(dir);
  world.gridDelayMs = 50;
  const cli = handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  await new Promise(r => setTimeout(r, 15));
  const watcher = tick({ teamDir, herdr: world.herdr, diagnose: false, providerState, scanLimits: true });
  await Promise.all([cli, watcher]);
  assert.equal(world.gridCalls.filter(c => /→/.test(c[c.indexOf('--name') + 1])).length, 1);
  assert.equal(Object.values(store.read().members).filter(x => x.predecessor === 'PG-1').length, 1);
  assert.ok(currentPm(store.read()));
}));
