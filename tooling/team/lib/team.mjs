// Team state transitions: members, logical PM, expansion proposals/approvals, assignments,
// model migration and write ownership. Pure functions over a state object; callers persist
// through TeamStore.update so every change is atomic and revisioned.
import { createHash, randomUUID } from 'node:crypto';
import { validateConfig, validateRole, effectiveModels, roleDefined, ConfigError } from './config.mjs';

export class TeamError extends Error {
  constructor(code, detail) { super(`${code}${detail ? `: ${detail}` : ''}`); this.code = code; }
}

const nowIso = clock => new Date(clock ? clock() : Date.now()).toISOString();
export const hashJson = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const DEFAULT_DEADLINES = { ackSeconds: 60, progressSeconds: 300, hardNoReportSeconds: 900 };

export function createTeamState(config, { teamId = `team-${randomUUID().slice(0, 8)}`, taskName, taskFile, cwd, clock } = {}) {
  validateConfig(config);
  if (!taskName || typeof taskName !== 'string') throw new TeamError('TASK_NAME_REQUIRED');
  const pmRoleId = config.coordination.pmRoleId;
  const state = {
    schemaVersion: 1, teamId, task: { name: taskName, file: taskFile ?? null }, cwd,
    createdAt: nowIso(clock), config: structuredClone(config), forming: true,
    placement: null, pm: { memberId: null }, members: {}, proposals: {}, approvals: {},
    assignments: {}, writeOwners: {}, seq: 0,
  };
  const pm = addMember(state, pmRoleId, { origin: 'initial' });
  state.pm.memberId = pm.memberId;
  return state;
}

function nextMemberId(state, roleId) {
  const used = new Set(Object.keys(state.members));
  for (let n = 1; ; n++) { const id = `${roleId}-${n}`; if (!used.has(id)) return id; }
}

function addMember(state, roleId, { origin, cursor = 0, predecessor = null }) {
  const models = effectiveModels(state.config, roleId); // throws for undefined or disabled roles
  if (cursor >= models.length) throw new TeamError('NO_NEXT_MODEL_ENTRY', roleId);
  const memberId = nextMemberId(state, roleId);
  state.members[memberId] = {
    memberId, roleId, origin, predecessor, status: 'planned', paneId: null, agent: null,
    model: { cursor, status: 'active', pending: null }, launch: { step: 'planned', attempts: 0 },
  };
  return state.members[memberId];
}

// Initial team: PM picks from enabled configured roles while the team is still forming.
export function addInitialMembers(state, roleIds) {
  if (!state.forming) throw new TeamError('TEAM_FORMED_USE_PROPOSAL');
  return roleIds.map(roleId => {
    if (!roleDefined(state.config, roleId)) throw new TeamError('ROLE_NOT_DEFINED', roleId);
    if (state.config.roles[roleId].enabled !== true) throw new TeamError('ROLE_DISABLED', roleId);
    return addMember(state, roleId, { origin: 'initial' }).memberId;
  });
}

export function closeForming(state) { state.forming = false; }

// --- Expansion: proposal -> user decision -> validated apply (§3.3) ---------------------

const REQUIRED_PROPOSAL_TEXT = ['gap', 'whyNotExisting', 'expectedUsage', 'scheduleImpact'];

export function propose(state, input, { clock } = {}) {
  for (const f of REQUIRED_PROPOSAL_TEXT) if (typeof input[f] !== 'string' || !input[f].trim()) throw new TeamError('PROPOSAL_FIELD_MISSING', f);
  const newRoles = input.newRoles ?? {};
  const members = input.members ?? [];
  if (!members.length) throw new TeamError('PROPOSAL_NO_MEMBERS');
  for (const [roleId, role] of Object.entries(newRoles)) {
    try { validateRole(roleId, role, state.config.providers); } catch (e) { throw new TeamError('PROPOSAL_ROLE_INVALID', e.message); }
  }
  for (const m of members) {
    if (!Number.isInteger(m.count) || m.count < 1) throw new TeamError('PROPOSAL_COUNT_INVALID', m.roleId);
    if (!Object.hasOwn(newRoles, m.roleId) && !roleDefined(state.config, m.roleId)) throw new TeamError('ROLE_NOT_DEFINED', m.roleId);
  }
  const requestId = input.requestId ?? `req-${++state.seq}`;
  const previous = state.proposals[requestId];
  if (previous && previous.status !== 'pending') throw new TeamError('PROPOSAL_CLOSED', requestId);
  const scope = { newRoles, members, permissions: input.permissions ?? null, persistToShared: input.persistToShared === true };
  state.proposals[requestId] = {
    requestId, version: previous ? previous.version + 1 : 1, status: 'pending', proposedAt: nowIso(clock),
    text: Object.fromEntries(REQUIRED_PROPOSAL_TEXT.map(f => [f, input[f]])), scope,
    scopeHash: hashJson(scope), configHash: hashJson(state.config.roles),
  };
  return state.proposals[requestId];
}

