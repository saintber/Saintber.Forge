import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamState, addInitialMembers, propose, decide, persistApprovedRoles, assign, applyEvent, overdue, extendDeadline, acceptCompletion, migrateMember, claimWrite, currentPm, TeamError } from '../lib/team.mjs';
import { exampleConfig } from './helpers.mjs';

const fresh = () => createTeamState(exampleConfig(), { teamId: 'team-t', taskName: '測試任務', cwd: '/w' });
const errCode = fn => { try { fn(); } catch (e) { return e.code ?? e.message; } assert.fail('expected error'); };
const qaRole = { displayName: 'QA', purpose: '驗證', responsibilities: ['驗證'], instructions: '只驗證。', deliverables: ['報告'], enabled: true, models: [] };
const proposal = extra => ({ gap: '缺驗證', whyNotExisting: 'PG 不能自己驗收', expectedUsage: '未知', scheduleImpact: '未知', members: [{ roleId: 'QA2', count: 1 }], newRoles: { QA2: qaRole }, ...extra });

test('PM is the configured pmRoleId and is the only PM', () => {
  const s = fresh();
  assert.equal(currentPm(s).roleId, 'PM');
  assert.equal(Object.values(s.members).length, 1);
  const config = exampleConfig(); config.roles.Lead = { ...config.roles.PM }; config.coordination.pmRoleId = 'Lead';
  assert.equal(currentPm(createTeamState(config, { taskName: 'x' })).roleId, 'Lead');
});

test('initial team: PM picks enabled roles; disabled or undefined roles are refused', () => {
  const s = fresh();
  assert.deepEqual(addInitialMembers(s, ['SA1', 'SA2']), ['SA1-1', 'SA2-1']);
  assert.equal(errCode(() => addInitialMembers(s, ['QA'])), 'ROLE_DISABLED');
  assert.equal(errCode(() => addInitialMembers(s, ['Nope'])), 'ROLE_NOT_DEFINED');
});

test('after work is assigned, any addition (even an existing role) needs an approved proposal', () => {
  const s = fresh(); addInitialMembers(s, ['SA1']);
  assign(s, { memberId: 'SA1-1', summary: 'x' });
  assert.equal(errCode(() => addInitialMembers(s, ['SA1'])), 'TEAM_FORMED_USE_PROPOSAL');
  const p = propose(s, proposal({ newRoles: {}, members: [{ roleId: 'SA1', count: 1 }] }));
  assert.equal(Object.keys(s.members).length, 2, 'pending proposal adds nobody');
  decide(s, p.requestId, { decision: 'approve', version: 1, source: 'user: 同意' });
  assert.ok(s.members['SA1-2']);
});

test('pending and rejected proposals change nothing', () => {
  const s = fresh();
  const before = JSON.stringify(s.config.roles);
  const p = propose(s, proposal());
  assert.equal(JSON.stringify(s.config.roles), before);
  decide(s, p.requestId, { decision: 'reject', version: 1, source: 'user: 不要' });
  assert.equal(JSON.stringify(s.config.roles), before);
  assert.equal(Object.keys(s.members).length, 1);
  assert.equal(errCode(() => decide(s, p.requestId, { decision: 'approve', version: 1, source: 'x' })), 'PROPOSAL_CLOSED');
});

test('approval applies exactly the approved version; a modified proposal needs a new approval', () => {
  const s = fresh();
  const p1 = propose(s, proposal({ requestId: 'req-a' }));
  const p2 = propose(s, proposal({ requestId: 'req-a', members: [{ roleId: 'QA2', count: 2 }] }));
  assert.equal(p2.version, 2);
  assert.equal(errCode(() => decide(s, 'req-a', { decision: 'approve', version: 1, source: 'user' })), 'PROPOSAL_VERSION_MISMATCH');
  const approval = decide(s, 'req-a', { decision: 'approve', version: 2, source: 'user: 同意兩位' });
  assert.deepEqual(approval.memberIds, ['QA2-1', 'QA2-2']);
  assert.equal(s.config.roles.QA2.displayName, 'QA');
  // Retrying the same approval does not add members again.
  decide(s, 'req-a', { decision: 'approve', version: 2, source: 'user: 同意兩位' });
  assert.equal(Object.keys(s.members).filter(id => id.startsWith('QA2-')).length, 2);
  assert.ok(p1);
});

test('role id conflict or a config change since proposal stops without overwriting', () => {
  let s = fresh();
  propose(s, proposal({ requestId: 'r', newRoles: { SA1: { ...qaRole, purpose: '別的用途' } }, members: [{ roleId: 'SA1', count: 1 }] }));
  assert.equal(errCode(() => decide(s, 'r', { decision: 'approve', version: 1, source: 'u' })), 'ROLE_ID_CONFLICT');
  assert.notEqual(s.config.roles.SA1.purpose, '別的用途');
  s = fresh();
  propose(s, proposal({ requestId: 'r' }));
  s.config.roles.SA1.purpose = 'changed elsewhere';
  assert.equal(errCode(() => decide(s, 'r', { decision: 'approve', version: 1, source: 'u' })), 'CONFIG_CHANGED_SINCE_PROPOSAL');
});

