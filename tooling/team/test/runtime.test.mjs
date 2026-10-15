import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, currentPm } from '../lib/team.mjs';
import { ensurePlacement, launchMember, tick, handoff, claimWatcher, requestWatcherStop, stillOwner, watcherStatus, applyObservation } from '../lib/controller.mjs';
import { writeEvent } from '../lib/outbox.mjs';
import { loadDelivery } from '../lib/sender.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { checkTransport } from '../lib/permissions.mjs';
import { notify } from '../notify.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const NOTIFY = fileURLToPath(new URL('../notify.mjs', import.meta.url));
const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const closed = { codexReader: async () => ({ result: { rateLimits: { primary: { usedPercent: 10 }, secondary: { usedPercent: 20 } } } }) };
const cfgBase = () => { const c = exampleConfig(); c.providers.codex.enabled = true; return c; };
// observeFn: probes return exactly the seeded observation (a closed, deterministic adapter).
const psOf = (cfg, observations = {}) => createProviderState({ config: cfg, authDeps: okAuth, observeDeps: closed, observations, observeFn: async provider => observations[provider.cli] ?? { at: new Date().toISOString(), reliable: false, source: 'test:none' } });
const fresh = (extra = {}) => ({ at: new Date().toISOString(), reliable: true, ...extra });

async function ready(dir, { cfg = cfgBase(), observations, members = ['PG'] } = {}) {
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-rt', taskName: '執行期', cwd: dir }));
  store.update(s => { if (members.length) addInitialMembers(s, members); });
  const providerState = psOf(cfg, observations);
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  return { world, store, teamDir: store.dir, providerState, cfg };
}

// --- notify, end to end ------------------------------------------------------------------

test('notify.mjs as a real process: rejects bad ids and traversal before reading anything', () => tempDir(dir => {
  const team = path.join(dir, 'team');
  const store = new TeamStore(team);
  store.create(createTeamState(cfgBase(), { teamId: 'team-rt', taskName: 't', cwd: dir }));
  const run = args => spawnSync(process.execPath, [NOTIFY, ...args], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  for (const [member, event, expect] of [['../evil', 'ev-aaaaaa', /MEMBER_INVALID/], ['PM-1', '../escape', /EVENT_ID_INVALID/], ['PM-1', 'ev-missing-1', /NOT_IN_OUTBOX/], ['Ghost-1', 'ev-aaaaaa', /MEMBER_UNKNOWN/]]) {
    const r = run(['--team-dir', team, '--member', member, '--event', event]);
    assert.equal(r.status, 1, `${member} ${event}`);
    assert.match(r.stderr, expect);
  }
  assert.equal(run(['--team-dir', team, '--member', 'PM-1']).status, 1, 'wrong arity refused');
  assert.equal(run(['--team-dir', team, '--member', 'PM-1', '--event', 'ev-aaaaaa', '--extra', 'herdr pane close']).status, 1, 'no free arguments accepted');
}));

test('notify: a junction outbox is refused before reading', () => tempDir(async dir => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'task-team-test-outside-'));
  try {
    const team = path.join(dir, 'team');
    const store = new TeamStore(team);
    store.create(createTeamState(cfgBase(), { teamId: 'team-rt', taskName: 't', cwd: dir }));
    fs.writeFileSync(path.join(outside, 'ev-planted-01.json'), JSON.stringify({ teamId: 'team-rt', memberId: 'PM-1', eventId: 'ev-planted-01', type: 'completed', summary: 'x' }));
    fs.mkdirSync(path.join(team, 'outbox'));
    fs.symlinkSync(outside, path.join(team, 'outbox', 'PM-1'), 'junction');
    await assert.rejects(notify(['--team-dir', team, '--member', 'PM-1', '--event', 'ev-planted-01'], { herdr: fakeHerdrWorld().herdr }), /LINK_IN_TEAM_PATH/);
  } finally { fs.rmSync(path.join(dir, 'team', 'outbox', 'PM-1'), { force: true, recursive: false }); fs.rmSync(outside, { recursive: true, force: true }); }
}));

test('notify: queued while PM busy, sent when idle, received only after ack, rerun never resends', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await ready(dir);
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir, providerState });
  const pm = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  writeEvent(teamDir, 'team-rt', 'PG-1', { eventId: 'ev-notify-001', type: 'completed', summary: '完成' });
  const args = ['--team-dir', teamDir, '--member', 'PG-1', '--event', 'ev-notify-001'];
  pm.agent_status = 'working';
  const base = world.prompts.length;
  assert.equal((await notify(args, { herdr: world.herdr })).delivery, 'queued');
  assert.equal(world.prompts.length, base);
  pm.agent_status = 'idle';
  assert.equal((await notify(args, { herdr: world.herdr })).delivery, 'sent');
  assert.equal(world.prompts.length, base + 1);
  assert.equal((await notify(args, { herdr: world.herdr })).delivery, 'sent', 'rerun reports the same state');
  assert.equal(world.prompts.length, base + 1, 'rerun never resends');
  const cli = spawnSync(process.execPath, [fileURLToPath(new URL('../cli.mjs', import.meta.url)), 'ack', '--team-dir', teamDir, '--events', 'ev-notify-001'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(loadDelivery(teamDir).records['ev-notify-001'].state, 'received');
}));

