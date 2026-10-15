// Orchestration over the pure team state: Herdr placement and launch with recovery, model
// selection from real provider state, the watcher tick, assignment dispatch and handoff.
// State changes happen in short synchronous store.update calls; Herdr/CLI waits happen outside
// the lock, with each step recorded so a rerun resumes instead of duplicating panes or sends.
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { TeamStore, writeAtomic, readJson, processAlive, withLock } from './store.mjs';
import { scanOutboxes } from './outbox.mjs';
import { register, deliver, loadDelivery, stateOf } from './sender.mjs';
import { applyEvent, overdue, modelEntry, currentPm, migrateMember, closeForming, TeamError } from './team.mjs';
import { resolveSpace, resolveTab, paneName, agentName } from './herdr.mjs';
import { launchArgs, modelMatches } from './providers.mjs';
import { fileURLToPath } from 'node:url';
import { notifyCommandLine, sessionSettings } from './permissions.mjs';
import { commandLine, DEFAULT_SHELL } from './commandline.mjs';
import { createProviderState, chooseEntry, exhaustedPoolsFrom, poolOf } from './selection.mjs';
import { effectiveModels } from './config.mjs';
import { withOperation } from './lease.mjs';
import { evaluate, markPending, normalise } from './models.mjs';
import { classifyPaneText, observationFromPane } from './limitsignal.mjs';

const iso = ms => new Date(ms).toISOString();
// The team CLI lives next to this module; command lines shown to roles go through the one tested
// formatter (commandline.mjs), so paths with spaces are quoted correctly.
const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../cli.mjs').replace(/\\/g, '/');
const slashed = p => p.replace(/\\/g, '/');
export const ackCommandFor = teamDir => ids => commandLine(DEFAULT_SHELL, ['node', CLI, 'ack', '--team-dir', slashed(teamDir), '--events', ...ids]);

// --- placement: Space / Tab / anchor ------------------------------------------------------
// The anchor (root pane of a tab we created) is only ever closed when ownership is provable:
// we recorded the tab creation response, the pane is still the recorded one, it has no agent
// and its foreground process is just a shell. Otherwise it is left and reported.
export async function ensurePlacement(store, herdr, { space, tab, env = process.env }) {
  const state = store.read();
  if (state.placement?.tabId) {
    const tabs = await herdr.tabs(state.placement.workspaceId);
    if (!tabs.some(t => t.tab_id === state.placement.tabId)) throw new TeamError('TEAM_TAB_MISSING', state.placement.tabId);
    return state.placement;
  }
  if (state.placementPending) throw new TeamError('PLACEMENT_NEEDS_REVIEW', 'a tab create may have happened; check Herdr for the tab named in placementPending and record it with `team adopt-tab`');
  const ws = await resolveSpace(herdr, space, env);
  let placement;
  if (tab) {
    const t = await resolveTab(herdr, ws.workspaceId, tab);
    placement = { workspaceId: ws.workspaceId, tabId: t.tabId, tabOwned: false, anchorPaneId: null, anchorOwned: false, spaceSource: ws.source };
  } else {
    const label = state.task.name.slice(0, 60);
    // Record intent first: a crash after create must not lead to guessing by name later.
    store.update(s => { s.placementPending = { workspaceId: ws.workspaceId, label, at: new Date().toISOString() }; });
    const r = await herdr.createTab({ workspaceId: ws.workspaceId, label, cwd: state.cwd });
    const tabId = r.tab?.tab_id ?? r.tab_id;
    const root = r.root_pane?.pane_id ?? r.pane?.pane_id ?? r.root_pane_id ?? null;
    if (!tabId) throw new TeamError('TAB_CREATE_UNPARSEABLE');
    placement = { workspaceId: ws.workspaceId, tabId, tabOwned: true, anchorPaneId: root, anchorOwned: Boolean(root), spaceSource: ws.source };
  }
  store.update(s => { s.placement = placement; delete s.placementPending; });
  return placement;
}

export function adoptTab(store, { tabId, workspaceId, anchorPaneId = null }) {
  return store.update(s => {
    if (s.placement) throw new TeamError('PLACEMENT_EXISTS');
    s.placement = { workspaceId, tabId, tabOwned: true, anchorPaneId, anchorOwned: false, spaceSource: 'adopted', note: 'adopted after review; anchor not closed automatically' };
    delete s.placementPending;
  }).placement;
}

const SHELLS = /^(pwsh|powershell|cmd|bash|sh|zsh|fish|nu)(\.exe)?$/i;
async function closeAnchorIfProvablyEmpty(store, herdr, placement, newPaneId) {
  if (!placement.anchorOwned || !placement.anchorPaneId || placement.anchorPaneId === newPaneId) return;
  const pane = await herdr.pane(placement.anchorPaneId);
  let closed = false, reason = 'anchor-missing';
  if (pane) {
    const info = await herdr.processes(placement.anchorPaneId).catch(() => null);
    const fg = info?.foreground_processes ?? [];
    const onlyShell = fg.length > 0 && fg.every(p => SHELLS.test(p.name ?? ''));
    if (!pane.agent && onlyShell && pane.tab_id === placement.tabId) { await herdr.closePane(placement.anchorPaneId); closed = true; reason = 'closed-empty-shell'; }
    else reason = 'not-provably-empty';
  }
  store.update(s => { s.placement.anchorOwned = false; s.placement.anchorResult = { closed, reason }; });
}

// --- model choice -------------------------------------------------------------------------
export async function chooseModel(store, memberId, { providerState, from }) {
  const state = store.read();
  const member = state.members[memberId];
  const start = from ?? member.model.cursor;
  const pick = await chooseEntry({ config: state.config, roleId: member.roleId, from: start, providerState, exhaustedPools: new Set(Object.keys(state.quotaPools ?? {})) });
  if (pick.index < 0) throw new TeamError('NO_LAUNCHABLE_MODEL_ENTRY', JSON.stringify(pick.reasons));
  store.update(s => { const m = s.members[memberId]; m.model.cursor = pick.index; m.model.status = pick.status; m.model.chosenFrom = effectiveModels(s.config, m.roleId)[pick.index].source; });
  return pick;
}

// Polls (read-only) until the pane reports an agent of the wanted kind WITH a session id, or the time
// is up. Returns the pane info or null. Never sends anything to the agent.
// Ownership is proved from the LIVE agent, not from our own state alone: the agent must have the
// unique name this tool gave it (agent start --name), sit in the recorded pane and be of the wanted
// kind. A different agent that merely occupies the same pane later (same kind or not) fails the check.
export function isOurAgent(live, { agentName, paneId, kind }) {
  return Boolean(live && live.name === agentName && live.pane_id === paneId && (!kind || live.agent === kind));
}

