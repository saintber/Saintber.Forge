import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState, addInitialMembers, currentPm } from '../lib/team.mjs';
import { ensurePlacement, launchMember, tick, scanPaneLimits, autoHandoffPending } from '../lib/controller.mjs';
import { writeEvent } from '../lib/outbox.mjs';
import { classifyPaneText, observationFromPane } from '../lib/limitsignal.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const none = () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' });
const psOf = (cfg, observations = {}) => createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observations, observeFn: async provider => observations[provider.cli] ?? none() });

test('documented quota wording is a real limit; 429, 529, auth, network and context text are not', () => {
  for (const text of ["You've hit your session limit · resets 1pm", "You've hit your weekly limit · resets Mon 9am", "You've hit your Opus limit · resets 3pm"]) {
    assert.equal(classifyPaneText(text).kind, 'quota-exhausted', text);
  }
  for (const text of ["You've hit your monthly spend limit", "You've hit your org's monthly spend limit", "You've hit your team's shared budget", 'Credit balance is too low']) {
    assert.equal(classifyPaneText(text).kind, 'budget-blocked', 'a money stop is not a model usage limit: ' + text);
  }
  assert.equal(classifyPaneText("You've hit your session limit · resets 1pm").resetsText, '1pm');
  assert.equal(classifyPaneText('API Error: Request rejected (429) · this may be a temporary capacity issue').kind, 'rate-limited');
  assert.equal(classifyPaneText('API Error: Server is temporarily limiting requests (not your usage limit)').kind, 'rate-limited');
  assert.equal(classifyPaneText('API Error: Repeated 529 Overloaded errors').kind, 'overloaded');
  assert.equal(classifyPaneText('Invalid API key · please run /login').kind, 'auth');
  assert.equal(classifyPaneText("⎿ You've hit your weekly limit · resets Mon").kind, 'quota-exhausted');
  assert.equal(classifyPaneText("API Error: Request rejected (429)\n\n│ >            │\n").kind, 'rate-limited', 'trailing empty input box is ignored');
  assert.equal(classifyPaneText('API Error: connection lost mid-response').kind, 'network');
  assert.equal(classifyPaneText('Prompt is too long: context window is full').kind, 'context-full');
  assert.equal(classifyPaneText('working on the refactor…').kind, 'unknown');
  assert.equal(classifyPaneText('').kind, 'unknown');
});

test('only the pane tail counts: an old quota line far up in scrollback is not current', () => {
  const text = "You've hit your session limit · resets 1pm\n" + 'normal output line\n'.repeat(400);
  assert.equal(classifyPaneText(text).kind, 'unknown');
});

test('a quota line explained as "not your usage limit" is not quota', () => {
  assert.equal(classifyPaneText("You've hit your session limit\nAPI Error: Server is temporarily limiting requests (not your usage limit)").kind, 'rate-limited');
});

test('observations: non-quota errors are unreliable signals, unknown records nothing', () => {
  assert.equal(observationFromPane(classifyPaneText('API Error: Repeated 529 Overloaded errors')).signal, 'rate-limited');
  assert.equal(observationFromPane(classifyPaneText('hello')), null);
  const q = observationFromPane(classifyPaneText("You've hit your weekly limit · resets Mon"));
  assert.equal(q.reliable, true);
  assert.equal(q.signal, 'quota-exhausted');
});

async function pmTeam(dir, { pmThreshold = 0, withCheckpoint = false } = {}) {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  cfg.roles.PM.models = [
    { provider: 'claude', model: 'azure_ai/claude-sonnet-5-5[1m]', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: pmThreshold } },
    { provider: 'codex', model: 'gpt-6.1-sol', enabled: true, remainingThreshold: { metric: 'quotaRemainingPercent', value: 0 } },
  ];
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-lim', taskName: '限額', cwd: dir }));
  const providerState = psOf(cfg, { codex: { at: new Date().toISOString(), reliable: true, windows: [{ usedPercent: 10 }] } });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  await launchMember(store, world.herdr, 'PM-1', { teamDir: store.dir, providerState });
  const cp = path.join(dir, 'pm-checkpoint.md');
  if (withCheckpoint) {
    fs.writeFileSync(cp, '# PM 進度\n- 已派工 A');
    writeEvent(store.dir, 'team-lim', 'PM-1', { eventId: 'ev-checkpoint-1', type: 'checkpoint', summary: 'PM 檢查點', paths: [cp] });
  }
  return { cfg, world, store, teamDir: store.dir, providerState, cp };
}

