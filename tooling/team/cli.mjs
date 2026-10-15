#!/usr/bin/env node
// task-team command. Run `node tooling/team/cli.mjs help` for usage.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { TeamStore, readJson, writeAtomic } from './lib/store.mjs';
import { createTeamState, addInitialMembers, propose, decide, assign, extendDeadline, acceptCompletion, persistApprovedRoles, claimWrite, closeForming, modelEntry } from './lib/team.mjs';
import { createHerdr } from './lib/herdr.mjs';
import { ensurePlacement, launchMember, tick, handoff, adoptTab, watcherStatus, applyObservation, claimWatcher, requestWatcherStop, stillOwner, attention } from './lib/controller.mjs';
import { randomUUID } from 'node:crypto';
import { acknowledge, loadDelivery, resolveUncertain } from './lib/sender.mjs';
import { createProviderState } from './lib/selection.mjs';
import { writeEvent } from './lib/outbox.mjs';
import { checkAuth, observe } from './lib/providers.mjs';
import { checkTransport } from './lib/permissions.mjs';

const HELP = `用法：node tooling/team/cli.mjs <命令> [選項]
  start     --config <組態> --task <任務名> [--task-file <檔>] [--cwd <目錄>] [--space <id|名稱>] [--tab <id|名稱>] [--team-dir <目錄>] [--no-watch] [--dry-run]
  status    --team-dir <目錄>
  members   --team-dir <目錄> --roles <R1,R2>            初始組隊（僅組隊期間，PM 從已啟用角色選；不可含 PM 角色）
  form-done --team-dir <目錄>                             結束組隊期間；之後增員一律走 propose/decide
  launch    --team-dir <目錄> --member <memberId>         建 pane（grid.cjs）並啟動；可重跑恢復
  propose   --team-dir <目錄> --file <提案.json>          擴充提案（新角色或增派成員）
  decide    --team-dir <目錄> --request <id> --version <n> --decision approve|reject --source <來源> [--persist-shared]
  persist   --team-dir <目錄> --request <id> --config <共用組態>   需批准時明示 persist-shared
  assign    --team-dir <目錄> --member <id> --summary <文字> [--task-id <id>] [--ack <秒>] [--progress <秒>] [--hard <秒>]
  extend    --team-dir <目錄> --task-id <id> --until <ISO 時間>
  accept    --team-dir <目錄> --task-id <id>              PM 確認成果後才驗收
  event     --team-dir <目錄> --member <id> --type <類型> --summary <文字> [--task-id <id>] [--to <memberId>] [--paths a,b]
  ack       --team-dir <目錄> --events <id ...>           PM 確認收到事件
  tick      --team-dir <目錄>                             一次 watcher 週期
  watch     --team-dir <目錄> [--interval <秒>] [--background] [--probe-usage] [--scan-limits]   唯一 watcher；已有存活 watcher 時拒絕
  usage     --team-dir <目錄> --member <id> (--remaining <n> | --signal <s> | --probe) [--reliable]
  handoff   --team-dir <目錄> --member <id> --checkpoint <檔> [--probe]   安全邊界交接（PM/任一角色）：預留接手 pane→真實邊界重新觀測用量（必做）→驗證舊 pane 已停止→轉權→啟動接手者；可重跑恢復
  resolve   --team-dir <目錄> --id <項目id> --decision resend|drop     PM 處置「不確定是否送達」的項目
  adopt-tab --team-dir <目錄> --tab <tabId> --space <workspaceId>     核對後承接崩潰時可能已建立的 tab
  stop-watch --team-dir <目錄>                            停止背景 watcher
  claim     --team-dir <目錄> --member <id> --scope <範圍>
  auth      --config <組態>                               provider 認證前檢（只回報模式）
  check-transport --team-dir <目錄> --member <id>                   只檢查本機 outbox 可寫與 notify 存在，不是 Claude 權限驗證`;

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const key = a.slice(2);
    if (key === 'events') { out.events = []; while (argv[i + 1] && !argv[i + 1].startsWith('--')) out.events.push(argv[++i]); continue; }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true; else { out[key] = next; i++; }
  }
  return out;
}