export async function waitForAgentSession(herdr, paneId, { timeoutMs = 20000, intervalMs = 250, kind, agentName } = {}) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const info = await herdr.agent(paneId).catch(() => null);
    if (info?.agent && info.agent_session?.value && isOurAgent(info, { agentName, paneId, kind })) return info;
    if (Date.now() >= until) return null;
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// --- member launch with recovery ----------------------------------------------------------
// Steps: planned -> pane-requested -> pane-created -> agent-started -> prompt-pending -> prompted.
// One live launch per member. A second caller (another promise, the CLI, the watcher) gets the member's
// current state with `inProgress: true` and no Herdr or CLI call. If the owner died, the next caller
// takes over and resumes from the journaled launch step.
export async function launchMember(store, herdr, memberId, options) {
  const op = await withOperation(options.teamDir ?? store.dir, 'launch', memberId, () => launchMemberBody(store, herdr, memberId, options), options.lease);
  if (op.busy) return { ...store.read().members[memberId], inProgress: true, operationOwner: { pid: op.owner.pid, since: op.owner.since } };
  return op.value;
}

async function launchMemberBody(store, herdr, memberId, { teamDir, providerState, prompt, env = process.env, waitSessionMs = 20000, waitSessionPollMs = 250 }) {
  let state = store.read();
  let member = state.members[memberId];
  if (!member) throw new TeamError('MEMBER_NOT_FOUND', memberId);
  if (member.launch.step === 'prompted') return member;
  if (['retired', 'failed'].includes(member.status)) throw new TeamError('MEMBER_NOT_ACTIVE', memberId);
  const { workspaceId, tabId } = state.placement ?? {};
  if (!tabId) throw new TeamError('PLACEMENT_REQUIRED');
  if (!providerState) providerState = createProviderState({ config: state.config });

  if (member.launch.step === 'planned' && !member.launch.heldForQuota) {
    await chooseModel(store, memberId, { providerState });
    state = store.read(); member = state.members[memberId];
    store.update(s => { s.members[memberId].agentName = agentName(s.teamId, memberId); });
  }
  state = store.read(); member = state.members[memberId];
  const role = state.config.roles[member.roleId];
  const entry = modelEntry(state, member);
  const label = paneName(memberId, role.displayName, state.task.name, entry.model);
  const handoffText = member.handoff ? handoffPrompt(state, member) : '';
  // Chosen entry has a known-exhausted pool and a negative threshold: it waits. Nothing is sent
  // (no pane agent start, no prompt) until reliable recovery; a rerun then continues from here.
  if (member.model.status === 'waiting-for-quota') {
    const fresh = await providerState.observation(entry.provider, { probe: true, refresh: true });
    if (fresh) applyObservation(store, memberId, entry, fresh); // reliable recovery lifts the hold
    if (store.read().members[memberId].model.status === 'waiting-for-quota') {
      store.update(s => {
        s.members[memberId].launch.heldForQuota ??= new Date().toISOString();
        const pool = poolOf(s.config, entry);
        s.quotaPools ??= {};
        if (pool && !s.quotaPools[pool]) s.quotaPools[pool] = { limitSeenAt: new Date().toISOString(), by: memberId, signal: 'wait-at-launch' };
      });
      throw new TeamError('MEMBER_WAITING_FOR_QUOTA', `${memberId}: no new inference until quota recovers`);
    }
    store.update(s => { delete s.members[memberId].launch.heldForQuota; });
    state = store.read(); member = state.members[memberId];
  }

  if (['planned', 'pane-requested'].includes(member.launch.step)) {
    let paneId = member.reservedPaneId ?? null; // handoff reserved this pane through grid.cjs: never create another
    if (!paneId && member.launch.step === 'pane-requested') {
      // A grid call may have created a pane before failing; adopt only an unambiguous match on
      // our own unique label in our own tab, never a pane we cannot attribute.
      const found = (await herdr.panes(workspaceId)).filter(p => p.tab_id === tabId && p.label === label && !p.agent);
      if (found.length > 1) throw new TeamError('AMBIGUOUS_RECOVERY', label);
      paneId = found[0]?.pane_id ?? null;
    }
    if (!paneId) {
      store.update(s => { const m = s.members[memberId]; m.launch.step = 'pane-requested'; m.launch.attempts += 1; m.launch.label = label; });
      paneId = (await herdr.gridSplit({ workspaceId, tabId, cwd: state.cwd, name: label })).new_pane_id;
    }
    store.update(s => { const m = s.members[memberId]; m.paneId = paneId; m.launch.step = 'pane-created'; m.status = 'starting'; });
    if (!member.reservedPaneId) await closeAnchorIfProvablyEmpty(store, herdr, store.read().placement, paneId);
  }

  state = store.read(); member = state.members[memberId];
  if (member.launch.step === 'pane-created') {
    const pane = await herdr.pane(member.paneId);
    if (!pane) throw new TeamError('MEMBER_PANE_MISSING', member.paneId);
    const intent = member.launch.startIntent; // journaled BEFORE the start call
    if (pane.agent) {
      // An agent is already in this pane. It is ours in exactly two cases:
      //  (a) we recorded its session earlier (a previous run finished the start), or
      //  (b) our start intent is journaled for THIS pane and agent kind, and the pane was an empty
      //      shell when we asked (no earlier agent session): the start succeeded but the run was
      //      interrupted before the session was saved. Anything else is foreign and is never adopted.
      const live = await herdr.agent(member.paneId).catch(() => null);
      const nameOk = isOurAgent(live, { agentName: member.agentName, paneId: member.paneId, kind: pane.agent });
      const recorded = Boolean(member.agent?.session) && pane.agent_session?.value === member.agent.session && pane.agent === member.agent.kind && nameOk;
      const ours = Boolean(intent) && intent.paneId === member.paneId && intent.kind === pane.agent && intent.agentName === member.agentName && intent.sessionBefore === null && nameOk;
      if (!recorded && !ours) throw new TeamError('PANE_HAS_FOREIGN_AGENT', `${member.paneId}: the live agent is not the one this tool started (name/pane/kind/intent do not all match)`);
    } else {
      const ready = await providerState.auth(entry.provider);
      if (ready.ok !== true) { store.update(s => { s.members[memberId].launch.error = ready.reason; }); throw new TeamError('PROVIDER_NOT_READY', `${entry.provider}: ${ready.reason}`); }
      const provider = state.config.providers[entry.provider];
      const settingsFile = provider.cli === 'claude' ? writeSessionSettings(teamDir, state, memberId) : undefined;
      const { kind, args } = launchArgs(provider, entry, { settingsFile });
      // Journal first: a crash right after a successful start can then be recognised and resumed.
      store.update(s => { s.members[memberId].launch.startIntent = { agentName: member.agentName, kind, paneId: member.paneId, sessionBefore: null, at: new Date().toISOString() }; });
      await herdr.startAgent({ name: member.agentName, kind, paneId: member.paneId, args });
    }
    // Herdr publishes the session id a moment after the start call returns. Wait a bounded time for
    // it (read-only; no prompt is sent). Success needs the agent kind and a session id.
    const kindWanted = store.read().members[memberId].launch.startIntent?.kind ?? member.agent?.kind;
    const after = await waitForAgentSession(herdr, member.paneId, { timeoutMs: waitSessionMs, intervalMs: waitSessionPollMs, kind: kindWanted, agentName: member.agentName });
    if (!after) throw new TeamError('AGENT_NOT_CONFIRMED', `${member.paneId}: no agent session within ${waitSessionMs}ms; rerun to continue (the agent is not restarted)`);
    if (kindWanted && after.agent !== kindWanted) throw new TeamError('AGENT_KIND_MISMATCH', `${after.agent} != ${kindWanted}`);
    store.update(s => { const m = s.members[memberId]; m.launch.step = 'agent-started'; m.agent = { kind: after.agent, session: after.agent_session.value }; });
  }

  state = store.read(); member = state.members[memberId];
  if (member.launch.step === 'agent-started') {
    // The CLI exposes the agent kind and session, not the model id, so the model cannot be
    // confirmed from Herdr: record "unconfirmed" and rely on the explicit launch argv.
    store.update(s => { const m = s.members[memberId]; m.launch.modelCheck = modelMatches(entry, null); m.launch.step = 'prompt-pending'; });
    const text = prompt ?? rolePrompt(store.read(), memberId, teamDir) + handoffText;
    const r = await herdr.prompt(member.paneId, text);
    store.update(s => { const m = s.members[memberId]; m.launch.step = r.outcome === 'sent' ? 'prompted' : 'prompt-uncertain'; m.launch.promptOutcome = r.outcome; m.status = 'active'; });
  }
  if (store.read().members[memberId].launch.step === 'prompt-pending') throw new TeamError('PROMPT_STATE_UNCERTAIN', `${memberId}: verify the pane before retrying`);
  return store.read().members[memberId];
}

