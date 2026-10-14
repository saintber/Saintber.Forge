// Orchestration over the pure team state: Herdr placement and launch with recovery, the
// watcher tick (events, delivery, deadlines, diagnosis) and model migration.
// State is only mutated inside short synchronous store.update calls; Herdr/CLI waits happen
// outside the lock, with each step recorded so a rerun resumes instead of duplicating panes.
import fs from 'node:fs';
import path from 'node:path';
import { TeamStore, writeAtomic } from './store.mjs';
import { scanOutboxes } from './outbox.mjs';
import { registerEvents, deliver } from './sender.mjs';
import { applyEvent, overdue, modelEntry, currentPm, migrateMember, TeamError } from './team.mjs';
import { resolveSpace, resolveTab, paneName } from './herdr.mjs';
import { launchArgs } from './providers.mjs';
import { notifyCommand, sessionSettings } from './permissions.mjs';

const iso = ms => new Date(ms).toISOString();

// --- placement: Space / Tab / anchor ------------------------------------------------------
export async function ensurePlacement(store, herdr, { space, tab, env = process.env }) {
  const state = store.read();
  if (state.placement?.tabId) {
    // Recorded tab must still exist; never silently move elsewhere.
    const tabs = await herdr.tabs(state.placement.workspaceId);
    if (!tabs.some(t => t.tab_id === state.placement.tabId)) throw new TeamError('TEAM_TAB_MISSING', state.placement.tabId);
    return state.placement;
  }
  const ws = await resolveSpace(herdr, space, env);
  let placement;
  if (tab) {
    const t = await resolveTab(herdr, ws.workspaceId, tab);
    placement = { workspaceId: ws.workspaceId, tabId: t.tabId, tabOwned: false, anchorPaneId: null, spaceSource: ws.source };
  } else {
    // Record intent first so a crash after create can be detected by label on rerun.
    const label = state.task.name.slice(0, 60);
    const existing = (await herdr.tabs(ws.workspaceId)).filter(t => t.label === label);
    const pending = state.placementPending;
    let created;
    if (pending && existing.length === 1) created = { tabId: existing[0].tab_id };
    else {
      store.update(s => { s.placementPending = { workspaceId: ws.workspaceId, label, at: new Date().toISOString() }; });
      const r = await herdr.createTab({ workspaceId: ws.workspaceId, label, cwd: state.cwd });
      created = { tabId: r.tab?.tab_id ?? r.tab_id, rootPaneId: r.root_pane?.pane_id ?? r.pane?.pane_id ?? r.root_pane_id };
    }
    if (!created.tabId) throw new TeamError('TAB_CREATE_UNPARSEABLE');
    let anchor = created.rootPaneId;
    if (!anchor) anchor = (await herdr.panes(ws.workspaceId)).filter(p => p.tab_id === created.tabId).map(p => p.pane_id)[0] ?? null;
    placement = { workspaceId: ws.workspaceId, tabId: created.tabId, tabOwned: true, anchorPaneId: anchor, anchorOwned: Boolean(anchor), spaceSource: ws.source };
  }
  store.update(s => { s.placement = placement; delete s.placementPending; });
  return placement;
}