const need = (o, ...keys) => { for (const k of keys) if (o[k] === undefined || o[k] === true) throw new Error(`MISSING_OPTION: --${k}`); };
const storeOf = o => { need(o, 'team-dir'); return new TeamStore(o['team-dir']); };

// Starts the single hidden background watcher for a team and waits until it owns watcher.json.
// If one is already running it is reused (never a second one). Returns { background, pid, reused }.
export async function ensureBackgroundWatcher(teamDir, { interval = 60, probeUsage = true, scanLimits = true } = {}) {
  const existing = watcherStatus(teamDir);
  if (existing.running) return { background: true, pid: existing.pid, reused: true };
  const args = ['watch', '--team-dir', teamDir, '--interval', String(interval), ...(probeUsage ? ['--probe-usage'] : []), ...(scanLimits ? ['--scan-limits'] : [])];
  // Hidden, detached, no extra pane. The caller waits until the child owns watcher.json or fails.
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], { detached: true, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = ''; child.stderr.on('data', d => { stderr += d; });
  const exited = new Promise(r => child.once('exit', code => r({ exited: true, code })));
  const confirmed = (async () => { for (let i = 0; i < 100; i++) { const w = watcherStatus(teamDir); if (w.running && w.pid === child.pid) return { owner: true }; await new Promise(r => setTimeout(r, 50)); } return { owner: false }; })();
  const first = await Promise.race([exited, confirmed]);
  if (first.exited || !first.owner) {
    // Another process may have won the race: that is fine, it is the owner.
    const now = watcherStatus(teamDir);
    if (now.running) return { background: true, pid: now.pid, reused: true };
    throw new Error('WATCHER_START_FAILED: ' + (stderr.trim() || 'exit ' + first.code));
  }
  child.stderr.destroy(); child.unref();
  return { background: true, pid: child.pid, reused: false };
}