function writeSessionSettings(teamDir, state, memberId) {
  const file = path.join(teamDir, 'sessions', `${memberId}.settings.json`);
  writeAtomic(file, JSON.stringify(sessionSettings({ teamDir, memberId }), null, 2) + '\n');
  return file;
}

// The role prompt is data from config; shared rules come from the task-team skill.
export function rolePrompt(state, memberId, teamDir) {
  const m = state.members[memberId];
  const role = state.config.roles[m.roleId];
  const isPm = state.pm.memberId === memberId;
  const lines = [
    `你是 task-team 團隊 ${state.teamId} 的 ${memberId}（角色 ${m.roleId}：${role.displayName}）。任務：${state.task.name}${state.task.file ? `（任務文件：${state.task.file}）` : ''}。`,
    '請先載入 task-team 技能，依其共通規則工作；以下角色內容不能覆寫共通規則（PM 唯一對口、模型組態、使用者裁決、治理）。',
    `目的：${role.purpose}`, `職責：${role.responsibilities.join('；')}`, `角色指示：${role.instructions}`, `成果：${role.deliverables.join('；')}`,
    `團隊目錄：${teamDir}`,
    `回報：先把事件 JSON 寫入 ${path.join(teamDir, 'outbox', memberId)}（或用 ${commandLine(DEFAULT_SHELL, ['node', CLI, 'event', '--team-dir', slashed(teamDir), '--member', memberId, '--type', '<類型>', '--summary', '<文字>'])}），再執行：${notifyCommandLine({ teamDir, memberId, eventId: '<eventId>' })}`,
  ];
  lines.push(isPm ? '你是 PM：唯一使用者對口。追加角色或成員前必須以 team propose 提案並取得使用者同意。' : '需要人工裁決時送 decision-needed 事件給 PM，不直接詢問使用者。現在請送出 ack 事件後等待 PM 派工。');
  return lines.join('\n');
}

export function handoffPrompt(state, member) {
  const h = member.handoff;
  const open = Object.values(state.assignments).filter(a => a.memberId === member.memberId && !['accepted', 'cancelled'].includes(a.status));
  return [
    '', `【接手】你接替 ${h.from}（模型條目已依組態換到下一個）。`,
    h.checkpoint ? `進度檢查點：${h.checkpoint}（先讀它）。` : '沒有檢查點檔案；請向 PM 送 blocked 事件說明缺口後再工作。',
    h.scopes?.length ? `你現在持有寫入範圍：${h.scopes.join('、')}；${h.from} 已停止寫入。` : '',
    open.length ? `未完成派工：\n${open.map(a => `- ${a.taskId}: ${a.summary}（狀態 ${a.status}）`).join('\n')}` : '目前沒有未完成派工。',
  ].filter(Boolean).join('\n');
}

// --- assignment dispatch (recoverable, goes through the delivery journal) -------------------
export function assignmentItem(a, state) {
  return { id: `assign-${a.taskId}`, kind: 'assignment', memberId: a.memberId, to: a.memberId, line: `[task-team 派工 ${a.taskId}] ${a.summary}\n請先送 ack 事件（taskId=${a.taskId}），完成時送 completed。（${`assign-${a.taskId}`}）` };
}

// --- immediate blocked diagnosis (design 7.3: a blocked member is diagnosed at once, no waiting for hard) ---
// Independent of assignments: a launch ack, a first report or an idle member can be blocked too. Only a
// member this tool started (recorded session and kind still match the live agent) that Herdr KNOWS is
// blocked is looked at, once per blocking episode. The result is stored as state.members.<id>.blockedNow
// and reported to the logical PM through the notice journal. It never answers the permission prompt,
// never changes the model and never touches the pane. When the member leaves "blocked", the episode is
// closed, so a later block is a new round with a new notice.
export async function scanBlocked({ store, herdr, state, teamDir, now = Date.now() }) {
  const found = {};
  for (const m of Object.values(state.members)) {
    if (!m.paneId || ['retired', 'failed'].includes(m.status) || m.launch?.step !== 'prompted' || !m.agent?.session) continue;
    const live = await herdr.agent(m.paneId).catch(() => null);
    const ours = live && live.agent_session?.value === m.agent.session && live.agent === m.agent.kind;
    if (!ours) continue; // a different session/kind is not the member we started
    if (live.agent_status !== 'blocked') {
      if (m.blockedNow) { store.update(s => { const cur = s.members[m.memberId]; (cur.blockedHistory ??= []).push({ ...cur.blockedNow, endedAt: new Date(now).toISOString() }); delete cur.blockedNow; }); }
      continue;
    }
    if (m.blockedNow) continue; // this episode was already diagnosed
    const result = await diagnoseMember(herdr, store.read(), m.memberId, teamDir);
    const episode = { episode: (m.blockedHistory?.length ?? 0) + 1, key: episodeKey(m, 'blocked-now', String((m.blockedHistory?.length ?? 0) + 1)), at: new Date(now).toISOString(), ...result };
    store.update(s => { s.members[m.memberId].blockedNow = episode; });
    found[m.memberId] = episode;
  }
  return found;
}