test('PM at its real limit (Claude, no numeric adapter): watcher reads the pane, hands off with a checkpoint, no prompt to the PM', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pm = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  pm.screen = "work…\nYou've hit your session limit · resets 1pm\n";
  const promptsBefore = world.prompts.length;
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(r.limitScan['PM-1'].kind, 'quota-exhausted');
  assert.equal(r.limitScan['PM-1'].verdict, 'switch');
  assert.ok(store.read().members['PM-1'].checkpoint.path, 'checkpoint recorded from the PM event');
  assert.equal(r.takeover[0].started, true, JSON.stringify(r.takeover));
  const s = store.read();
  assert.equal(s.members['PM-1'].status, 'retired');
  assert.notEqual(currentPm(s).memberId, 'PM-1');
  assert.equal(currentPm(s).model.cursor, 1, 'next entry on a different provider');
  assert.ok(s.quotaPools['company-claude'], 'exhausted pool persisted');
  const toExhausted = world.prompts.slice(promptsBefore).filter(p => p.target === pm.pane_id && !/停止寫入|將被接替/.test(p.text));
  assert.equal(toExhausted.length, 0, 'the exhausted PM is never asked anything');
}));

test('PM at its real limit with NO checkpoint: blocked with an explicit reason, nothing claimed as handed over', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: false });
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).screen = "You've hit your weekly limit · resets Mon";
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.deepEqual(r.takeover.map(t => [t.memberId, t.started, t.blocked]), [['PM-1', false, 'NO_CHECKPOINT']]);
  const s = store.read();
  assert.equal(s.members['PM-1'].status, 'active');
  assert.equal(currentPm(s).memberId, 'PM-1');
  assert.equal(s.members['PM-1'].autoHandoff.blocked, 'NO_CHECKPOINT');
  assert.equal(s.handoffs, undefined);
}));

test('negative-threshold PM at its real limit keeps waiting and is never replaced', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { pmThreshold: -1, withCheckpoint: true });
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).screen = "You've hit your session limit · resets 1pm";
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(r.limitScan['PM-1'].verdict, 'wait');
  assert.equal(r.takeover.length, 0);
  assert.equal(store.read().members['PM-1'].model.status, 'waiting-for-quota');
  assert.equal(currentPm(store.read()).memberId, 'PM-1');
}));

test('429 / 529 / network text never changes the model or starts a handoff', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  for (const text of ['API Error: Request rejected (429) · this may be a temporary capacity issue', 'API Error: Repeated 529 Overloaded errors', 'API Error: connection lost mid-response', 'context window is full']) {
    pane.screen = text;
    const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
    assert.equal(r.takeover.length, 0, text);
    assert.equal(store.read().members['PM-1'].status, 'active', text);
    assert.equal(store.read().members['PM-1'].model.pending ?? null, null, text);
  }
}));

test('unrecognised pane text stays unknown: nothing is recorded or changed', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir);
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).screen = 'some new wording we do not know';
  const before = JSON.stringify(store.read().members['PM-1'].model);
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.deepEqual(r.limitScan, {});
  assert.equal(JSON.stringify(store.read().members['PM-1'].model), before);
}));

test('scanning is off unless requested, and a checkpoint event needs an existing file', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir);
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).screen = "You've hit your session limit";
  const off = await scanPaneLimits({ store, herdr: world.herdr, state: store.read(), scan: false });
  assert.equal(off.changed, false);
  writeEvent(teamDir, 'team-lim', 'PM-1', { eventId: 'ev-badcp-0001', type: 'checkpoint', summary: 'x', paths: [path.join(dir, 'missing.md')] });
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, providerState });
  assert.equal(r.applyErrors[0].error.includes('CHECKPOINT_FILE_MISSING'), true);
  assert.equal(store.read().members['PM-1'].checkpoint, undefined);
  assert.ok(autoHandoffPending);
}));

const QUOTES = [
  "assert.equal(classifyPaneText(\"You've hit your weekly limit\").kind, 'quota-exhausted');",
  "> You've hit your session limit · resets 1pm",
  "// when the user sees \"You've hit your weekly limit\" we switch",
  "- Error text: You've hit your weekly limit",
  "const msg = \"You've hit your session limit\";",
  "\"You've hit your session limit\" is the documented wording",
  "| You've hit your weekly limit | quota |",
];

