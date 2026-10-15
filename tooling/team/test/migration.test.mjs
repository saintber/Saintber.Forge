import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers } from '../lib/team.mjs';
import { ensurePlacement, launchMember, tick, handoff, resumeHandoffs, autoHandoffPending, applyObservation } from '../lib/controller.mjs';
import { writeEvent } from '../lib/outbox.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const fresh = extra => ({ at: new Date().toISOString(), reliable: true, ...extra });
const fast = { waitSessionPollMs: 5 };

// PG: a claude entry with threshold 50, then a codex entry on another pool.
async function team(dir) {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  cfg.roles.PG.models = [
    { provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 50 } },
    { provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-mg', taskName: '遷移', cwd: dir }));
  store.update(s => { addInitialMembers(s, ['PG']); });
  // Observations are controlled by the test through this mutable table.
  const table = { claude: undefined, codex: fresh({ windows: [{ usedPercent: 10 }] }) };
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async provider => table[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir: store.dir, providerState, ...fast });
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'progress');
  return { cfg, world, store, teamDir: store.dir, providerState, table, cp };
}
const successors = store => Object.values(store.read().members).filter(m => m.predecessor === 'PG-1');

test('(A) a known value strictly below a positive threshold becomes a handoff at the next boundary, without any real limit', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  table.claude = fresh({ remaining: 49 }); // below 50 but not exhausted
  writeEvent(teamDir, 'team-mg', 'PG-1', { eventId: 'ev-checkpoint-9', type: 'checkpoint', summary: 'cp', paths: [cp] });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.equal(r.usage['PG-1'], 'switch');
  assert.equal(store.read().members['PG-1'].model.pending.limitSeen, false, 'no real limit was seen');
  assert.equal(r.takeover[0].memberId, 'PG-1');
  assert.equal(r.takeover[0].started, true, JSON.stringify(r.takeover));
  assert.equal(successors(store).length, 1);
  assert.equal(store.read().members['PG-1'].status, 'retired');
}));

test('(A) a value equal to the threshold is not pending; an unknown value does not start a handoff', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table } = await team(dir);
  table.claude = fresh({ remaining: 50 });
  let r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.equal(r.usage['PG-1'], 'continue');
  assert.equal(r.takeover.length, 0);
  table.claude = undefined;
  r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.equal(r.takeover.length, 0);
  assert.equal(store.read().members['PG-1'].model.pending ?? null, null);
}));

test('(A) pending below the threshold without a checkpoint is reported to the PM as NO_CHECKPOINT, not silently dropped', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table } = await team(dir);
  table.claude = fresh({ remaining: 20 });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.deepEqual(r.takeover.map(t => [t.memberId, t.blocked]), [['PG-1', 'NO_CHECKPOINT']]);
  assert.ok(world.prompts.some(p => p.text.includes('[自動交接受阻] PG-1: NO_CHECKPOINT')));
  assert.equal(store.read().members['PG-1'].status, 'active');
  assert.equal(successors(store).length, 0);
}));

test('(A) the boundary re-check cancels a pending migration when quota recovered before the transfer', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  table.claude = fresh({ remaining: 30 });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.ok(store.read().members['PG-1'].model.pending);
  table.claude = fresh({ remaining: 90 }); // recovered
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState });
  assert.equal(r.cancelled, true);
  assert.equal(store.read().handoffs['PG-1'].phase, 'cancelled');
  assert.equal(world.closed.length, 0, 'nothing closed');
  assert.equal(successors(store).length, 0);
}));

test('(B) a cancelled handoff is a terminal no-op: not resumed, not re-reported, evidence kept', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  table.claude = fresh({ remaining: 30 });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  table.claude = fresh({ remaining: 90 });
  await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState });
  const cancelledAt = store.read().handoffs['PG-1'].cancelledAt;
  const grids = world.gridCalls.length;
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(await resumeHandoffs({ store, herdr: world.herdr, teamDir, providerState }), [], 'resume skips terminal records');
    const again = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
    assert.equal(again.terminal, true);
    assert.equal(again.cancelled, true);
    assert.equal(again.migrated, false);
    assert.equal(again.to, undefined);
  }
  assert.equal(world.gridCalls.length, grids, 'no new reserved pane');
  assert.equal(store.read().handoffs['PG-1'].cancelledAt, cancelledAt, 'cancellation evidence unchanged');
  assert.equal(store.read().handoffHistory['PG-1'].length, 1);
  assert.equal(successors(store).length, 0);
}));