// One blocking episode = one member session + one model cursor + one cause (+ the round number for
// "blocked" episodes that end and start again). The same episode never produces a second notice.
const episodeKey = (member, kind, cause) => [kind, member.agent?.session ?? '', member.model?.cursor ?? 0, cause].join('|');

// --- system notices: tell the logical PM what the watcher found ---------------------------------
// Overdue diagnoses and blocked automatic takeovers are written into the SAME delivery journal as role
// events (kind 'notice', to 'pm'), so they are queued while the PM is busy, deduplicated by cause and
// retried like everything else. If the PM itself cannot receive (its pane is gone, it waits for quota
// or it is the member that failed), nothing is claimed as reported: the notice stays queued and
// state.attention lists it so any status view shows it plainly.
const noticeId = (kind, ...parts) => `notice-${createHash('sha256').update([kind, ...parts].join('\u0000')).digest('hex').slice(0, 16)}`;

export function collectNotices(state) {
  const out = [];
  for (const a of Object.values(state.assignments)) {
    for (const d of a.diagnoses ?? []) {
      if (['working-no-report', 'not-run'].includes(d.classification) && !d.kinds.includes('hard')) continue; // still working inside its soft deadlines: no alarm
      const id = noticeId('late', a.taskId, d.basis, d.kinds.join(','));
      const hint = d.classification === 'permission-blocked' ? '（權限對話擋住；需要 PM 向使用者說明最小規則，不要代為核准）' : d.classification === 'notify-failed-or-pending' ? '（outbox 有事件但通知未送達）' : '';
      out.push({ id, kind: 'notice', to: 'pm', memberId: a.memberId, type: 'late', line: `- [逾期診斷] ${a.memberId} ${a.taskId}: ${d.kinds.join('/')} → ${d.classification}${hint}（${id}）` });
    }
  }
  for (const m of Object.values(state.members)) {
    if (m.blockedNow) {
      const id = noticeId('blocked-now', m.memberId, m.blockedNow.key);
      const permission = m.blockedNow.classification === 'permission-blocked';
      out.push({ id, kind: 'notice', to: 'pm', memberId: m.memberId, type: 'blocked-now', line: `- [卡住] ${m.memberId}: ${m.blockedNow.classification}${permission ? '（權限對話擋住；請向使用者說明所需最小規則與設定位置，不要代為核准）' : ''}（${id}）` });
    }
    if (m.autoHandoff?.blocked) {
      const id = noticeId('handoff-blocked', m.memberId, m.autoHandoff.blocked, m.model?.pending?.since ?? '');
      out.push({ id, kind: 'notice', to: 'pm', memberId: m.memberId, type: 'handoff-blocked', line: `- [自動交接受阻] ${m.memberId}: ${m.autoHandoff.blocked}（真上限但無法自動接手；${m.autoHandoff.blocked === 'NO_CHECKPOINT' ? '請該成員先存檢查點並送 checkpoint 事件' : '沒有下一個可用的模型條目'}）（${id}）` });
    }
    if (m.modelBlocked) {
      const id = noticeId('model-blocked', m.memberId, m.modelBlocked.key);
      out.push({ id, kind: 'notice', to: 'pm', memberId: m.memberId, type: 'model-blocked', line: `- [模型被閘道拒絕] ${m.memberId}: ${m.modelBlocked.matched}（不是額度，也不是登入問題；不自動換模型或帳號，請組態擁有者修改存取或清單）（${id}）` });
    }
    if (m.budgetBlocked) {
      const id = noticeId('budget', m.memberId, m.budgetBlocked.key);
      out.push({ id, kind: 'notice', to: 'pm', memberId: m.memberId, type: 'budget-blocked', line: `- [預算／餘額停止] ${m.memberId}: ${m.budgetBlocked.matched}（只回報，不換模型、不動用其他帳號額度）（${id}）` });
    }
  }
  for (const [id, h] of Object.entries(state.handoffs ?? {})) {
    if (h.blocked) out.push({ id: noticeId('handoff-state', id, h.blocked), kind: 'notice', to: 'pm', memberId: id, type: 'handoff-blocked', line: `- [交接受阻] ${id}: ${h.blocked}（${noticeId('handoff-state', id, h.blocked)}）` });
  }
  return out;
}

// Unsent notices, for views that must show a blocked state even when the PM cannot be told.
export function attention(state, teamDir) {
  const records = loadDelivery(teamDir).records;
  return collectNotices(state).filter(n => !['sent', 'received'].includes(records[n.id]?.state)).map(n => ({ id: n.id, memberId: n.memberId, type: n.type, text: n.line.replace(/^- /, ''), delivery: records[n.id]?.state ?? 'not-registered' }));
}