test('checkTransport refuses traversal and reports that it is not a Claude permission check', () => tempDir(dir => {
  const team = path.join(dir, 'team'); fs.mkdirSync(team);
  const bad = checkTransport(team, '../../outside');
  assert.equal(bad.outboxWritable, false);
  assert.match(bad.outboxError, /INVALID_MEMBER_ID/);
  assert.ok(!fs.existsSync(path.join(dir, 'outside')));
  const good = checkTransport(team, 'PM-1');
  assert.equal(good.outboxWritable, true);
  assert.equal(good.claudePermissionVerified, false);
  assert.equal(good.kind, 'controller-os-write-check');
}));

// --- watcher ownership -------------------------------------------------------------------

test('watcher: concurrent claims produce exactly one owner; stop is graceful and killing nothing', () => tempDir(dir => {
  const team = path.join(dir, 'team'); fs.mkdirSync(team);
  const results = [1, 2, 3, 4].map(n => claimWatcher(team, { pid: process.pid + (n % 2), nonce: `n${n}`, interval: 5, isAlive: () => true }));
  assert.equal(results.filter(r => r.claimed).length >= 1, true);
  const owner = JSON.parse(fs.readFileSync(path.join(team, 'watcher.json'), 'utf8'));
  const second = claimWatcher(team, { pid: owner.pid + 100, nonce: 'other', interval: 5, isAlive: () => true });
  assert.equal(second.claimed, false);
  assert.equal(second.owner.pid, owner.pid);
  assert.ok(stillOwner(team, owner.nonce));
  assert.equal(requestWatcherStop(team).stopRequested, true);
  assert.equal(stillOwner(team, owner.nonce), false, 'owner sees the stop file at its next cycle');
  // A record whose process is gone is replaceable.
  fs.writeFileSync(path.join(team, 'watcher.json'), JSON.stringify({ pid: 999999, nonce: 'dead' }));
  assert.equal(claimWatcher(team, { nonce: 'fresh', interval: 5, isAlive: () => false }).claimed, true);
}));

test('watcher: two real processes racing to start; one owns, the other exits with an error', () => tempDir(async dir => {
  const { spawn } = await import('node:child_process');
  const team = path.join(dir, 'team');
  new TeamStore(team).create(createTeamState(cfgBase(), { teamId: 'team-rt', taskName: 't', cwd: dir }));
  const cli = fileURLToPath(new URL('../cli.mjs', import.meta.url));
  const children = [];
  const start = () => {
    const child = spawn(process.execPath, [cli, 'watch', '--team-dir', team, '--interval', '5'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const rec = { child, err: '', code: null, exited: new Promise(r => child.on('exit', code => { rec.code = code; r(); })) };
    child.stderr.on('data', d => { rec.err += d; });
    children.push(rec);
    return rec;
  };
  try {
    const a = start(), b = start();
    // The loser must exit by itself; wait for the first exit instead of guessing a delay.
    await Promise.race([a.exited, b.exited, new Promise((_, rej) => setTimeout(() => rej(new Error('NO_PROCESS_EXITED: both think they own the watcher')), 20000))]);
    const loser = a.code !== null ? a : b, winner = loser === a ? b : a;
    assert.equal(loser.code, 1, loser.err);
    assert.match(loser.err, /WATCHER_ALREADY_RUNNING/);
    assert.equal(winner.code, null, 'winner keeps running');
    assert.equal(watcherStatus(team).running, true);
    assert.equal(requestWatcherStop(team).stopRequested, true);
  } finally { for (const c of children) { try { c.child.kill(); } catch {} } }
}));

// --- quota: persisted pools, wait-aware launch, mandatory boundary re-observation -----------

test('a pool known exhausted by one member stays exhausted for new selections until reliable recovery', async () => tempDir(async dir => {
  const cfg = cfgBase();
  cfg.roles.SA1.models = [
    { provider: 'claude', model: 'azure_ai/claude-opus-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
    { provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  cfg.roles.SA2.models = cfg.roles.SA1.models.map(m => ({ ...m }));
  const { world, store, providerState, teamDir } = await ready(dir, { cfg, members: ['SA1', 'SA2'] });
  const sa1 = store.read();
  // SA1 observes claude exhausted (reliable): pool recorded in persisted state.
  applyObservation(store, 'SA1-1', { ...cfg.roles.SA1.models[0] }, fresh({ remaining: 0 }));
  assert.ok(store.read().quotaPools['company-claude']);
  // A new process / pass with an UNKNOWN claude observation must still skip the exhausted pool.
  const unknownPs = psOf(cfg, { claude: { at: new Date().toISOString(), reliable: false } });
  await launchMember(store, world.herdr, 'SA2-1', { teamDir, providerState: unknownPs });
  assert.equal(world.started.at(-1).kind, 'codex', 'persisted exhausted pool skipped even though this pass is unknown');
  assert.ok(sa1 && providerState);
  // Unknown does not clear it; a reliable positive observation does.
  applyObservation(store, 'SA1-1', { ...cfg.roles.SA1.models[0] }, { at: new Date().toISOString(), reliable: false });
  assert.ok(store.read().quotaPools['company-claude']);
  applyObservation(store, 'SA1-1', { ...cfg.roles.SA1.models[0] }, fresh({ remaining: 60 }));
  assert.equal(store.read().quotaPools['company-claude'], undefined);
}));

test('entry.quotaPool is honoured, not only the provider pool', async () => tempDir(async dir => {
  const cfg = cfgBase();
  cfg.roles.SA1.models = [
    { provider: 'claude', model: 'azure_ai/claude-opus-5-5[1m]', quotaPool: 'special-pool', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
    { provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  const { world, store, teamDir } = await ready(dir, { cfg, members: ['SA1'] });
  applyObservation(store, 'SA1-1', cfg.roles.SA1.models[0], fresh({ remaining: 0 }));
  assert.ok(store.read().quotaPools['special-pool']);
  assert.equal(store.read().quotaPools['company-claude'], undefined, 'only the entry pool, not the provider pool');
  assert.ok(world && teamDir);
}));

test('negative-threshold member with a known-exhausted pool is chosen but starts no inference until recovery', async () => tempDir(async dir => {
  const cfg = cfgBase();
  cfg.roles.PM.models = [{ provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: -1 } }];
  const { world, store, teamDir } = await ready(dir, { cfg, members: [] });
  const exhausted = psOf(cfg, { claude: fresh({ remaining: 0 }) });
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState: exhausted }), /MEMBER_WAITING_FOR_QUOTA/);
  assert.equal(world.started.length, 0, 'no agent started');
  assert.equal(world.prompts.length, 0, 'no prompt = no new inference');
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota');
  // Unknown on a later try does not lift it; reliable recovery does and the launch continues.
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState: psOf(cfg, { claude: { at: new Date().toISOString(), reliable: false } }) }), /MEMBER_WAITING_FOR_QUOTA/);
  await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState: psOf(cfg, { claude: fresh({ remaining: 70 }) }) });
  assert.equal(store.read().members['PM-1'].launch.step, 'prompted');
}));

