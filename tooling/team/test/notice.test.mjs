import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, assign, currentPm } from '../lib/team.mjs';
import { ensurePlacement, launchMember, tick, attention, collectNotices } from '../lib/controller.mjs';
import { writeEvent } from '../lib/outbox.mjs';
import { loadDelivery } from '../lib/sender.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const none = () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' });
const fast = { waitSessionPollMs: 5 };

async function team(dir) {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-nt', taskName: '通知', cwd: dir }));
  store.update(s => { addInitialMembers(s, ['PG']); });
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async () => none() });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  for (const id of ['PM-1', 'PG-1']) await launchMember(store, world.herdr, id, { teamDir: store.dir, providerState, ...fast });
  const pane = id => world.panes.find(p => p.pane_id === store.read().members[id].paneId);
  return { world, store, teamDir: store.dir, providerState, pane };
}
const overdue = (store, hard = 3) => store.update(s => { const a = assign(s, { memberId: 'PG-1', summary: '實作', taskId: 'task-1', deadlines: { ackSeconds: 1, progressSeconds: 2, hardNoReportSeconds: hard } }); a.sentAt = new Date(Date.now() - 60000).toISOString(); a.status = 'sent'; });
const NOTICE_MARKS = ['[逾期診斷]', '[卡住]', '[自動交接受阻]', '[預算／餘額停止]', '[模型被閘道拒絕]', '[交接受阻]'];
const noticePrompts = world => world.prompts.filter(p => NOTICE_MARKS.some(m => p.text.includes(m)));

test('an overdue diagnosis is queued to the logical PM through the delivery journal, once per cause', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  overdue(store);
  pane('PG-1').agent_status = 'blocked'; pane('PG-1').screen = 'Do you want to allow this command? permission';
  const r = await tick({ teamDir, herdr: world.herdr });
  assert.equal(r.late[0].classification, 'permission-blocked');
  const sent = noticePrompts(world);
  // Two different facts reach the PM: "blocked right now" and "overdue, classified as permission-blocked".
  const kinds = sent.map(x => ['[卡住]', '[逾期診斷]'].find(m => x.text.includes(m))).sort();
  assert.deepEqual(kinds, ['[卡住]', '[逾期診斷]']);
  for (const x of sent) { assert.equal(x.target, store.read().members['PM-1'].paneId); assert.match(x.text, /permission-blocked/); assert.match(x.text, /最小規則/); }
  const recs = Object.values(loadDelivery(teamDir).records).filter(x => x.kind === 'notice');
  assert.equal(recs.length, 2);
  assert.ok(recs.every(x => x.state === 'sent'));
  // The same causes never produce more notices.
  await tick({ teamDir, herdr: world.herdr });
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 2);
  assert.equal(Object.values(loadDelivery(teamDir).records).filter(x => x.kind === 'notice').length, 2);
}));

test('PM busy: the notice waits in the journal and is delivered when the PM is idle', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  overdue(store);
  pane('PG-1').agent_status = 'blocked'; pane('PG-1').screen = 'permission needed';
  pane('PM-1').agent_status = 'working';
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 0);
  assert.equal(attention(store.read(), teamDir)[0].delivery, 'queued', 'visible as unsent in the attention list');
  assert.equal(attention(store.read(), teamDir).length, 2, 'blocked-now and overdue are both waiting');
  pane('PM-1').agent_status = 'idle';
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 2);
  assert.deepEqual(attention(store.read(), teamDir), []);
}));

test('notify failed / not accepted are reported with their classification', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  overdue(store);
  pane('PG-1').agent_status = 'idle';
  fs.mkdirSync(path.join(teamDir, 'outbox', 'PG-1'), { recursive: true });
  fs.writeFileSync(path.join(teamDir, 'outbox', 'PG-1', 'ev-stuck-00001.json'), '{ not a valid event');
  await tick({ teamDir, herdr: world.herdr });
  const text = noticePrompts(world)[0].text;
  assert.match(text, /PG-1 task-1/);
  assert.match(text, /idle-no-report|notify-failed-or-pending/);
}));

test('an automatic takeover blocked for NO_CHECKPOINT reaches the PM, once', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, pane } = await team(dir);
  pane('PG-1').screen = "You've hit your session limit · resets 1pm";
  const pg = store.read().members['PG-1'];
  assert.equal(pg.checkpoint, undefined);
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(r.takeover[0].blocked, 'NO_CHECKPOINT');
  const sent = noticePrompts(world);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /自動交接受阻.*PG-1.*NO_CHECKPOINT/s);
  assert.equal(sent[0].target, store.read().members['PM-1'].paneId);
  await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(noticePrompts(world).length, 1, 'same cause, no second notice');
}));