// --- watcher tick -------------------------------------------------------------------------
// Event handling is a replayable journal: every scanned event is applied to state exactly once,
// tracked in state.appliedEvents, so a crash between "registered" and "applied" is repaired on the
// next pass and one bad event cannot block the rest.
export async function tick({ teamDir, herdr, now = Date.now(), diagnose = true, providerState, probeUsage = false, scanLimits = false }) {
  const store = new TeamStore(teamDir);
  let state = store.read();
  const { events, invalid } = scanOutboxes(teamDir, { teamId: state.teamId, members: state.members });
  const receipts = register(teamDir, events.map(e => ({ id: e.eventId, kind: 'event', memberId: e.memberId, type: e.type, to: e.type === 'message' ? e.to : 'pm', local: e.type === 'heartbeat', event: e })), iso(now));
  const applyErrors = [];
  store.update(s => {
    s.appliedEvents ??= {};
    for (const e of events) {
      if (s.appliedEvents[e.eventId]) continue;
      try {
        // A checkpoint only counts if its file exists now; the path is read, never followed outside.
        if (e.type === 'checkpoint' && !(fs.existsSync(e.paths[0]) && fs.statSync(e.paths[0]).isFile())) throw new TeamError('CHECKPOINT_FILE_MISSING', e.paths[0]);
        applyEvent(s, e, receipts[e.eventId] ?? iso(now)); s.appliedEvents[e.eventId] = receipts[e.eventId] ?? iso(now);
      }
      catch (error) { applyErrors.push({ eventId: e.eventId, error: error.message }); s.appliedEvents[e.eventId] = `error:${error.code ?? error.message}`; }
    }
  });
  state = store.read();

  // Real limit signals without a numeric adapter: read each member pane's tail (no prompt sent).
  const limitScan = await scanPaneLimits({ store, herdr, state, scan: probeUsage || scanLimits });
  if (limitScan.changed) state = store.read();

  const blockedNow = diagnose ? await scanBlocked({ store, herdr, state: store.read(), teamDir, now }) : {};
  if (Object.keys(blockedNow).length) state = store.read();

  // Observe quota BEFORE takeover and delivery: a value that just dropped below the threshold is recorded
  // as pending now, so this same pass tries the safe handoff and does not first hand new work to the old member.
  const usage = probeUsage ? await refreshUsage(store, store.read(), providerState ?? createProviderState({ config: state.config })) : null;
  if (usage) state = store.read();

  const takeover = (scanLimits || probeUsage) && providerState ? await autoHandoffPending({ store, herdr, teamDir, providerState }) : [];
  if (takeover.length) state = store.read();
  const resumed = (probeUsage || providerState) && Object.keys(state.handoffs ?? {}).length ? await resumeHandoffs({ store, herdr, teamDir, providerState: providerState ?? createProviderState({ config: state.config }) }) : [];
  if (resumed.length) state = store.read();
  const resolveTarget = async to => {
    const fresh = store.read(); // re-read each time: PM may have changed or entered waiting-for-quota
    const member = to === 'pm' ? currentPm(fresh) : fresh.members[to]; // logical PM: resolved now, not at creation
    if (!member?.paneId || member.launch?.step !== 'prompted') return null;
    if (member.model.status === 'waiting-for-quota') return { paneId: member.paneId, status: 'waiting-for-quota', session: member.agent?.session ?? null };
    // Pending migration: do not start a new conversation turn on the model that is about to be replaced.
    // (Not for the PM target of notices: those are information, and a PM migration is handled the same
    // way below by the handoff itself.) The turn already running is left alone.
    if (member.model.pending && !['retired', 'failed'].includes(member.status)) return { paneId: member.paneId, status: 'migration-pending', session: member.agent?.session ?? null };
    const agent = await herdr.agent(member.paneId).catch(() => null);
    // A different session than the one we started means the pane changed hands: not a valid target.
    if (agent && member.agent?.session && agent.agent_session?.value !== member.agent.session) return { paneId: member.paneId, status: 'unknown', session: member.agent.session };
    return { paneId: member.paneId, status: agent?.agent_status ?? 'unknown', session: member.agent?.session ?? null };
  };
  const eventItems = events.filter(e => e.type !== 'heartbeat').map(e => ({
    id: e.eventId, kind: 'event', memberId: e.memberId, type: e.type, to: e.type === 'message' ? e.to : 'pm',
    line: `- [${e.type}] ${e.memberId}${e.taskId ? ` ${e.taskId}` : ''} (${e.eventId}): ${e.summary}${e.paths?.length ? ` | ${e.paths.join(', ')}` : ''}`,
  }));
  const assignItems = Object.values(state.assignments).filter(a => ['created', 'queued'].includes(a.status) && !a.sentAt).map(a => assignmentItem(a, state));
  register(teamDir, assignItems, iso(now));

  // Diagnose overdue work first (one bounded diagnosis per basis), so the result can ride this delivery pass.
  const late = [];
  for (const a of Object.values(store.read().assignments)) {
    const kinds = overdue(a, now);
    if (!kinds.length) continue;
    const basis = a.lastSubstantiveAt ?? a.sentAt;
    if (a.diagnoses.some(d => d.basis === basis && kinds.every(k => d.kinds.includes(k)))) continue;
    const result = diagnose ? await diagnoseMember(herdr, store.read(), a.memberId, teamDir) : { classification: 'not-run' };
    store.update(s => { s.assignments[a.taskId].diagnoses.push({ at: iso(now), kinds, basis, ...result }); });
    late.push({ taskId: a.taskId, memberId: a.memberId, kinds, ...result });
  }
  state = store.read();
  const noticeItems = collectNotices(state);
  register(teamDir, noticeItems, iso(now));
  const delivery = await deliver({ teamDir, teamId: state.teamId, items: [...eventItems, ...assignItems, ...noticeItems], resolveTarget, herdr, now: iso(now), ackCommand: ackCommandFor(teamDir) });

  // Assignments become "sent" (deadline clock starts) only when the journal says sent.
  const records = loadDelivery(teamDir).records;
  store.update(s => { for (const a of Object.values(s.assignments)) { const r = records[`assign-${a.taskId}`]; if (r?.state === 'sent' && !a.sentAt) { a.sentAt = r.sentAt; a.status = 'sent'; } } });
  state = store.read();

  return { events: events.length, invalid, applyErrors, delivery, late, usage, resumed, limitScan: limitScan.found, blockedNow, takeover, attention: attention(store.read(), teamDir) };
}

// The single place where an observation (probe, manual input, status line) changes model state.
// A wait or pending migration is only ended by observations that normalise to known=true and
// not a limit; stale, empty, NaN, out-of-range or unmapped data is unknown and changes nothing.
export function applyObservation(store, memberId, entry, obs) {
  const verdict = evaluate(entry, obs);
  const norm = normalise(obs);
  store.update(s => {
    const mm = s.members[memberId];
    const pool = poolOf(s.config, entry);
    s.quotaPools ??= {};
    if (pool && norm.limit) s.quotaPools[pool] = { limitSeenAt: new Date().toISOString(), by: memberId, signal: obs.signal ?? 'reliable-zero' };
    // Only reliable, fresh, in-range evidence that quota remains clears a recorded pool limit.
    else if (pool && norm.known && !norm.limit && norm.remaining > 0 && s.quotaPools[pool]) delete s.quotaPools[pool];
    if (norm.known || norm.limit) mm.model.lastObservation = obs; // unknown never overwrites a known one
    else mm.model.lastUnknownAt = new Date().toISOString();
    if (verdict === 'wait') mm.model.status = 'waiting-for-quota';
    else if (verdict === 'switch') mm.model = markPending(mm.model, verdict, obs);
    else if (verdict === 'non-quota-error') mm.model.lastNonQuotaError = obs.signal;
    else if (verdict === 'continue' && mm.model.status === 'waiting-for-quota' && norm.known && !norm.limit) mm.model.status = 'active';
  });
  return verdict;
}

