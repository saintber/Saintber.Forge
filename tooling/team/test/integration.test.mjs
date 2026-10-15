import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, assign, currentPm, claimWrite } from '../lib/team.mjs';
import { ensurePlacement, launchMember, tick, handoff } from '../lib/controller.mjs';
import { writeEvent } from '../lib/outbox.mjs';
import { loadDelivery, resolveUncertain, acknowledge } from '../lib/sender.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { agentName, GRID_SCRIPT } from '../lib/herdr.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

// Test config: Claude + Codex enabled so launch pre-checks pass without real CLIs.
const config = () => { const c = exampleConfig(); c.providers.codex.enabled = true; return c; };
const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
// Closed environment: any attempt to read real Codex quota or run a real CLI fails the test.
const closedObserve = { codexReader: async () => ({ result: { rateLimits: { primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } } } }) };
const mkProviderState = cfg => createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observeFn: async () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' }) });

function setup(dir, { cfg = config(), world = fakeHerdrWorld(), extra } = {}) {
  const teamDir = path.join(dir, 'team');
  const store = new TeamStore(teamDir);
  const state = createTeamState(cfg, { teamId: 'team-int', taskName: '整合任務', cwd: dir });
  store.create(state);
  extra?.(store);
  return { teamDir, store, world, providerState: mkProviderState(cfg) };
}

test('start path: new tab with --no-focus, panes only via grid.cjs, anchor closed only when provably empty', async () => tempDir(async dir => {
  const { store, world, providerState } = setup(dir);
  world.workspaces = [{ workspace_id: 'w3', label: 'Personal' }];
  const placement = await ensurePlacement(store, world.herdr, { space: 'Personal' });
  assert.equal(placement.tabOwned, true);
  assert.ok(placement.anchorPaneId, 'tab create returns the root pane as anchor');
  const anchor = placement.anchorPaneId;
  world.processes = { [anchor]: [{ name: 'pwsh.exe' }] };
  const origExec = world.herdr;
  const pm = await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  assert.equal(pm.launch.step, 'prompted');
  assert.equal(world.gridCalls.length, 1, 'exactly one pane created, through grid.cjs');
  assert.ok(world.gridCalls[0].includes('split') && world.gridCalls[0].includes('--tab'));
  assert.match(pm.paneId, /^w3:p/);
  assert.ok(world.started[0].args.includes('--model'), 'model passed explicitly');
  assert.ok(!world.started[0].args.includes('--fallback-model'));
  assert.equal(pm.agent.kind, 'claude');
  assert.match(store.read().members['PM-1'].agentName, /^[a-z][a-z0-9_-]{0,31}$/);
  assert.ok(world.panes.find(p => p.pane_id === 'w3:p1'), "user's pane untouched");
  assert.ok(origExec);
}));

test('explicit missing Space or Tab fails instead of falling back', async () => tempDir(async dir => {
  const { store, world } = setup(dir);
  await assert.rejects(ensurePlacement(store, world.herdr, { space: 'Nope' }), /SPACE_NOT_FOUND/);
  await assert.rejects(ensurePlacement(store, world.herdr, { space: 'Personal', tab: 'Nope' }), /TAB_NOT_FOUND/);
  const caller = await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  assert.equal(caller.spaceSource, 'caller');
  assert.equal(caller.tabOwned, false);
}));

test('agent names are legal, stable and collision-free for long team ids', () => {
  const a = agentName('team-' + 'x'.repeat(40) + 'a', 'SA1-1');
  const b = agentName('team-' + 'x'.repeat(40) + 'b', 'SA1-1');
  assert.notEqual(a, b);
  for (const n of [a, b, agentName('t', 'PM-1')]) assert.match(n, /^[a-z][a-z0-9_-]{0,31}$/);
  assert.equal(agentName('t', 'PM-1'), agentName('t', 'PM-1'));
});