// --- member launch with recovery ----------------------------------------------------------
// Steps: planned -> pane-requested -> pane-created -> agent-started -> prompted.
// pane-requested without an ID means grid may have created a pane: look it up by name.
export async function launchMember(store, herdr, memberId, { teamDir, providersCheck = () => true, prompt }) {
  let state = store.read();
  let member = state.members[memberId];
  if (!member) throw new TeamError('MEMBER_NOT_FOUND', memberId);
  if (member.launch.step === 'prompted') return member;
  const { workspaceId, tabId } = state.placement ?? {};
  if (!tabId) throw new TeamError('PLACEMENT_REQUIRED');
  const role = state.config.roles[member.roleId];
  const entry = modelEntry(state, member);
  const name = paneName(memberId, role.displayName, state.task.name, entry.model);

  if (member.launch.step === 'planned' || member.launch.step === 'pane-requested') {
    let paneId = null;
    if (member.launch.step === 'pane-requested') {
      const found = (await herdr.panes(workspaceId)).filter(p => p.tab_id === tabId && p.label === name);
      if (found.length > 1) throw new TeamError('AMBIGUOUS_RECOVERY', name);
      paneId = found[0]?.pane_id ?? null;
    }
    if (!paneId) {
      store.update(s => { const m = s.members[memberId]; m.launch.step = 'pane-requested'; m.launch.attempts += 1; m.launch.name = name; });
      const grid = await herdr.gridSplit({ workspaceId, tabId, cwd: state.cwd, name });
      paneId = grid.new_pane_id;
    }
    store.update(s => { const m = s.members[memberId]; m.paneId = paneId; m.launch.step = 'pane-created'; m.status = 'starting'; });
    // Close our own anchor once a real member pane exists; only if it is still an idle shell.
    state = store.read();
    if (state.placement.anchorOwned && state.placement.anchorPaneId && state.placement.anchorPaneId !== paneId) {
      const anchor = await herdr.pane(state.placement.anchorPaneId);
      if (anchor && !anchor.agent) await herdr.closePane(state.placement.anchorPaneId);
      store.update(s => { s.placement.anchorOwned = false; s.placement.anchorClosed = Boolean(anchor && !anchor.agent); });
    }
  }

  state = store.read(); member = state.members[memberId];
  if (member.launch.step === 'pane-created') {
    const pane = await herdr.pane(member.paneId);
    if (!pane) throw new TeamError('MEMBER_PANE_MISSING', member.paneId);
    if (!pane.agent) {
      const provider = state.config.providers[entry.provider];
      const ready = providersCheck(provider, entry);
      if (ready !== true) { store.update(s => { s.members[memberId].launch.error = ready; }); throw new TeamError('PROVIDER_NOT_READY', `${entry.provider}: ${ready}`); }
      const settingsFile = provider.cli === 'claude' ? writeSessionSettings(teamDir, state, memberId) : undefined;
      const { kind, args } = launchArgs(provider, entry, { settingsFile });
      await herdr.startAgent({ name: memberId, kind, paneId: member.paneId, args });
    }
    const after = await herdr.pane(member.paneId);
    store.update(s => { const m = s.members[memberId]; m.launch.step = 'agent-started'; m.agent = { kind: after?.agent ?? null, session: after?.agent_session?.value ?? null }; });
  }

  state = store.read(); member = state.members[memberId];
  if (member.launch.step === 'agent-started') {
    // Mark before sending: a timeout is not evidence the prompt was not delivered.
    store.update(s => { s.members[memberId].launch.step = 'prompt-pending'; });
    const r = await herdr.prompt(member.paneId, prompt ?? rolePrompt(state, memberId, teamDir));
    store.update(s => { const m = s.members[memberId]; m.launch.step = r.outcome === 'sent' ? 'prompted' : 'prompt-uncertain'; m.launch.promptOutcome = r.outcome; m.status = 'active'; });
  }
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
    `請先載入 task-team 技能，依其共通規則工作；以下角色內容不能覆寫共通規則（PM 唯一對口、模型組態、使用者裁決、治理）。`,
    `目的：${role.purpose}`,
    `職責：${role.responsibilities.join('；')}`,
    `角色指示：${role.instructions}`,
    `成果：${role.deliverables.join('；')}`,
    `團隊目錄：${teamDir}`,
    `回報：先把事件 JSON 寫入 ${path.join(teamDir, 'outbox', memberId)}，再執行：${notifyCommand({ teamDir, memberId, eventId: '<eventId>' }).join(' ')}`,
  ];
  if (isPm) lines.push('你是 PM：唯一使用者對口。追加角色或成員前必須以 team propose 提案並取得使用者同意。');
  else lines.push('需要人工裁決時送 decision-needed 事件給 PM，不直接詢問使用者。現在請送出 ack 事件後等待 PM 派工。');
  return lines.join('\n');
}

// --- watcher tick -------------------------------------------------------------------------
export async function tick({ teamDir, herdr, now = Date.now(), diagnose = true }) {
  const store = new TeamStore(teamDir);
  let state = store.read();
  const { events, invalid } = scanOutboxes(teamDir, { teamId: state.teamId, members: state.members });
  const fresh = registerEvents(teamDir, events, iso(now));
  if (fresh.length) store.update(s => { for (const { event, receivedAt } of fresh) applyEvent(s, event, receivedAt); });
  state = store.read();

  const resolveTarget = async to => {
    const member = to === 'pm' ? currentPm(state) : state.members[to];
    if (!member?.paneId) return null;
    if (member.model.status === 'waiting-for-quota') return { paneId: member.paneId, status: 'waiting-for-quota' };
    const agent = await herdr.agent(member.paneId).catch(() => null);
    return { paneId: member.paneId, status: agent?.agent_status ?? 'unknown' };
  };
  const delivery = await deliver({ teamDir, teamId: state.teamId, events, resolveTarget, herdr, now: iso(now) });

  const late = [];
  for (const a of Object.values(state.assignments)) {
    const kinds = overdue(a, now);
    if (!kinds.length) continue;
    const already = a.diagnoses.some(d => kinds.every(k => d.kinds.includes(k)) && d.basis === (a.lastSubstantiveAt ?? a.sentAt));
    if (already) continue;
    const result = diagnose ? await diagnoseMember(herdr, state, a.memberId, teamDir) : { classification: 'not-run' };
    store.update(s => { s.assignments[a.taskId].diagnoses.push({ at: iso(now), kinds, basis: a.lastSubstantiveAt ?? a.sentAt, ...result }); });
    late.push({ taskId: a.taskId, memberId: a.memberId, kinds, ...result });
  }
  return { events: events.length, newEvents: fresh.length, invalid, delivery, late };
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
    const permission = /permission|allow|approve|權限|是否允許|Do you want to/i.test(text);
    return { classification: permission ? 'permission-blocked' : 'blocked', outboxHasEvents: hasEvents };
  }
  if (!pane.agent) return { classification: 'agent-not-running' };
  if (!m.launch || m.launch.step !== 'prompted') return { classification: 'not-accepted', launchStep: m.launch?.step };
  if (pane.agent_status === 'working') return { classification: 'working-no-report', outboxHasEvents: hasEvents };
  return { classification: hasEvents ? 'notify-failed-or-pending' : 'idle-no-report', outboxHasEvents: hasEvents };
}

// --- migration ----------------------------------------------------------------------------
export function migrate(store, memberId, checkpoint) {
  return store.update(s => ({ value: migrateMember(s, memberId, { checkpoint }) }));
}