// Reads each launched member's pane tail for a documented quota-limit message and feeds the result
// through applyObservation (the single place that changes model state). It never sends a prompt,
// so it works when the member is the exhausted PM.
//  * The pane must still be the member we started (recorded session and agent kind); a different
//    session or kind is unknown and ignored.
//  * Only the provider's error UI at the end of the screen counts. Work output that merely quotes a
//    limit message, code, or tests is not a signal (see limitsignal.mjs).
//  * budget-blocked (spend/credit) never changes model state: the member is marked "budget-blocked"
//    and the PM is told; no pane is closed and no other account's quota is spent.
//  * 429/529/auth/network/context text is recorded as a non-quota error only; unrecognised text is
//    unknown and not recorded.
export async function scanPaneLimits({ store, herdr, state, scan = false }) {
  if (!scan) return { changed: false, found: {} };
  const found = {};
  let changed = false;
  for (const m of Object.values(state.members)) {
    if (!m.paneId || ['retired', 'failed'].includes(m.status) || m.launch?.step !== 'prompted' || !m.agent?.session) continue;
    const live = await herdr.agent(m.paneId).catch(() => null);
    const text = await herdr.readPane(m.paneId, 60);
    const cls = classifyPaneText(text, { expectedSession: m.agent.session, liveSession: live?.agent_session?.value, expectedKind: m.agent.kind, liveKind: live?.agent });
    if (cls.kind === 'model-blocked') {
      store.update(s => {
        const mm = s.members[m.memberId];
        const key = episodeKey(mm, 'model-blocked', cls.matched);
        if (mm.modelBlocked?.key === key) mm.modelBlocked.lastSeenAt = new Date().toISOString(); // same episode: do not restart it
        else mm.modelBlocked = { key, at: new Date().toISOString(), lastSeenAt: new Date().toISOString(), matched: cls.matched, cursor: mm.model.cursor, session: mm.agent?.session ?? null };
      });
      found[m.memberId] = { kind: 'model-blocked', verdict: 'report-only' };
      changed = true;
      continue;
    }
    if (cls.kind === 'budget-blocked') {
      store.update(s => {
        const mm = s.members[m.memberId];
        const key = episodeKey(mm, 'budget-blocked', cls.matched);
        if (mm.budgetBlocked?.key === key) mm.budgetBlocked.lastSeenAt = new Date().toISOString();
        else mm.budgetBlocked = { key, at: new Date().toISOString(), lastSeenAt: new Date().toISOString(), matched: cls.matched, cursor: mm.model.cursor, session: mm.agent?.session ?? null };
      });
      found[m.memberId] = { kind: 'budget-blocked', verdict: 'report-only' };
      changed = true;
      continue;
    }
    const obs = observationFromPane(cls);
    if (!obs) continue;
    const entry = modelEntry(state, m);
    const provider = state.config.providers[entry.provider];
    if (obs.signal === 'quota-exhausted' && provider?.cli === 'codex') continue; // codex has an exact adapter
    found[m.memberId] = { kind: cls.kind, verdict: applyObservation(store, m.memberId, entry, obs) };
    changed = true;
  }
  return { changed, found };
}

// The external watcher's automatic takeover: for members whose migration is pending after a REAL
// limit, start the safe handoff only when a saved checkpoint exists. Without one the member is
// marked blocked ("no checkpoint") and the PM is told; nothing is claimed as handed over. Negative
// thresholds never get here (their verdict is 'wait', not 'switch').
export async function autoHandoffPending({ store, herdr, teamDir, providerState }) {
  const out = [];
  for (const m of Object.values(store.read().members)) {
    // Any recorded pending migration qualifies: a real limit signal, or a known remaining value strictly
    // below a positive threshold. Whether it still applies is decided at the boundary inside handoff().
    if (['retired', 'failed'].includes(m.status) || !m.model?.pending) continue;
    const existing = store.read().handoffs?.[m.memberId];
    if (existing && existing.phase !== 'cancelled') continue; // in progress or finished; resumeHandoffs continues it
    // A cancelled record is evidence of an earlier decision; only a pending migration that appeared
    // AFTER the cancellation starts a new handoff.
    if (existing && Date.parse(m.model.pending.since ?? 0) <= Date.parse(existing.cancelledAt ?? 0)) continue;
    const cp = m.checkpoint?.path;
    if (!cp || !fs.existsSync(cp)) {
      store.update(s => { const cur = s.members[m.memberId].autoHandoff; if (cur?.blocked !== 'NO_CHECKPOINT') s.members[m.memberId].autoHandoff = { blocked: 'NO_CHECKPOINT', at: new Date().toISOString() }; });
      out.push({ memberId: m.memberId, started: false, blocked: 'NO_CHECKPOINT' });
      continue;
    }
    try { const r = await handoff({ store, herdr, teamDir, memberId: m.memberId, checkpoint: cp, providerState }); out.push({ memberId: m.memberId, started: true, ...r }); }
    catch (error) { out.push({ memberId: m.memberId, started: false, blocked: error.code ?? error.message }); }
  }
  return out;
}

// Observes each active member's provider (read-only, no inference) and updates the model state:
// 'switch' records a pending migration (never an immediate cut), 'wait' marks waiting-for-quota.
export async function refreshUsage(store, state, providerState) {
  const out = {};
  const fresh = new Map(); // one read per provider per pass
  for (const m of Object.values(state.members)) {
    if (['retired', 'failed'].includes(m.status) || m.launch.step === 'planned') continue;
    const entry = modelEntry(state, m);
    // A periodic observation always reads fresh data: the per-pass cache is for selection, not for monitoring.
    const key = entry.provider;
    if (!fresh.has(key)) fresh.set(key, await providerState.observation(entry.provider, { probe: true, refresh: true }));
    const obs = fresh.get(key);
    if (!obs) continue;
    out[m.memberId] = applyObservation(store, m.memberId, entry, obs);
  }
  return out;
}