test('approved new role with empty models uses defaultModel; disabled approved role cannot start', () => {
  let s = fresh();
  propose(s, proposal({ requestId: 'r' }));
  decide(s, 'r', { decision: 'approve', version: 1, source: 'u' });
  assert.equal(s.members['QA2-1'].model.cursor, 0);
  s = fresh();
  propose(s, proposal({ requestId: 'r', newRoles: { QA2: { ...qaRole, enabled: false } } }));
  assert.equal(errCode(() => decide(s, 'r', { decision: 'approve', version: 1, source: 'u' })), 'APPROVED_ROLE_NOT_USABLE');
});

test('persisting to a shared config needs explicit permission and only adds approved roles', () => {
  const s = fresh();
  propose(s, proposal({ requestId: 'r' }));
  decide(s, 'r', { decision: 'approve', version: 1, source: 'u' });
  assert.equal(errCode(() => persistApprovedRoles(exampleConfig(), s, 'r')), 'PERSIST_NOT_APPROVED');
  const s2 = fresh();
  propose(s2, proposal({ requestId: 'r', persistToShared: true }));
  decide(s2, 'r', { decision: 'approve', version: 1, source: 'u', persistToShared: true });
  const shared = exampleConfig();
  const { config, added } = persistApprovedRoles(shared, s2, 'r');
  assert.deepEqual(added, ['QA2']);
  assert.deepEqual(config.roles.SA1, shared.roles.SA1);
});

test('deadlines: heartbeat never refreshes hard; substantive events do; PM extension is explicit', () => {
  const s = fresh(); addInitialMembers(s, ['PG']);
  const a = assign(s, { memberId: 'PG-1', summary: '實作', deadlines: { ackSeconds: 60, progressSeconds: 300, hardNoReportSeconds: 900 } });
  const t0 = Date.parse('2026-10-14T10:00:00Z');
  a.sentAt = new Date(t0).toISOString(); a.status = 'sent';
  assert.deepEqual(overdue(a, t0 + 61000), ['ack']);
  applyEvent(s, { eventId: 'e1', memberId: 'PG-1', taskId: a.taskId, type: 'ack' }, new Date(t0 + 30000).toISOString());
  for (let i = 1; i < 20; i++) applyEvent(s, { eventId: `h${i}`, memberId: 'PG-1', taskId: a.taskId, type: 'heartbeat' }, new Date(t0 + i * 50000).toISOString());
  assert.ok(overdue(a, t0 + 901000).includes('hard'));
  applyEvent(s, { eventId: 'e2', memberId: 'PG-1', taskId: a.taskId, type: 'progress' }, new Date(t0 + 800000).toISOString());
  assert.ok(!overdue(a, t0 + 901000).includes('hard'));
  extendDeadline(s, a.taskId, new Date(t0 + 5000000).toISOString());
  assert.ok(!overdue(a, t0 + 2000000).includes('hard'));
  applyEvent(s, { eventId: 'e3', memberId: 'PG-1', taskId: a.taskId, type: 'completed' }, new Date(t0 + 2100000).toISOString());
  assert.equal(a.status, 'completed-unverified', 'completion is not acceptance');
  acceptCompletion(s, a.taskId);
  assert.equal(a.status, 'accepted');
});

test('migration moves to the next entry only, transfers write scope and logical PM', () => {
  const s = fresh(); addInitialMembers(s, ['PG']);
  claimWrite(s, 'src/', 'PG-1');
  assert.equal(errCode(() => claimWrite(s, 'src/', 'PM-1')), 'WRITE_SCOPE_OWNED');
  const to = migrateMember(s, 'PG-1', { checkpoint: 'cp.md' });
  assert.equal(to.model.cursor, 1);
  assert.equal(s.writeOwners['src/'], to.memberId);
  assert.equal(s.members['PG-1'].status, 'retired');
  assert.equal(errCode(() => migrateMember(s, to.memberId)), 'NO_NEXT_MODEL_ENTRY');
  const pmTo = migrateMember(s, 'PM-1');
  assert.equal(currentPm(s).memberId, pmTo.memberId);
});

test('a waiting negative-threshold member is never replaced by migration (PM included)', () => {
  const config = exampleConfig();
  config.roles.PM.models[0].remainingThreshold.value = -1;
  const s = createTeamState(config, { taskName: 'x' });
  s.members['PM-1'].model.status = 'waiting-for-quota';
  assert.equal(errCode(() => migrateMember(s, 'PM-1')), 'NEGATIVE_THRESHOLD_WAITS');
  assert.equal(currentPm(s).memberId, 'PM-1');
});

test('defaultModel exhausted with no next entry pauses instead of borrowing', () => {
  const s = fresh(); addInitialMembers(s, ['SD2']);
  assert.equal(errCode(() => migrateMember(s, 'SD2-1')), 'NO_NEXT_MODEL_ENTRY');
  assert.equal(s.members['SD2-1'].model.status, 'no-next-entry');
});