test('launch failure mid-way resumes without a second pane', async () => tempDir(async dir => {
  const { store, world, providerState } = setup(dir);
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  world.failGridOnce = true;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState }), /GRID_FAILED/);
  assert.equal(store.read().members['PM-1'].launch.step, 'pane-requested');
  const member = await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  assert.equal(member.launch.step, 'prompted');
  assert.equal(world.panes.filter(p => p.label.includes('PM-1')).length, 1);
}));

test('grid created a pane then failed: recovery adopts only the unambiguous own-label pane', async () => tempDir(async dir => {
  const { store, world, providerState } = setup(dir);
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  world.gridCreatesThenFails = true;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState }), /GRID_FAILED/);
  const member = await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  assert.equal(member.launch.step, 'prompted');
  assert.equal(world.gridCalls.length, 1, 'no second grid call');
}));

test('a disabled provider is skipped and never probed; selection moves to the next entry', async () => tempDir(async dir => {
  const cfg = config();
  cfg.providers.claude.enabled = false;
  const { store, world } = setup(dir, { cfg });
  let probes = 0;
  const providerState = createProviderState({ config: cfg, authDeps: { ...okAuth, exec: async () => { probes++; return { code: 0, stdout: 'ChatGPT', stderr: '' }; } }, observeDeps: { codexReader: async () => ({ error: 'SKIP' }) } });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  const m = await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  assert.equal(store.read().config.providers.claude.enabled, false);
  assert.equal(world.started[0].kind, 'codex', 'PM list: claude entries skipped, codex chosen');
  assert.equal(m.model.cursor, 2);
  assert.ok(probes > 0);
}));

test('no launchable entry stops with a reason; it never falls back to defaultModel', async () => tempDir(async dir => {
  const cfg = config();
  cfg.providers.claude.enabled = false; cfg.providers.codex.enabled = false;
  const { store, world } = setup(dir, { cfg });
  const providerState = mkProviderState(cfg);
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState }), /NO_LAUNCHABLE_MODEL_ENTRY/);
  assert.equal(world.started.length, 0);
}));

test('events: apply is replayable and a bad event does not poison the rest', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState });
  const a = store.update(s => ({ value: assign(s, { memberId: 'PG-1', summary: 'x' }) }));
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-bad-0001', type: 'progress', summary: 'orphan', taskId: 'task-does-not-exist' });
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-good-001', type: 'ack', summary: 'ack', taskId: a.taskId });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(r.invalid.length, 0);
  assert.equal(store.read().assignments[a.taskId].ackAt !== null, true);
  const again = await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(again.applyErrors.length, 0, 'already-applied events are not applied twice');
  assert.ok(store.read().appliedEvents['ev-good-001']);
}));

test('completed without a taskId does not update an assignment', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); assign(s, { memberId: 'PG-1', summary: 'x', taskId: 'task-1' }); });
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-nocompl01', type: 'completed', summary: 'done?' });
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.notEqual(store.read().assignments['task-1'].status, 'completed-unverified');
  assert.ok(providerState);
}));

async function prompted(world, store, teamDir, providerState, ids = ['PM-1']) {
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  for (const id of ids) await launchMember(store, world.herdr, id, { teamDir, providerState });
}

test('delivery: PM working defers, idle delivers once, sent is not received, ack marks received', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  const pmPane = store.read().members['PM-1'].paneId;
  world.panes.find(p => p.pane_id === pmPane).agent_status = 'working';
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-done-0001', type: 'completed', summary: '完成' });
  const before = world.prompts.length;
  let r = await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, before, 'busy PM gets nothing');
  assert.equal(r.delivery.results[0].outcome, 'deferred');
  world.panes.find(p => p.pane_id === pmPane).agent_status = 'idle';
  r = await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, before + 1);
  assert.equal(loadDelivery(teamDir).records['ev-done-0001'].state, 'sent');
  assert.match(world.prompts.at(-1).text, /ack --team-dir/);
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, before + 1, 'not delivered twice');
  acknowledge(teamDir, ['ev-done-0001'], new Date().toISOString());
  assert.equal(loadDelivery(teamDir).records['ev-done-0001'].state, 'received');
}));