// One bounded look at the member: never kills, restarts or changes models.
export async function diagnoseMember(herdr, state, memberId, teamDir) {
  const m = state.members[memberId];
  if (m.model.status === 'waiting-for-quota') return { classification: 'waiting-for-quota' };
  if (!m.paneId) return { classification: 'not-launched' };
  const pane = await herdr.pane(m.paneId).catch(() => null);
  if (!pane) return { classification: 'crashed-or-closed' };
  const outbox = path.join(teamDir, 'outbox', memberId);
  const hasEvents = fs.existsSync(outbox) && fs.readdirSync(outbox).some(n => n.endsWith('.json'));
  if (pane.agent_status === 'blocked') {
    const text = await herdr.readPane(m.paneId, 30);
    return { classification: /permission|allow|approve|權限|是否允許|Do you want to/i.test(text) ? 'permission-blocked' : 'blocked', outboxHasEvents: hasEvents };
  }
  if (!pane.agent) return { classification: 'agent-not-running' };
  if (m.launch?.step !== 'prompted') return { classification: 'not-accepted', launchStep: m.launch?.step };
  if (pane.agent_status === 'working') return { classification: 'working-no-report', outboxHasEvents: hasEvents };
  return { classification: hasEvents ? 'notify-failed-or-pending' : 'idle-no-report', outboxHasEvents: hasEvents };
}

// --- handoff (PM and any role): reserve, quiesce, transfer, start successor -------------------
// Phases in state.handoffs[memberId]: requested -> reserved -> quiesced -> transferred -> successor-launched.
//  * reserved: BEFORE the predecessor pane is closed, the next launchable model entry is chosen and a
//    pane for the successor is reserved through grid.cjs (no agent started, no write rights). Closing
//    the last pane of a tab we created would close the tab itself, so the tab must be kept alive by
//    the reserved pane. With no next entry the old pane is kept and the case goes to the PM.
//  * quiesced: the predecessor is provably unable to write: it is a pane this tool created (recorded
//    pane + session), was idle/done, and is gone after close. A sent "stop" prompt is not quiescence.
//    Panes the tool does not own are never closed; no model turn is spent probing.
//  * transferred: migrateMember + phase + successor id are ONE state transaction (crash-safe).
// The handoff may run inside the predecessor's own pane (closing it can end this process), so each
// phase is recorded first and `handoff` is rerunnable by the watcher or another process.
// One live handoff per member: the CLI, the watcher's resume and the automatic takeover all go through
// this lease, so reserve / close / transfer / successor launch can never run twice at the same time.
export async function handoff(args) {
  const op = await withOperation(args.teamDir ?? args.store.dir, 'handoff', args.memberId, () => handoffBody(args), args.lease);
  if (op.busy) { const h = args.store.read().handoffs?.[args.memberId]; return { migrated: false, inProgress: true, phase: h?.phase ?? null, successor: h?.successor ?? null, operationOwner: { pid: op.owner.pid, since: op.owner.since } }; }
  return op.value;
}

async function handoffBody({ store, herdr, teamDir, memberId, checkpoint, providerState, boundaryObservation = null, force = false }) {
  // `force` only skips the "is a migration pending" gate for operator-initiated moves; it can never
  // bypass negative thresholds, ownership/quiescence proof or the boundary re-check below.
  let state = store.read();
  const member = state.members[memberId];
  if (!member) throw new TeamError('MEMBER_NOT_FOUND', memberId);
  let h = state.handoffs?.[memberId];
  if (h?.phase === 'cancelled') {
    const pending = member.model?.pending;
    const newer = pending && Date.parse(pending.since ?? 0) > Date.parse(h.cancelledAt ?? 0);
    if (!newer) return { migrated: false, cancelled: true, terminal: true, cancelledAt: h.cancelledAt, reservedPane: h.reserve?.paneId ?? null };
    store.update(s => { delete s.handoffs[memberId]; }); // history keeps the cancelled record
    h = undefined;
  }
  if (h?.phase === 'successor-launched') return { migrated: true, from: memberId, to: h.successor, phase: h.phase, terminal: true };

  if (!h) {
    if (!checkpoint) throw new TeamError('CHECKPOINT_REQUIRED', 'save progress to a file first (--checkpoint)');
    const cp = path.resolve(checkpoint);
    if (!fs.existsSync(cp) || !fs.statSync(cp).isFile()) throw new TeamError('CHECKPOINT_NOT_FOUND', cp);
    const entry = modelEntry(state, member);
    if (entry.remainingThreshold.value < 0) throw new TeamError('NEGATIVE_THRESHOLD_WAITS', memberId); // keeps waiting on its own model
    const { recheckAtBoundary } = await import('./models.mjs');
    const check = recheckAtBoundary(entry, member.model, boundaryObservation ?? member.model.lastObservation ?? null);
    if (!check.migrate && !force) { store.update(s => { s.members[memberId].model = check.state; }); return { migrated: false, cancelled: Boolean(check.cancelled) }; }
    store.update(s => { s.handoffs ??= {}; s.handoffs[memberId] = { phase: 'requested', checkpoint: cp, at: new Date().toISOString() }; });
    h = store.read().handoffs[memberId];
  }

  if (h.phase === 'requested') {
    const owned = member.paneId && member.agent?.session && member.launch?.step === 'prompted';
    if (!owned) { store.update(s => { s.handoffs[memberId].blocked = 'predecessor-pane-ownership-unproven'; }); throw new TeamError('AWAITING_QUIESCE', 'cannot prove this tool owns the predecessor pane; stop that agent yourself, then rerun'); }
    state = store.read();
    const pick = await chooseEntry({ config: state.config, roleId: member.roleId, from: member.model.cursor + 1, providerState, exhaustedPools: new Set(Object.keys(state.quotaPools ?? {})) });
    if (pick.index < 0) {
      // Nothing to hand over to: keep the predecessor pane and report; never close the only PM first.
      store.update(s => { s.members[memberId].model.status = 'no-next-entry'; s.handoffs[memberId].blocked = 'no-next-entry'; });
      throw new TeamError('NO_NEXT_MODEL_ENTRY', JSON.stringify(pick.reasons));
    }
    const { workspaceId, tabId } = state.placement ?? {};
    if (!tabId) throw new TeamError('PLACEMENT_REQUIRED');
    // Record the intent, then reserve the pane (grid.cjs). Recovery finds it by its unique label.
    const reserveLabel = `${paneName(memberId + '→', state.config.roles[member.roleId].displayName, state.task.name, pick.entry.model)}`;
    store.update(s => { s.handoffs[memberId].reserve = { cursor: pick.index, label: reserveLabel, requestedAt: new Date().toISOString() }; });
    let paneId = null;
    const already = (await herdr.panes(workspaceId)).filter(x => x.tab_id === tabId && x.label === reserveLabel && !x.agent);
    if (already.length > 1) throw new TeamError('AMBIGUOUS_RECOVERY', reserveLabel);
    paneId = already[0]?.pane_id ?? (await herdr.gridSplit({ workspaceId, tabId, cwd: state.cwd, name: reserveLabel })).new_pane_id;
    store.update(s => { s.handoffs[memberId].reserve.paneId = paneId; s.handoffs[memberId].phase = 'reserved'; });
    h = store.read().handoffs[memberId];
  }

  if (h.phase === 'reserved') {
    state = store.read();
    // Real safe boundary: take the latest non-inference observation NOW (the one from 'requested' may
    // be hours old). Reliable recovery before the transfer cancels the migration; unknown keeps it.
    const entryNow = modelEntry(store.read(), member);
    const fresh = await providerState.observation(entryNow.provider, { probe: true, refresh: true });
    if (fresh) applyObservation(store, memberId, entryNow, fresh);
    const { recheckAtBoundary } = await import('./models.mjs');
    const cur = store.read().members[memberId];
    // Only a recorded pending migration can be cancelled, and only by reliable recovery evidence.
    // `force` is an operator-requested move (no pending needed); it never overrides recovery
    // evidence for a pending one, never skips ownership/quiescence proof, never touches thresholds.
    if (cur.model.pending) {
      const check = recheckAtBoundary(entryNow, cur.model, cur.model.lastObservation ?? null);
      if (!check.migrate) {
        store.update(s => {
        s.members[memberId].model = check.state;
        const rec = s.handoffs[memberId];
        rec.phase = 'cancelled'; rec.cancelledAt = new Date().toISOString();
        // Keep the cancelled record as evidence; a later pending migration gets a new record.
        s.handoffHistory ??= {}; (s.handoffHistory[memberId] ??= []).push(structuredClone(rec));
      });
        return { migrated: false, cancelled: true, reservedPane: h.reserve?.paneId ?? null, note: 'reserved pane kept as an empty shell; close it yourself if not needed' };
      }
    }
    const agent = member.paneId ? await herdr.agent(member.paneId).catch(() => null) : null;
    if (agent) {
      if (agent.agent_session?.value !== member.agent.session) throw new TeamError('AWAITING_QUIESCE', 'pane session changed; not the predecessor we started');
      if (!['idle', 'done'].includes(agent.agent_status)) throw new TeamError('PREDECESSOR_NOT_AT_SAFE_BOUNDARY', agent.agent_status);
      // Record before closing: this process may be the one running inside the pane being closed.
      store.update(s => { s.handoffs[memberId].closing = { paneId: member.paneId, at: new Date().toISOString() }; });
      await herdr.closePane(member.paneId);
    }
    const still = await herdr.pane(member.paneId).catch(() => 'unknown');
    if (still) throw new TeamError('AWAITING_QUIESCE', 'predecessor pane still present after close; not transferring');
    store.update(s => { s.handoffs[memberId].phase = 'quiesced'; s.handoffs[memberId].quiescedAt = new Date().toISOString(); });
    h = store.read().handoffs[memberId];
  }

  if (h.phase === 'quiesced') {
    state = store.read();
    // One transaction: retire predecessor, create successor on the reserved pane, move write
    // scopes/assignments/PM, record phase and successor id.
    store.update(s => {
      const to = migrateMember(s, memberId, { checkpoint: h.checkpoint, cursor: h.reserve.cursor });
      to.reservedPaneId = h.reserve.paneId;
      s.handoffs[memberId].phase = 'transferred'; s.handoffs[memberId].successor = to.memberId;
    });
    h = store.read().handoffs[memberId];
  }

  if (h.phase === 'transferred') {
    const launched = await launchMember(store, herdr, h.successor, { teamDir, providerState });
    // Someone else is launching the successor right now: do not claim it is launched; report progress.
    if (launched.inProgress || launched.launch?.step !== 'prompted') return { migrated: true, from: memberId, to: h.successor, phase: h.phase, inProgress: Boolean(launched.inProgress) };
    store.update(s => { s.handoffs[memberId].phase = 'successor-launched'; });
    h = store.read().handoffs[memberId];
  }
  return { migrated: true, from: memberId, to: h.successor, phase: h.phase };
}