// decision: { decision: 'approve'|'reject', version, source, persistToShared? }.
// Waiting is not approval; the decision must name the exact version it approves.
export function decide(state, requestId, decision, { clock } = {}) {
  const proposal = state.proposals[requestId];
  if (!proposal) throw new TeamError('PROPOSAL_NOT_FOUND', requestId);
  if (!decision.source || typeof decision.source !== 'string') throw new TeamError('DECISION_SOURCE_REQUIRED');
  if (decision.version !== proposal.version) throw new TeamError('PROPOSAL_VERSION_MISMATCH', `approved v${decision.version}, current v${proposal.version}`);
  if (proposal.status === 'approved' && decision.decision === 'approve') return state.approvals[requestId]; // idempotent retry
  if (proposal.status !== 'pending') throw new TeamError('PROPOSAL_CLOSED', requestId);
  if (decision.decision === 'reject') {
    proposal.status = 'rejected'; proposal.decidedAt = nowIso(clock); proposal.source = decision.source;
    return null;
  }
  if (decision.decision !== 'approve') throw new TeamError('DECISION_INVALID', decision.decision);
  if (hashJson(state.config.roles) !== proposal.configHash) throw new TeamError('CONFIG_CHANGED_SINCE_PROPOSAL', requestId);
  for (const [roleId, role] of Object.entries(proposal.scope.newRoles)) {
    const existing = roleDefined(state.config, roleId) ? state.config.roles[roleId] : null;
    if (existing && hashJson(existing) !== hashJson(role)) throw new TeamError('ROLE_ID_CONFLICT', roleId);
  }
  // Apply exactly the approved scope.
  for (const [roleId, role] of Object.entries(proposal.scope.newRoles)) state.config.roles[roleId] = structuredClone(role);
  const added = [];
  try {
    for (const m of proposal.scope.members) for (let i = 0; i < m.count; i++) added.push(addMember(state, m.roleId, { origin: `approval:${requestId}` }).memberId);
  } catch (error) {
    throw error instanceof ConfigError ? new TeamError('APPROVED_ROLE_NOT_USABLE', error.message) : error;
  }
  proposal.status = 'approved'; proposal.decidedAt = nowIso(clock); proposal.source = decision.source;
  state.approvals[requestId] = {
    requestId, version: proposal.version, scopeHash: proposal.scopeHash, source: decision.source, decidedAt: proposal.decidedAt,
    approvedRoles: Object.keys(proposal.scope.newRoles), approvedMembers: proposal.scope.members,
    persistToShared: decision.persistToShared === true && proposal.scope.persistToShared === true, memberIds: added,
  };
  return state.approvals[requestId];
}

// Persisting approved roles to a shared config needs its own explicit permission and adds only
// approved definitions; an existing different definition is a conflict, never overwritten.
export function persistApprovedRoles(sharedConfig, state, requestId) {
  const approval = state.approvals[requestId];
  if (!approval) throw new TeamError('APPROVAL_NOT_FOUND', requestId);
  if (!approval.persistToShared) throw new TeamError('PERSIST_NOT_APPROVED', requestId);
  const next = structuredClone(sharedConfig);
  const added = [];
  for (const roleId of approval.approvedRoles) {
    const role = state.config.roles[roleId];
    const existing = Object.hasOwn(next.roles, roleId) ? next.roles[roleId] : null;
    if (existing && hashJson(existing) !== hashJson(role)) throw new TeamError('ROLE_ID_CONFLICT', roleId);
    if (!existing) { next.roles[roleId] = structuredClone(role); added.push(roleId); }
  }
  validateConfig(next);
  return { config: next, added };
}

// --- Assignments and reporting deadlines (§7.2) ----------------------------------------

export function assign(state, { memberId, summary, taskId, deadlines, clock }) {
  const member = state.members[memberId];
  if (!member) throw new TeamError('MEMBER_NOT_FOUND', memberId);
  if (['retired', 'failed'].includes(member.status)) throw new TeamError('MEMBER_NOT_ACTIVE', memberId);
  if (!summary) throw new TeamError('ASSIGNMENT_SUMMARY_REQUIRED');
  closeForming(state);
  const id = taskId ?? `task-${++state.seq}`;
  if (state.assignments[id]) throw new TeamError('ASSIGNMENT_EXISTS', id);
  const at = nowIso(clock);
  state.assignments[id] = {
    taskId: id, memberId, summary, status: 'created', createdAt: at, sentAt: null, ackAt: null,
    lastProgressAt: null, lastSubstantiveAt: null, completedAt: null,
    deadlines: { ...DEFAULT_DEADLINES, ...(state.config.reporting?.defaultDeadlines ?? {}), ...(deadlines ?? {}) },
    hardExtendedUntil: null, diagnoses: [],
  };
  return state.assignments[id];
}