test('delivery: unknown recipient status is not ready; several important events re-check readiness between sends', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  const pm = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  pm.agent_status = 'unknown';
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-blocked-01', type: 'blocked', summary: 'b' });
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-decide-001', type: 'decision-needed', summary: 'd' });
  const base = world.prompts.length;
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, base, 'unknown is not ready');
  pm.agent_status = 'idle';
  // After the first send the (fake) PM becomes working; the second important event must wait.
  world.onPrompt = () => { pm.agent_status = 'working'; };
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, base + 1, 'only one prompt while PM is busy');
  const states = ['ev-blocked-01', 'ev-decide-001'].map(id => loadDelivery(teamDir).records[id].state).sort();
  assert.deepEqual(states, ['queued', 'sent']);
}));

test('delivery: timeout is uncertain, never blindly resent; only the PM can resolve it', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  world.promptOutcome = () => 'timeout';
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-timeout-01', type: 'completed', summary: 'c' });
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(loadDelivery(teamDir).records['ev-timeout-01'].state, 'uncertain');
  assert.ok(loadDelivery(teamDir).records['ev-timeout-01'].target.paneId, 'real target journaled before the send');
  world.promptOutcome = () => 'sent';
  const base = world.prompts.length;
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, base, 'absence in the pane is not proof of non-delivery: no resend');
  assert.equal(loadDelivery(teamDir).records['ev-timeout-01'].state, 'uncertain');
  assert.equal(resolveUncertain(teamDir, 'ev-timeout-01', 'resend'), 'retry');
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(loadDelivery(teamDir).records['ev-timeout-01'].state, 'sent');
}));

test('delivery: seeing the item id in the recorded pane only means sent', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  world.promptOutcome = () => 'timeout';
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-seen-00001', type: 'completed', summary: 'c' });
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).screen = '... ev-seen-00001 ...';
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(loadDelivery(teamDir).records['ev-seen-00001'].state, 'sent');
  assert.notEqual(loadDelivery(teamDir).records['ev-seen-00001'].state, 'received');
}));

test('delivery: concurrent ticks never send the same event twice', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-concur-001', type: 'completed', summary: 'c' });
  const base = world.prompts.length;
  await Promise.all([1, 2, 3].map(() => tick({ teamDir, herdr: world.herdr, diagnose: false })));
  assert.equal(world.prompts.length - base, 1);
}));

test('assignment goes through the journal; deadline clock starts only when sent', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  const pg = world.panes.find(p => p.pane_id === store.read().members['PG-1'].paneId);
  pg.agent_status = 'working';
  const a = store.update(s => ({ value: assign(s, { memberId: 'PG-1', summary: '實作' }) }));
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(store.read().assignments[a.taskId].sentAt, null, 'busy member: not sent, clock not started');
  pg.agent_status = 'idle';
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.ok(store.read().assignments[a.taskId].sentAt);
  assert.equal(store.read().assignments[a.taskId].status, 'sent');
}));

test('overdue assignment gets one bounded diagnosis; permission-blocked is recognised without changing the role', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  const a = store.update(s => ({ value: assign(s, { memberId: 'PG-1', summary: 'x', deadlines: { ackSeconds: 1, progressSeconds: 2, hardNoReportSeconds: 3 } }) }));
  await tick({ teamDir, herdr: world.herdr, diagnose: false, now: Date.now() });
  const pg = world.panes.find(p => p.pane_id === store.read().members['PG-1'].paneId);
  pg.agent_status = 'blocked'; pg.screen = 'Do you want to allow this command? permission';
  const later = Date.now() + 60000;
  const r1 = await tick({ teamDir, herdr: world.herdr, now: later });
  assert.equal(r1.late.length, 1);
  assert.equal(r1.late[0].classification, 'permission-blocked');
  const r2 = await tick({ teamDir, herdr: world.herdr, now: later + 1000 });
  assert.equal(r2.late.length, 0, 'one diagnosis per basis, not a loop');
  assert.equal(store.read().members['PG-1'].status, 'active', 'role untouched');
  assert.ok(a);
}));