test('work output that quotes limit wording (docs, tests, code, lists) is never a provider signal', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  for (const quote of QUOTES) {
    pane.screen = 'Writing the design document now…' + String.fromCharCode(10) + quote + String.fromCharCode(10) + 'next paragraph about thresholds';
    const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
    assert.deepEqual(r.limitScan, {}, quote);
    assert.equal(r.takeover.length, 0, quote);
  }
  // Even the exact message is ignored when it is buried mid-output instead of ending the screen.
  pane.screen = "You've hit your weekly limit · resets Mon" + String.fromCharCode(10) + 'ordinary work output'.concat(String.fromCharCode(10)).repeat(30);
  assert.deepEqual((await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState })).limitScan, {});
  assert.equal(store.read().members['PM-1'].status, 'active');
  assert.equal(store.read().members['PM-1'].model.pending ?? null, null);
}));

test('a pane whose session or agent kind changed is not the member we started: nothing is triggered', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  pane.screen = "You've hit your session limit · resets 1pm";
  pane.agent_session = { value: 'a-different-session' };
  let r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.deepEqual(r.limitScan, {}, 'different session');
  pane.agent_session = { value: store.read().members['PM-1'].agent.session };
  pane.agent = 'codex';
  r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.deepEqual(r.limitScan, {}, 'different agent kind');
  assert.equal(store.read().members['PM-1'].status, 'active');
  assert.equal(world.closed.length, 0, 'no pane is ever closed on unproven text');
}));

test('budget / credit stops only pause and report: no migration, no new pane, no other quota spent', async () => tempDir(async dir => {
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  const panes = world.panes.length;
  for (const text of ["You've hit your monthly spend limit", "You've hit your team's shared budget", 'Credit balance is too low']) {
    pane.screen = text;
    const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
    assert.equal(r.limitScan['PM-1'].verdict, 'report-only', text);
    assert.equal(r.takeover.length, 0, text);
  }
  const s = store.read();
  assert.ok(s.members['PM-1'].budgetBlocked, 'reported for the PM / user');
  assert.equal(s.members['PM-1'].status, 'active');
  assert.equal(s.members['PM-1'].model.cursor, 0, 'model not changed');
  assert.equal(s.members['PM-1'].model.pending ?? null, null);
  assert.equal(s.quotaPools ?? undefined, undefined, 'no pool recorded as exhausted');
  assert.equal(world.panes.length, panes);
  assert.equal(world.started.length, 1, 'only the original PM was ever started');
}));

test('a gateway "Model is blocked" 403 is reported as model-blocked: not quota, not login, never a model switch', async () => tempDir(async dir => {
  for (const text of ['litellm.PermissionDeniedError: Model is blocked for this key', "This key can only access models=['azure_ai/claude-opus-5-5']; Tried to access azuer_ai/sonnet-5-5"]) {
    assert.equal(classifyPaneText(text).kind, 'model-blocked', text);
    assert.equal(observationFromPane(classifyPaneText(text)), null, 'records no model-state observation');
  }
  const { world, store, teamDir, providerState } = await pmTeam(dir, { withCheckpoint: true });
  const pane = world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId);
  const panes = world.panes.length;
  pane.screen = 'litellm.PermissionDeniedError: Model is blocked for this key';
  const r = await tick({ teamDir, herdr: world.herdr, diagnose: false, scanLimits: true, providerState });
  assert.equal(r.limitScan['PM-1'].verdict, 'report-only');
  assert.equal(r.takeover.length, 0, 'no automatic takeover for a blocked model');
  const s = store.read();
  assert.ok(s.members['PM-1'].modelBlocked);
  assert.equal(s.members['PM-1'].model.cursor, 0);
  assert.equal(s.members['PM-1'].model.pending ?? null, null);
  assert.equal(s.quotaPools ?? undefined, undefined);
  assert.equal(world.panes.length, panes);
  assert.equal(world.started.length, 1);
  // The PM (idle, a different member) is told through the journal; the text says it is not quota or login.
  const told = world.prompts.filter(x => /模型被閘道拒絕/.test(x.text));
  assert.equal(told.length, 1);
  assert.match(told[0].text, /不是額度，也不是登入問題/);
}));