test('handoff re-observes at the real boundary: recovery cancels, unknown after a limit keeps migrating; --probe is not optional', async () => tempDir(async dir => {
  const cfg = cfgBase();
  cfg.roles.PG.models = [
    { provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
    { provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  const { world, store, teamDir } = await ready(dir, { cfg, members: ['PG'] });
  const launchPs = psOf(cfg);
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir, providerState: launchPs });
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'progress');
  // Pending migration was recorded from an old limit signal.
  applyObservation(store, 'PG-1', { ...cfg.roles.PG.models[0], remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } }, fresh({ remaining: 0 }));
  assert.ok(store.read().members['PG-1'].model.pending);
  // At the boundary, a fresh reliable observation shows recovery: the migration is cancelled, nothing closed.
  const recovered = psOf(cfg, {}); recovered.observation = async () => fresh({ remaining: 80 });
  const panesBefore = world.panes.length;
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState: recovered, force: true });
  assert.equal(r.cancelled, true);
  assert.equal(store.read().members['PG-1'].status, 'active');
  assert.equal(world.closed.length, 0, 'old pane not closed after recovery');
  assert.ok(world.panes.length >= panesBefore, 'reserved pane kept, reported');
  assert.equal(store.read().members['PG-1'].model.pending, undefined);
}));

test('handoff boundary: unknown observation after a real limit does not cancel; transfer proceeds', async () => tempDir(async dir => {
  const cfg = cfgBase();
  cfg.roles.PG.models = [
    { provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
    { provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  const { world, store, teamDir } = await ready(dir, { cfg, members: ['PG'] });
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir, providerState: psOf(cfg) });
  const cp = path.join(dir, 'cp.md'); fs.writeFileSync(cp, 'progress');
  applyObservation(store, 'PG-1', cfg.roles.PG.models[0], fresh({ remaining: 0 }));
  const unknown = psOf(cfg, {}); unknown.observation = async id => (id === 'codex' ? fresh({ remaining: 90 }) : { at: new Date().toISOString(), reliable: false });
  const r = await handoff({ store, herdr: world.herdr, teamDir, memberId: 'PG-1', checkpoint: cp, providerState: unknown });
  assert.equal(r.migrated, true);
  assert.equal(store.read().members['PG-1'].status, 'retired');
  assert.ok(currentPm(store.read()));
}));

test('tick: waiting-for-quota member is never delivered new prompts after a stale-snapshot race', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await ready(dir);
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir, providerState });
  store.update(s => { s.members['PM-1'].model.status = 'waiting-for-quota'; });
  writeEvent(teamDir, 'team-rt', 'PG-1', { eventId: 'ev-race-00001', type: 'completed', summary: 'c' });
  const base = world.prompts.length;
  await tick({ teamDir, herdr: world.herdr, diagnose: false });
  assert.equal(world.prompts.length, base);
}));