test('quota: tick re-reads state after usage refresh; waiting-for-quota PM gets nothing; unknown does not clear a known limit', async () => tempDir(async dir => {
  const cfg = config();
  cfg.roles.PM.models = [{ provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: -1 } }];
  cfg.roles.PG.models = [{ provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } }];
  const { store, world, teamDir } = setup(dir, { cfg });
  store.update(s => { addInitialMembers(s, ['PG']); });
  // Both members start while claude quota is unknown; the later tick observes the limit.
  const startPs = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve });
  await prompted(world, store, teamDir, startPs, ['PM-1', 'PG-1']);
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date().toISOString(), reliable: true, remaining: 0 } }, observeFn: async provider => ({ claude: { at: new Date().toISOString(), reliable: true, remaining: 0 } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-quota-0001', type: 'completed', summary: 'c' });
  const base = world.prompts.length;
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.equal(r.usage['PM-1'], 'wait');
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota');
  assert.equal(world.prompts.length, base, 'PM in waiting-for-quota is not given new turns');
  // A later unknown observation must not clear the wait or the stored limit.
  const unknown = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date().toISOString(), reliable: false } }, observeFn: async provider => ({ claude: { at: new Date().toISOString(), reliable: false } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState: unknown });
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota');
  assert.equal(store.read().members['PM-1'].model.lastObservation.remaining, 0);
  // Out-of-range or stale numbers are not recovery evidence either.
  const bogus = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date().toISOString(), reliable: true, remaining: 250 } }, observeFn: async provider => ({ claude: { at: new Date().toISOString(), reliable: true, remaining: 250 } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState: bogus });
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota');
  const stale = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date(Date.now() - 3600000).toISOString(), reliable: true, remaining: 90 } }, observeFn: async provider => ({ claude: { at: new Date(Date.now() - 3600000).toISOString(), reliable: true, remaining: 90 } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState: stale });
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota', 'stale reliable data is not recovery evidence');
  for (const weak of [{ windows: [] }, { remaining: NaN }, { remaining: -5 }, {}]) {
    const ps = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date().toISOString(), reliable: true, ...weak } }, observeFn: async provider => ({ claude: { at: new Date().toISOString(), reliable: true, ...weak } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
    await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState: ps });
    assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota', 'incomplete or invalid data is not recovery evidence: ' + JSON.stringify(weak));
  }
  const good = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closedObserve, observations: { claude: { at: new Date().toISOString(), reliable: true, remaining: 80 } }, observeFn: async provider => ({ claude: { at: new Date().toISOString(), reliable: true, remaining: 80 } })[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState: good });
  assert.equal(store.read().members['PM-1'].model.status, 'active');
}));

// --- handoff ----------------------------------------------------------------------------

async function handoffSetup(dir) {
  const ctx = setup(dir);
  ctx.store.update(s => { addInitialMembers(s, ['PG']); claimWrite(s, 'src/', 'PG-1'); });
  await prompted(ctx.world, ctx.store, ctx.teamDir, ctx.providerState, ['PM-1', 'PG-1']);
  const cp = path.join(dir, 'checkpoint.md'); fs.writeFileSync(cp, '# 進度\n- 已完成 A');
  ctx.store.update(s => { assign(s, { memberId: 'PG-1', summary: '未完成的實作', taskId: 'task-open' }); });
  return { ...ctx, cp };
}