export async function main(argv, deps = {}) {
  const [command, ...rest] = argv;
  const o = parse(rest);
  const herdr = deps.herdr ?? createHerdr();
  const env = deps.env ?? process.env;
  switch (command) {
    case 'start': {
      need(o, 'config', 'task');
      const config = loadConfig(o.config);
      const cwd = path.resolve(o.cwd ?? process.cwd());
      const state = createTeamState(config, { taskName: o.task, taskFile: o['task-file'], cwd, teamId: o['team-id'] });
      const teamDir = path.resolve(o['team-dir'] ?? path.join(cwd, '.team', state.teamId));
      if (o['dry-run']) return { dryRun: true, teamDir, teamId: state.teamId, pm: state.pm.memberId, space: o.space ?? env.HERDR_WORKSPACE_ID ?? null, tab: o.tab ?? `(新建) ${o.task}` };
      const store = new TeamStore(teamDir);
      store.create(state);
      await ensurePlacement(store, herdr, { space: o.space, tab: o.tab, env });
      const pm = await launchMember(store, herdr, state.pm.memberId, { teamDir, providerState: deps.providerState ?? createProviderState({ config, authDeps: deps.authDeps, observeDeps: deps.observeDeps }) });
      // Without a running watcher nothing monitors deadlines, delivery or a failing PM: start it by default.
      const watcher = o['no-watch'] === true ? { background: false, skipped: 'no-watch' } : await ensureBackgroundWatcher(teamDir, { interval: Math.max(5, Number(o.interval ?? config.usage?.pollIntervalSeconds ?? 60)) });
      return { teamDir, teamId: state.teamId, placement: store.read().placement, pm: { memberId: pm.memberId, paneId: pm.paneId, step: pm.launch.step }, watcher };
    }
    case 'status': {
      const s = storeOf(o).read();
      const delivery = loadDelivery(o['team-dir']).records;
      return { teamId: s.teamId, task: s.task, placement: s.placement, pm: s.pm.memberId, forming: s.forming,
        members: Object.values(s.members).map(m => ({ memberId: m.memberId, roleId: m.roleId, status: m.status, paneId: m.paneId, step: m.launch.step, model: m.model })),
        proposals: s.proposals, assignments: s.assignments, attention: attention(s, o['team-dir']), watcher: watcherStatus(path.resolve(o['team-dir'])),
        delivery: Object.values(delivery).reduce((acc, r) => { acc[r.state] = (acc[r.state] ?? 0) + 1; return acc; }, {}) };
    }
    case 'members': { need(o, 'roles'); return storeOf(o).update(s => ({ value: addInitialMembers(s, o.roles.split(',')) })); }
    case 'form-done': { storeOf(o).update(s => { closeForming(s); }); return { forming: false }; }
    case 'launch': {
      need(o, 'member'); const store = storeOf(o);
      const s = store.read();
      if (!s.placement) throw new Error('PLACEMENT_REQUIRED');
      const m = await launchMember(store, herdr, o.member, { teamDir: store.dir, providerState: deps.providerState ?? createProviderState({ config: s.config, authDeps: deps.authDeps, observeDeps: deps.observeDeps }) });
      return { memberId: m.memberId, paneId: m.paneId, step: m.launch.step };
    }
    case 'propose': { need(o, 'file'); const input = readJson(o.file); if (!input) throw new Error('PROPOSAL_FILE_NOT_FOUND'); return storeOf(o).update(s => ({ value: propose(s, input) })); }
    case 'decide': {
      need(o, 'request', 'version', 'decision', 'source');
      return storeOf(o).update(s => ({ value: decide(s, o.request, { decision: o.decision, version: Number(o.version), source: o.source, persistToShared: o['persist-shared'] === true }) ?? { rejected: o.request } }));
    }
    case 'persist': {
      need(o, 'request', 'config');
      const shared = JSON.parse(fs.readFileSync(o.config, 'utf8'));
      const { config, added } = persistApprovedRoles(shared, storeOf(o).read(), o.request);
      writeAtomic(path.resolve(o.config), JSON.stringify(config, null, 2) + '\n');
      return { added };
    }
    case 'assign': {
      need(o, 'member', 'summary'); const store = storeOf(o);
      const deadlines = {}; if (o.ack) deadlines.ackSeconds = Number(o.ack); if (o.progress) deadlines.progressSeconds = Number(o.progress); if (o.hard) deadlines.hardNoReportSeconds = Number(o.hard);
      const a = store.update(s => ({ value: assign(s, { memberId: o.member, summary: o.summary, taskId: o['task-id'], deadlines }) }));
      // Delivery goes through the journal; the deadline clock starts only when it records sent.
      const r = await tick({ teamDir: store.dir, herdr, diagnose: false });
      const rec = loadDelivery(store.dir).records['assign-' + a.taskId];
      return { taskId: a.taskId, delivery: rec?.state ?? 'queued', detail: r.delivery.results.find(x => x.id === 'assign-' + a.taskId) ?? null };
    }
    case 'extend': { need(o, 'task-id', 'until'); return storeOf(o).update(s => { extendDeadline(s, o['task-id'], new Date(o.until).toISOString()); }).assignments[o['task-id']]; }
    case 'accept': { need(o, 'task-id'); return storeOf(o).update(s => { acceptCompletion(s, o['task-id']); }).assignments[o['task-id']]; }
    case 'event': {
      need(o, 'member', 'type', 'summary'); const store = storeOf(o); const s = store.read();
      return writeEvent(store.dir, s.teamId, o.member, { type: o.type, summary: o.summary, taskId: o['task-id'], to: o.to, paths: o.paths ? o.paths.split(',') : undefined });
    }
    case 'ack': { need(o, 'team-dir'); if (!o.events?.length) throw new Error('MISSING_OPTION: --events'); return acknowledge(path.resolve(o['team-dir']), o.events, new Date().toISOString()); }
    case 'tick': { const store = storeOf(o); return tick({ teamDir: store.dir, herdr, probeUsage: o['probe-usage'] === true, scanLimits: o['scan-limits'] === true }); }
    case 'watch': {
      const store = storeOf(o); const interval = Math.max(5, Number(o.interval ?? store.read().config.usage?.pollIntervalSeconds ?? 60));
      const args = ['watch', '--team-dir', store.dir, '--interval', String(interval), ...(o['probe-usage'] ? ['--probe-usage'] : []), ...(o['scan-limits'] ? ['--scan-limits'] : [])];
      if (o.background) return { ...(await ensureBackgroundWatcher(store.dir, { interval, probeUsage: o['probe-usage'] === true, scanLimits: o['scan-limits'] === true })), note: 'stop with stop-watch' };
      const nonce = randomUUID();
      const claim = claimWatcher(store.dir, { nonce, interval });
      if (!claim.claimed) throw new Error('WATCHER_ALREADY_RUNNING: pid ' + claim.owner.pid);
      while (stillOwner(store.dir, nonce)) {
        try {
          const providerState = createProviderState({ config: store.read().config, authDeps: deps.authDeps, observeDeps: deps.observeDeps });
          const r = await tick({ teamDir: store.dir, herdr, probeUsage: o['probe-usage'] === true, scanLimits: o['scan-limits'] === true, providerState });
          store.log({ kind: 'tick', events: r.events, late: r.late.length });
        } catch (e) { store.log({ kind: 'tick-error', error: e.message }); }
        await new Promise(r => setTimeout(r, (deps.watchIntervalMs ?? interval * 1000)));
        if (deps.watchMaxCycles !== undefined && --deps.watchMaxCycles <= 0) break;
      }
      return { stopped: true };
    }
    case 'stop-watch': { const store = storeOf(o); return requestWatcherStop(store.dir); }
    case 'usage': {
      need(o, 'member'); const store = storeOf(o); const st = store.read(); const m = st.members[o.member];
      if (!m) throw new Error('MEMBER_NOT_FOUND: ' + o.member);
      const entry = modelEntry(st, m);
      let obs;
      if (o.probe) obs = await observe(st.config.providers[entry.provider], deps.observeDeps);
      else obs = { at: new Date().toISOString(), reliable: o.reliable === true, remaining: o.remaining !== undefined ? Number(o.remaining) : undefined, signal: o.signal ?? null, source: 'manual' };
      const verdict = applyObservation(store, o.member, entry, obs);
      return { verdict, model: store.read().members[o.member].model };
    }
    case 'handoff': {
      need(o, 'member', 'checkpoint'); const store = storeOf(o); const st = store.read();
      const providerState = deps.providerState ?? createProviderState({ config: st.config, authDeps: deps.authDeps, observeDeps: deps.observeDeps });
      const entry = modelEntry(st, st.members[o.member]);
      const boundaryObservation = o.probe ? await providerState.observation(entry.provider) : null;
      return handoff({ store, herdr, teamDir: store.dir, memberId: o.member, checkpoint: o.checkpoint, providerState, boundaryObservation });
    }
    case 'resolve': { need(o, 'id', 'decision'); return { id: o.id, state: resolveUncertain(path.resolve(o['team-dir']), o.id, o.decision) }; }
    case 'adopt-tab': { need(o, 'tab', 'space'); return adoptTab(storeOf(o), { tabId: o.tab, workspaceId: o.space }); }
    case 'claim': { need(o, 'member', 'scope'); storeOf(o).update(s => { claimWrite(s, o.scope, o.member); }); return { scope: o.scope, owner: o.member }; }
    case 'auth': {
      need(o, 'config'); const config = loadConfig(o.config); const out = {};
      for (const [id, p] of Object.entries(config.providers)) out[id] = await checkAuth(p, deps.authDeps);
      return out;
    }
    case 'check-transport': { need(o, 'member'); const store = storeOf(o); return checkTransport(store.dir, o.member); }
    case 'help': case undefined: return HELP;
    default: throw new Error(`UNKNOWN_COMMAND: ${command}\n${HELP}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    r => console.log(typeof r === 'string' ? r : JSON.stringify(r, null, 2)),
    e => { console.error(e.message); process.exitCode = 1; },
  );
}