const SUBSTANTIVE = new Set(['progress', 'milestone', 'blocked', 'decision-needed', 'completed', 'handoff', 'waiting-for-quota']);

// Applies a verified role event at its controller receipt time (not when PM gets to it).
export function applyEvent(state, event, receivedAt) {
  const a = event.taskId ? state.assignments[event.taskId] : null;
  if (a && a.memberId !== event.memberId) throw new TeamError('EVENT_TASK_MEMBER_MISMATCH', event.eventId);
  const member = state.members[event.memberId];
  if (event.type === 'waiting-for-quota' && member) member.model.status = 'waiting-for-quota';
  if (!a) return;
  if (event.type === 'heartbeat') return; // never refreshes the hard deadline
  if (event.type === 'ack' && !a.ackAt) { a.ackAt = receivedAt; a.status = 'working'; }
  if (event.type === 'progress' || event.type === 'milestone') { a.lastProgressAt = receivedAt; if (!a.ackAt) { a.ackAt = receivedAt; } a.status = 'working'; }
  if (SUBSTANTIVE.has(event.type)) a.lastSubstantiveAt = receivedAt;
  if (event.type === 'blocked') a.status = 'blocked';
  if (event.type === 'decision-needed') a.status = 'decision-needed';
  if (event.type === 'completed') { a.status = 'completed-unverified'; a.completedAt = receivedAt; }
}

export function extendDeadline(state, taskId, untilIso) {
  const a = state.assignments[taskId];
  if (!a) throw new TeamError('ASSIGNMENT_NOT_FOUND', taskId);
  a.hardExtendedUntil = untilIso;
}

export function acceptCompletion(state, taskId) {
  const a = state.assignments[taskId];
  if (!a || a.status !== 'completed-unverified') throw new TeamError('ASSIGNMENT_NOT_COMPLETED', taskId);
  a.status = 'accepted';
}

const s = ms => ms / 1000;
// Returns the overdue kinds for an open assignment at `now` (ms).
export function overdue(a, now) {
  if (!a.sentAt || ['completed-unverified', 'accepted', 'cancelled'].includes(a.status)) return [];
  const out = [];
  const since = iso => s(now - Date.parse(iso));
  if (!a.ackAt && since(a.sentAt) > a.deadlines.ackSeconds) out.push('ack');
  if (a.ackAt && since(a.lastProgressAt ?? a.ackAt) > a.deadlines.progressSeconds) out.push('progress');
  const hardBase = a.lastSubstantiveAt ?? a.sentAt;
  const extended = a.hardExtendedUntil && Date.parse(a.hardExtendedUntil) > now;
  if (!extended && since(hardBase) > a.deadlines.hardNoReportSeconds) out.push('hard');
  return out;
}

// --- Model migration and write ownership (§6.6) ----------------------------------------

export function claimWrite(state, scope, memberId) {
  const owner = state.writeOwners[scope];
  if (owner && owner !== memberId) throw new TeamError('WRITE_SCOPE_OWNED', `${scope} by ${owner}`);
  state.writeOwners[scope] = memberId;
}

// Moves a member to the next model entry: revoke the predecessor's write and dispatch rights,
// create a successor at the next cursor, transfer ownership and (for PM) the logical PM.
export function migrateMember(state, memberId, { checkpoint = null, clock } = {}) {
  const from = state.members[memberId];
  if (!from) throw new TeamError('MEMBER_NOT_FOUND', memberId);
  if (from.status === 'retired') throw new TeamError('MEMBER_ALREADY_RETIRED', memberId);
  const entries = effectiveModels(state.config, from.roleId);
  if (from.model.status === 'waiting-for-quota' && entries[from.model.cursor].remainingThreshold.value < 0) throw new TeamError('NEGATIVE_THRESHOLD_WAITS', memberId);
  const cursor = from.model.cursor + 1;
  if (cursor >= entries.length) { from.model.status = 'no-next-entry'; throw new TeamError('NO_NEXT_MODEL_ENTRY', memberId); }
  const scopes = Object.entries(state.writeOwners).filter(([, owner]) => owner === memberId).map(([scope]) => scope);
  for (const scope of scopes) delete state.writeOwners[scope];
  from.status = 'retired'; from.retiredAt = nowIso(clock);
  const to = addMember(state, from.roleId, { origin: `migration:${memberId}`, cursor, predecessor: memberId });
  to.handoff = { from: memberId, checkpoint, scopes };
  for (const scope of scopes) state.writeOwners[scope] = to.memberId;
  for (const a of Object.values(state.assignments)) if (a.memberId === memberId && !['accepted', 'cancelled'].includes(a.status)) a.memberId = to.memberId;
  if (state.pm.memberId === memberId) state.pm.memberId = to.memberId;
  return to;
}

export const currentPm = state => state.members[state.pm.memberId];
export const modelEntry = (state, member) => effectiveModels(state.config, member.roleId)[member.model.cursor];