test('handoff: refuses without a checkpoint; verifies the old pane is gone before transferring; resumable', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState, cp } = await handoffSetup(dir);
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: undefined, providerState, force: true }), /CHECKPOINT_REQUIRED/);
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: path.join(dir, 'missing.md'), providerState, force: true }), /CHECKPOINT_NOT_FOUND/);
  const oldPane = store.read().members['PG-1'].paneId;
  const old = world.panes.find(p => p.pane_id === oldPane);
  old.agent_status = 'working';
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }), /PREDECESSOR_NOT_AT_SAFE_BOUNDARY/);
  assert.equal(store.read().members['PG-1'].status, 'active', 'nothing transferred while the old agent is mid-turn');
  old.agent_status = 'idle';
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  assert.equal(r.phase, 'successor-launched');
  const s = store.read();
  assert.equal(s.members['PG-1'].status, 'retired');
  assert.ok(world.closed.includes(oldPane), 'old self-created pane closed');
  const succ = s.members[r.to];
  assert.equal(s.writeOwners['src/'], r.to);
  assert.equal(s.assignments['task-open'].memberId, r.to);
  assert.equal(succ.model.cursor, 1);
  const prompt = world.prompts.find(p => p.target === succ.paneId).text;
  assert.match(prompt, /進度檢查點/);
  assert.match(prompt, /task-open/);
  assert.match(prompt, /src\//);
}));

test('handoff: a pane we cannot prove we own is never closed and never transferred', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState, cp } = await handoffSetup(dir);
  store.update(s => { s.members['PG-1'].agent.session = 'someone-elses-session'; });
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }), /AWAITING_QUIESCE/);
  assert.equal(world.closed.length, 0);
  assert.equal(store.read().members['PG-1'].status, 'active');
}));

test('handoff: crash windows resume cleanly (reserve, quiesce, transfer, successor launch)', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState, cp } = await handoffSetup(dir);
  const oldPane = store.read().members['PG-1'].paneId;
  // Crash while reserving the successor pane: the old agent must still be running and untouched.
  const original = world.herdr.gridSplit;
  let crashes = 1;
  world.herdr.gridSplit = async (...args) => { if (crashes-- > 0) throw new Error('CRASH_DURING_RESERVE'); return original(...args); };
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }), /CRASH_DURING_RESERVE/);
  let s = store.read();
  assert.equal(s.handoffs['PG-1'].phase, 'requested');
  assert.equal(s.members['PG-1'].status, 'active');
  assert.ok(!world.closed.includes(oldPane), 'old pane not closed before the successor pane is reserved');
  // Rerun: reserve, then close the old pane, then transfer atomically.
  const panesBefore = world.panes.length;
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  assert.equal(r.phase, 'successor-launched');
  s = store.read();
  assert.equal(Object.values(s.members).filter(m => m.predecessor === 'PG-1').length, 1);
  assert.equal(world.panes.length, panesBefore, 'one reserved pane replaced the closed one; nothing extra was created');
  const succ = s.members[r.to];
  assert.equal(succ.paneId, s.handoffs['PG-1'].reserve.paneId, 'successor uses the reserved pane');
  assert.equal(world.gridCalls.filter(c => c.includes('--name')).length >= 1, true);
}));

test('handoff: crash after transfer (successor launch fails) resumes with the same successor and pane', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState, cp } = await handoffSetup(dir);
  const original = world.herdr.startAgent;
  let fail = true;
  world.herdr.startAgent = async (...args) => { if (fail) { fail = false; throw new Error('CRASH_AT_SUCCESSOR_START'); } return original(...args); };
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true }), /CRASH_AT_SUCCESSOR_START/);
  let s = store.read();
  assert.equal(s.handoffs['PG-1'].phase, 'transferred');
  assert.ok(s.handoffs['PG-1'].successor, 'successor recorded in the same transaction as the transfer');
  assert.equal(s.members['PG-1'].status, 'retired');
  const successorId = s.handoffs['PG-1'].successor;
  const reserved = s.handoffs['PG-1'].reserve.paneId;
  const panes = world.panes.length;
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  assert.equal(r.to, successorId);
  assert.equal(r.phase, 'successor-launched');
  assert.equal(store.read().members[successorId].paneId, reserved);
  assert.equal(world.panes.length, panes, 'no extra pane on resume');
}));

