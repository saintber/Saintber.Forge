import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { TeamStore } from '../lib/store.mjs';
import { createTeamState } from '../lib/team.mjs';
import { ensurePlacement, launchMember } from '../lib/controller.mjs';
import { createProviderState } from '../lib/selection.mjs';
import { tempDir, exampleConfig } from './helpers.mjs';
import { fakeHerdrWorld } from './fake-herdr.mjs';

const okAuth = { resolve: () => ({ file: 'x', prefix: [] }), exec: async () => ({ code: 0, stdout: 'Logged in using ChatGPT', stderr: '' }), env: {} };
const none = () => ({ at: new Date().toISOString(), reliable: false, source: 'test:none' });

async function ready(dir) {
  const cfg = exampleConfig(); cfg.providers.codex.enabled = true;
  const world = fakeHerdrWorld();
  const store = new TeamStore(path.join(dir, 'team'));
  store.create(createTeamState(cfg, { teamId: 'team-ln', taskName: '啟動', cwd: dir }));
  const providerState = createProviderState({ config: cfg, authDeps: okAuth, observeDeps: {}, observeFn: async () => none() });
  await ensurePlacement(store, world.herdr, { tab: 'Existing', env: { HERDR_WORKSPACE_ID: 'w3' } });
  return { world, store, providerState, teamDir: store.dir };
}
const fast = { waitSessionPollMs: 5 };

test('the session id appears a moment after start: a bounded wait confirms it without any prompt or restart', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.sessionDelayReads = 4; // pane reads that still show no session
  const m = await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 2000, ...fast });
  assert.equal(m.launch.step, 'prompted');
  assert.equal(world.started.length, 1, 'the agent was started exactly once');
  assert.match(m.agent.session, /^sess-/);
}));

test('a session that never appears fails with AGENT_NOT_CONFIRMED and a rerun resumes without starting a second agent', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.sessionDelayReads = 1000;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 60, ...fast }), /AGENT_NOT_CONFIRMED/);
  assert.equal(store.read().members['PM-1'].launch.step, 'pane-created');
  assert.ok(store.read().members['PM-1'].launch.startIntent, 'start intent journaled');
  assert.equal(world.prompts.length, 0, 'no prompt while unconfirmed');
  // The session shows up later; the rerun adopts the agent WE started, no second start.
  world.panes.find(p => p.pane_id === store.read().members['PM-1'].paneId).pendingSession.reads = 0;
  const m = await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 500, ...fast });
  assert.equal(m.launch.step, 'prompted');
  assert.equal(world.started.length, 1);
}));

test('start succeeded but the call was interrupted: rerun recognises its own agent from the journal and continues', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.failAfterStart = true; // the start call times out after the agent is really running
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 200, ...fast }), /HERDR_TIMEOUT/);
  const mid = store.read().members['PM-1'];
  assert.equal(mid.launch.step, 'pane-created');
  assert.equal(mid.agent, null, 'session not saved yet');
  assert.equal(mid.launch.startIntent.paneId, mid.paneId);
  assert.match(mid.launch.startIntent.agentName, /^[a-z][a-z0-9_-]{0,31}$/);
  const m = await launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 500, ...fast });
  assert.equal(m.launch.step, 'prompted');
  assert.equal(world.started.length, 1, 'never started twice');
  assert.equal(m.agent.kind, 'claude');
}));

test('an agent we did not start (no journaled intent for this pane) is never adopted', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  // Create the pane through the normal path, then put someone else's agent into it.
  world.failGridOnce = false;
  store.update(s => { s.members['PM-1'].launch.step = 'pane-created'; s.members['PM-1'].paneId = 'w3:p1'; s.members['PM-1'].agentName = 'whatever-pm-1-aaaaaaaa'; s.members['PM-1'].model.status = 'active'; });
  // w3:p1 is the fake user's pane: it already runs a claude agent.
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /PANE_HAS_FOREIGN_AGENT/);
  assert.equal(world.started.length, 0);
  assert.equal(world.prompts.length, 0);
}));

test('the previous agent exits and a foreign agent of the SAME kind takes the pane: the journal alone does not authorise it', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.failAfterStart = true;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /HERDR_TIMEOUT/);
  const pane = world.panes.find(x => x.pane_id === store.read().members['PM-1'].paneId);
  assert.equal(pane.agent_name, store.read().members['PM-1'].agentName);
  // Our agent is gone; someone else starts a claude agent (different name, new session) in that pane.
  pane.agent_name = 'somebody-elses-agent'; pane.agent_session = { value: 'foreign-session' };
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /PANE_HAS_FOREIGN_AGENT/);
  assert.equal(world.prompts.length, 0, 'nothing is sent to a foreign agent');
  assert.equal(world.started.length, 1);
}));

test('an agent with no name at all (cannot be proved ours) is never adopted, even in the journaled pane', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.failAfterStart = true;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /HERDR_TIMEOUT/);
  delete world.panes.find(x => x.pane_id === store.read().members['PM-1'].paneId).agent_name;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /PANE_HAS_FOREIGN_AGENT/);
}));

test('the bounded wait also requires the live name: a foreign agent appearing during the wait is not accepted', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  world.sessionDelayReads = 1000;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 80, ...fast }), /AGENT_NOT_CONFIRMED/);
  const pane = world.panes.find(x => x.pane_id === store.read().members['PM-1'].paneId);
  pane.agent_name = 'not-ours'; pane.agent_session = { value: 'other' }; delete pane.pendingSession;
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 80, ...fast }), /PANE_HAS_FOREIGN_AGENT|AGENT_NOT_CONFIRMED/);
  assert.equal(store.read().members['PM-1'].agent, null);
}));

test('a journaled intent for another pane or agent kind does not authorise adopting this agent', async () => tempDir(async dir => {
  const { world, store, providerState, teamDir } = await ready(dir);
  store.update(s => {
    const m = s.members['PM-1']; m.launch.step = 'pane-created'; m.paneId = 'w3:p1'; m.agentName = 'x-pm-1-aaaaaaaa'; m.model.status = 'active';
    m.launch.startIntent = { agentName: 'x-pm-1-aaaaaaaa', kind: 'claude', paneId: 'w3:p9', sessionBefore: null, at: new Date().toISOString() };
  });
  await assert.rejects(launchMember(store, world.herdr, 'PM-1', { teamDir, providerState, waitSessionMs: 100, ...fast }), /PANE_HAS_FOREIGN_AGENT/);
}));