test('the PM itself cannot be told: nothing is claimed as reported and the blocked state stays visible', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, pane } = await team(dir);
  const pm = pane('PM-1');
  pm.screen = "You've hit your weekly limit · resets Mon"; // the PM is the exhausted one, no checkpoint
  pm.agent_status = 'working'; // it is busy on its own limit message: it cannot take a prompt
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(r.takeover[0].memberId, 'PM-1');
  assert.equal(r.takeover[0].blocked, 'NO_CHECKPOINT');
  await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  const rec = Object.values(loadDelivery(teamDir).records).find(x => x.kind === 'notice');
  assert.notEqual(rec?.state, 'sent');
  assert.notEqual(rec?.state, 'received');
  const visible = attention(store.read(), teamDir);
  assert.equal(visible.length, 1);
  assert.match(visible[0].text, /PM-1.*NO_CHECKPOINT/s);
  assert.equal(currentPm(store.read()).memberId, 'PM-1', 'still the PM; nothing was handed over');
}));

test('a role still inside its soft deadlines and working raises no alarm', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  overdue(store, 100000); // hard deadline far away; ack/progress are overdue
  pane('PG-1').agent_status = 'working';
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 0);
  assert.deepEqual(collectNotices(store.read()), []);
}));

// --- immediate blocked diagnosis (design 7.3) -------------------------------------------------

test('a blocked member with NO assignment and no overdue is diagnosed at once and the PM is told, once per episode', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  pane('PG-1').agent_status = 'blocked'; pane('PG-1').screen = 'Do you want to allow this command?';
  const r = await tick({ teamDir, herdr: world.herdr });
  assert.equal(r.blockedNow['PG-1'].classification, 'permission-blocked');
  assert.equal(r.late.length, 0, 'nothing is overdue: this is not the deadline path');
  const sent = noticePrompts(world);
  assert.equal(sent.length, 1);
  assert.ok(sent[0].text.includes('[卡住] PG-1: permission-blocked'));
  assert.match(sent[0].text, /不要代為核准/);
  await tick({ teamDir, herdr: world.herdr });
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 1, 'same episode, one notice');
  // Nothing was answered, changed or closed.
  assert.equal(world.keys?.length ?? 0, 0);
  assert.equal(store.read().members['PG-1'].model.cursor, 0);
  assert.equal(world.closed.length, 0);
}));

test('a new blocking episode after the member recovered gets a new round and a new notice', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  pane('PG-1').agent_status = 'blocked'; pane('PG-1').screen = 'permission needed';
  await tick({ teamDir, herdr: world.herdr });
  pane('PG-1').agent_status = 'idle';
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(store.read().members['PG-1'].blockedNow, undefined, 'episode closed');
  assert.equal(store.read().members['PG-1'].blockedHistory.length, 1);
  pane('PG-1').agent_status = 'blocked';
  await tick({ teamDir, herdr: world.herdr });
  assert.equal(noticePrompts(world).length, 2, 'a second episode is a new round');
  assert.equal(store.read().members['PG-1'].blockedNow.episode, 2);
}));

test('a pane whose session or kind is not the one we started is never diagnosed as blocked', async () => tempDir(async dir => {
  const { world, store, teamDir, pane } = await team(dir);
  pane('PG-1').agent_status = 'blocked'; pane('PG-1').agent_session = { value: 'someone-else' };
  const r = await tick({ teamDir, herdr: world.herdr });
  assert.deepEqual(r.blockedNow, {});
  assert.equal(noticePrompts(world).length, 0);
  assert.equal(store.read().members['PG-1'].blockedNow, undefined);
}));

// --- notice de-duplication (same episode = same session + cursor + cause) ---------------------

test('the same model-blocked / budget-blocked screen on consecutive ticks yields exactly one notice', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, pane } = await team(dir);
  const screens = [['litellm.PermissionDeniedError: Model is blocked for this key', '[模型被閘道拒絕]'], ["You've hit your monthly spend limit", '[預算／餘額停止]']];
  for (const [screen, pattern] of screens) {
    pane('PG-1').screen = screen;
    const before = world.prompts.filter(x => x.text.includes(pattern)).length;
    for (let i = 0; i < 4; i++) await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
    assert.equal(world.prompts.filter(x => x.text.includes(pattern)).length - before, 1, screen);
  }
  const m = store.read().members['PG-1'];
  assert.ok(m.modelBlocked.lastSeenAt >= m.modelBlocked.at, 'first seen is kept; only lastSeenAt moves');
  assert.equal(Object.values(loadDelivery(teamDir).records).filter(x => x.type === 'model-blocked').length, 1);
  assert.equal(Object.values(loadDelivery(teamDir).records).filter(x => x.type === 'budget-blocked').length, 1);
}));

test('a different cause or a new model cursor is a new episode and is reported again', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState, pane } = await team(dir);
  pane('PG-1').screen = 'litellm.PermissionDeniedError: Model is blocked for this key';
  await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  const first = store.read().members['PG-1'].modelBlocked.key;
  store.update(s => { s.members['PG-1'].model.cursor = 1; });
  await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.notEqual(store.read().members['PG-1'].modelBlocked.key, first);
  assert.equal(Object.values(loadDelivery(teamDir).records).filter(x => x.type === 'model-blocked').length, 2);
}));