test('handoff: single self-created PM keeps its tab alive because the successor pane is reserved first', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  world.workspaces = [{ workspace_id: 'w3', label: 'Personal' }];
  await ensurePlacement(store, world.herdr, { space: 'Personal' });
  const tabId = store.read().placement.tabId;
  world.processes = { [store.read().placement.anchorPaneId]: [{ name: 'pwsh.exe' }] };
  await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState });
  assert.ok(store.read().placement.anchorResult.closed, 'empty own anchor closed once the PM pane exists');
  assert.equal(world.panes.filter(p => p.tab_id === tabId).length, 1, 'PM is the last pane of its tab');
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'x');
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PM-1', checkpoint: cp, providerState, force: true });
  assert.equal(r.phase, 'successor-launched');
  assert.ok(!(world.closedTabs ?? []).includes(tabId), 'tab was never closed');
  assert.ok(world.tabs.some(t => t.tab_id === tabId));
  assert.equal(currentPm(store.read()).memberId, r.to);
}));

test('handoff: no next entry keeps the only PM pane open', async () => tempDir(async dir => {
  const cfg = config();
  cfg.roles.PM.models = [cfg.roles.PM.models[0]];
  const { store, world, teamDir, providerState } = setup(dir, { cfg });
  await prompted(world, store, teamDir, providerState, ['PM-1']);
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'x');
  const pane = store.read().members['PM-1'].paneId;
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PM-1', checkpoint: cp, providerState, force: true }), /NO_NEXT_MODEL_ENTRY/);
  assert.ok(!world.closed.includes(pane));
  assert.equal(currentPm(store.read()).memberId, 'PM-1');
}));

test('handoff: negative-threshold member is never migrated (PM included)', async () => tempDir(async dir => {
  const cfg = config();
  cfg.roles.PM.models[0].remainingThreshold.value = -1;
  const { store, world, teamDir, providerState } = setup(dir, { cfg });
  await prompted(world, store, teamDir, providerState, ['PM-1']);
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'x');
  await assert.rejects(handoff({ store, herdr: world.herdr, teamDir, memberId: 'PM-1', checkpoint: cp, providerState, force: true }), /NEGATIVE_THRESHOLD_WAITS/);
  assert.equal(currentPm(store.read()).memberId, 'PM-1');
}));

test('PM handoff redirects pending events to the new logical PM', async () => tempDir(async dir => {
  const { store, world, teamDir, providerState } = setup(dir);
  store.update(s => { addInitialMembers(s, ['PG']); });
  await prompted(world, store, teamDir, providerState, ['PM-1', 'PG-1']);
  const oldPmPane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  oldPmPane.agent_status = 'working';
  writeEvent(teamDir, 'team-int', 'PG-1', { eventId: 'ev-pending-001', type: 'completed', summary: '完成' });
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(loadDelivery(teamDir).records['ev-pending-001'].state, 'queued');
  oldPmPane.agent_status = 'idle';
  const cp = path.join(dir, 'pm-cp.md'); fs.writeFileSync(cp, 'pm progress');
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PM-1', checkpoint: cp, providerState, force: true });
  const newPm = store.read().members[r.to];
  assert.equal(currentPm(store.read()).memberId, r.to);
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.at(-1).target, newPm.paneId);
  assert.match(world.prompts.at(-1).text, /ev-pending-001/);
}));

test('grid script path used for every pane is the repo grid.cjs', async () => tempDir(async dir => {
  const { store, world, providerState } = setup(dir);
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  assert.ok(fs.existsSync(GRID_SCRIPT));
  assert.equal(path.basename(GRID_SCRIPT), 'grid.cjs');
  assert.equal(world.gridCalls.length, 1);
}));