// Handoffs that were interrupted (e.g. the process died with the pane it was running in) are
// resumed from their recorded phase by the watcher, never restarted from scratch.
// A finished or cancelled handoff is never resumed or re-reported; the record stays as evidence.
export const TERMINAL_HANDOFF_PHASES = new Set(['successor-launched', 'cancelled']);

export async function resumeHandoffs({ store, herdr, teamDir, providerState }) {
  const out = [];
  for (const [memberId, h] of Object.entries(store.read().handoffs ?? {})) {
    if (TERMINAL_HANDOFF_PHASES.has(h.phase) || (h.blocked === 'no-next-entry' && h.phase === 'requested')) continue;
    try { out.push(await handoff({ store, herdr, teamDir, memberId, checkpoint: h.checkpoint, providerState, force: true })); }
    catch (error) { out.push({ memberId, error: error.code ?? error.message }); }
  }
  return out;
}

// --- watcher lifecycle --------------------------------------------------------------------
export const watcherFile = teamDir => path.join(teamDir, 'watcher.json');
export function watcherStatus(teamDir, isAlive = processAlive) {
  const info = readJson(watcherFile(teamDir));
  if (!info) return { running: false };
  return { running: isAlive(info.pid), ...info };
}

// Registers the single watcher owner under a short lock: check-and-write is atomic, so two
// processes cannot both become owner. A record whose pid is gone may be replaced.
export function claimWatcher(teamDir, { pid = process.pid, nonce = randomUUID(), interval, isAlive = processAlive } = {}) {
  return withLock(path.join(teamDir, 'watcher-lock'), () => {
    const info = readJson(watcherFile(teamDir));
    if (info && info.pid !== pid && isAlive(info.pid)) return { claimed: false, owner: info };
    const record = { pid, nonce, interval, startedAt: new Date().toISOString() };
    writeAtomic(watcherFile(teamDir), JSON.stringify(record) + '\n');
    return { claimed: true, record };
  });
}

// Graceful stop: marks the record; the owner exits after its current cycle. No PID is killed.
export function requestWatcherStop(teamDir) {
  return withLock(path.join(teamDir, 'watcher-lock'), () => {
    const info = readJson(watcherFile(teamDir));
    if (!info || !processAlive(info.pid)) { fs.rmSync(watcherFile(teamDir), { force: true }); return { stopped: false, reason: 'not running' }; }
    writeAtomic(watcherFile(teamDir), JSON.stringify({ ...info, stop: true }) + '\n');
    return { stopRequested: true, pid: info.pid };
  });
}

// True while this process still owns the record and nobody asked it to stop.
export function stillOwner(teamDir, nonce) {
  const info = readJson(watcherFile(teamDir));
  return Boolean(info && info.nonce === nonce && !info.stop);
}