test('(B) a successor-launched handoff is also a terminal no-op and keeps its successor id', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  table.claude = fresh({ remaining: 10 });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  const done = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState });
  assert.equal(done.phase, 'successor-launched');
  const again = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState, force: true });
  assert.equal(again.terminal, true);
  assert.equal(again.to, done.to);
  assert.deepEqual(await resumeHandoffs({ store, herdr: world.herdr, teamDir, providerState }), []);
  assert.equal(successors(store).length, 1);
}));

test('(B) a NEW pending migration after a cancellation starts a new handoff; the cancelled record stays as history', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  table.claude = fresh({ remaining: 30 });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  table.claude = fresh({ remaining: 90 });
  await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState });
  assert.equal(store.read().handoffs['PG-1'].phase, 'cancelled');
  await new Promise(r => setTimeout(r, 15));
  table.claude = fresh({ remaining: 5 }); // drops again, later than the cancellation
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.ok(store.read().members['PG-1'].model.pending, 'a new pending was recorded');
  writeEvent(teamDir, 'team-mg', 'PG-1', { eventId: 'ev-checkpoint-8', type: 'checkpoint', summary: 'cp', paths: [cp] });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, providerState });
  assert.equal(r.takeover[0]?.started, true, JSON.stringify(r.takeover));
  assert.equal(successors(store).length, 1);
  assert.equal(store.read().handoffHistory['PG-1'].length, 1, 'the earlier cancellation is kept');
}));

test('same tick: quota drops below the threshold, the member is idle and has a queued assignment -> the old pane gets no new work and the new logical member takes over', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  const { assign } = await import('../lib/team.mjs');
  writeEvent(teamDir, 'team-mg', 'PG-1', { eventId: 'ev-checkpoint-7', type: 'checkpoint', summary: 'cp', paths: [cp] });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, providerState });
  const oldPane = store.read().members['PG-1'].paneId;
  assert.equal(world.panes.find(p => p.pane_id === oldPane).agent_status, 'idle');
  store.update(s => { assign(s, { memberId: 'PG-1', summary: '一項新的實作工作', taskId: 'task-queued' }); }); // queued, not yet sent
  const before = world.prompts.length;
  table.claude = fresh({ remaining: 20 }); // first observation below 50, in this very tick
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, scanLimits: true, providerState });
  assert.equal(r.usage['PG-1'], 'switch');
  assert.equal(r.takeover[0].started, true, JSON.stringify(r.takeover));
  const toOld = world.prompts.slice(before).filter(p => p.target === oldPane && p.text.includes('一項新的實作工作'));
  assert.equal(toOld.length, 0, 'the model being replaced did not start the new work');
  const s = store.read();
  const successor = successors(store)[0];
  assert.ok(successor);
  assert.equal(s.assignments['task-queued'].memberId, successor.memberId, 'the assignment moved to the new logical member');
  // Delivered to the successor (on a following pass, once it is idle), never to the old pane.
  await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, scanLimits: true, providerState });
  const sentTo = world.prompts.filter(p => p.text.includes('一項新的實作工作')).map(p => p.target);
  assert.deepEqual([...new Set(sentTo)], [store.read().members[successor.memberId].paneId]);
}));

test('a turn already running on a member whose migration is pending is not interrupted', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, table, cp } = await team(dir);
  writeEvent(teamDir, 'team-mg', 'PG-1', { eventId: 'ev-checkpoint-6', type: 'checkpoint', summary: 'cp', paths: [cp] });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, providerState });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PG-1'].paneId);
  pane.agent_status = 'working';
  table.claude = fresh({ remaining: 10 });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, scanLimits: true, providerState });
  assert.equal(r.takeover[0].started, false, 'handoff waits for the safe boundary');
  assert.match(r.takeover[0].blocked, /PREDECESSOR_NOT_AT_SAFE_BOUNDARY/);
  assert.equal(world.closed.length, 0, 'the running turn is not cut');
  assert.equal(store.read().members['PG-1'].status, 'active');
  pane.agent_status = 'idle';
  const r2 = await tick({ teamDir, herdr: world.herdr, diagnose: false, probeUsage: true, scanLimits: true, providerState });
  assert.equal(store.read().members['PG-1'].status, 'retired', JSON.stringify(r2.takeover) + JSON.stringify(r2.resumed));
}));
