#!/usr/bin/env node
// task-team command. Run `node tooling/team/cli.mjs help` for usage.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { TeamStore, readJson, writeAtomic } from './lib/store.mjs';
import { createTeamState, addInitialMembers, propose, decide, assign, extendDeadline, acceptCompletion, persistApprovedRoles, currentPm, claimWrite } from './lib/team.mjs';
import { createHerdr } from './lib/herdr.mjs';
import { ensurePlacement, launchMember, tick, migrate } from './lib/controller.mjs';
import { acknowledge, loadDelivery } from './lib/sender.mjs';
import { writeEvent } from './lib/outbox.mjs';
import { checkAuth, observe } from './lib/providers.mjs';
import { checkTransport } from './lib/permissions.mjs';
import { evaluate, markPending, recheckAtBoundary } from './lib/models.mjs';

const HELP = `用法：node tooling/team/cli.mjs <命令> [選項]
  start     --config <組態> --task <任務名> [--task-file <檔>] [--cwd <目錄>] [--space <id|名稱>] [--tab <id|名稱>] [--team-dir <目錄>] [--dry-run]
  status    --team-dir <目錄>
  members   --team-dir <目錄> --roles <R1,R2>            初始組隊（僅組隊期間，PM 從已啟用角色選）
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
  watch     --team-dir <目錄> [--interval <秒>] [--background]
  usage     --team-dir <目錄> --member <id> (--remaining <n> | --signal <s> | --probe) [--reliable]
  boundary  --team-dir <目錄> --member <id> [--checkpoint <檔>]   安全邊界：再核對並必要時遷移
  claim     --team-dir <目錄> --member <id> --scope <範圍>
  auth      --config <組態>                               provider 認證前檢（只回報模式）
  check-transport --team-dir <目錄> --member <id>`;

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
      const pm = await launchMember(store, herdr, state.pm.memberId, { teamDir, providersCheck: deps.providersCheck });
      return { teamDir, teamId: state.teamId, placement: store.read().placement, pm: { memberId: pm.memberId, paneId: pm.paneId, step: pm.launch.step } };
    }
    case 'status': {
      const s = storeOf(o).read();
      const delivery = loadDelivery(o['team-dir']).records;
      return { teamId: s.teamId, task: s.task, placement: s.placement, pm: s.pm.memberId, forming: s.forming,
        members: Object.values(s.members).map(m => ({ memberId: m.memberId, roleId: m.roleId, status: m.status, paneId: m.paneId, step: m.launch.step, model: m.model })),
        proposals: s.proposals, assignments: s.assignments,
        delivery: Object.values(delivery).reduce((acc, r) => { acc[r.state] = (acc[r.state] ?? 0) + 1; return acc; }, {}) };
    }
    case 'members': { need(o, 'roles'); return storeOf(o).update(s => ({ value: addInitialMembers(s, o.roles.split(',')) })); }
    case 'launch': {
      need(o, 'member'); const store = storeOf(o);
      const s = store.read();
      if (!s.placement) throw new Error('PLACEMENT_REQUIRED');
      const m = await launchMember(store, herdr, o.member, { teamDir: store.dir, providersCheck: deps.providersCheck });
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
      const member = store.read().members[o.member];
      if (!member.paneId) return { ...a, sent: false, reason: 'MEMBER_NOT_LAUNCHED' };
      const r = await herdr.prompt(member.paneId, `[task-team 派工 ${a.taskId}] ${o.summary}\n請先送 ack 事件（taskId=${a.taskId}），完成時送 completed。`);
      store.update(s => { if (r.outcome === 'sent') { s.assignments[a.taskId].sentAt = new Date().toISOString(); s.assignments[a.taskId].status = 'sent'; } else s.assignments[a.taskId].sendError = r.outcome; });
      return { taskId: a.taskId, outcome: r.outcome };
    }
    case 'extend': { need(o, 'task-id', 'until'); return storeOf(o).update(s => { extendDeadline(s, o['task-id'], new Date(o.until).toISOString()); }).assignments[o['task-id']]; }
    case 'accept': { need(o, 'task-id'); return storeOf(o).update(s => { acceptCompletion(s, o['task-id']); }).assignments[o['task-id']]; }
    case 'event': {
      need(o, 'member', 'type', 'summary'); const store = storeOf(o); const s = store.read();
      return writeEvent(store.dir, s.teamId, o.member, { type: o.type, summary: o.summary, taskId: o['task-id'], to: o.to, paths: o.paths ? o.paths.split(',') : undefined });
    }
    case 'ack': { need(o, 'team-dir'); if (!o.events?.length) throw new Error('MISSING_OPTION: --events'); return acknowledge(path.resolve(o['team-dir']), o.events, new Date().toISOString()); }
    case 'tick': { const store = storeOf(o); return tick({ teamDir: store.dir, herdr }); }
    case 'watch': {
      const store = storeOf(o); const interval = Math.max(5, Number(o.interval ?? store.read().config.usage?.pollIntervalSeconds ?? 60));
      if (o.background) {
        // Detached and hidden: no extra Herdr pane is opened for the watcher.
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'watch', '--team-dir', store.dir, '--interval', String(interval)], { detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        writeAtomic(path.join(store.dir, 'watcher.json'), JSON.stringify({ pid: child.pid, interval, startedAt: new Date().toISOString() }) + '\n');
        return { background: true, pid: child.pid };
      }
      for (;;) {
        try { const r = await tick({ teamDir: store.dir, herdr }); store.log({ kind: 'tick', newEvents: r.newEvents, late: r.late.length }); } catch (e) { store.log({ kind: 'tick-error', error: e.message }); }
        await new Promise(r => setTimeout(r, interval * 1000));
      }
    }
    case 'usage': {
      need(o, 'member'); const store = storeOf(o); const s = store.read(); const m = s.members[o.member];
      if (!m) throw new Error(`MEMBER_NOT_FOUND: ${o.member}`);
      const entry = (await import('./lib/team.mjs')).modelEntry(s, m);
      let obs;
      if (o.probe) obs = await observe(s.config.providers[entry.provider], deps.observeDeps);
      else obs = { at: new Date().toISOString(), reliable: o.reliable === true, remaining: o.remaining !== undefined ? Number(o.remaining) : undefined, signal: o.signal ?? null, source: 'manual' };
      const verdict = evaluate(entry, obs);
      return store.update(st => {
        const mm = st.members[o.member];
        mm.model.lastObservation = obs;
        if (verdict === 'wait') mm.model.status = 'waiting-for-quota';
        if (verdict === 'switch') mm.model = markPending(mm.model, verdict, obs);
        if (verdict === 'continue' && mm.model.status === 'waiting-for-quota' && obs.reliable) mm.model.status = 'active';
        if (verdict === 'non-quota-error') mm.model.lastNonQuotaError = obs.signal;
        return { value: { verdict, model: mm.model } };
      });
    }
    case 'boundary': {
      need(o, 'member'); const store = storeOf(o); const s = store.read(); const m = s.members[o.member];
      const entry = (await import('./lib/team.mjs')).modelEntry(s, m);
      const latest = o.probe ? await observe(s.config.providers[entry.provider], deps.observeDeps) : m.model.lastObservation;
      const check = recheckAtBoundary(entry, m.model, latest);
      if (!check.migrate) { store.update(st => { st.members[o.member].model = check.state; }); return { migrated: false, cancelled: Boolean(check.cancelled) }; }
      const checkpoint = o.checkpoint ? path.resolve(o.checkpoint) : null;
      const to = migrate(store, o.member, checkpoint);
      return { migrated: true, from: o.member, to: to.memberId, cursor: to.model.cursor, note: '以 launch 啟動接手者；原 pane 不自動關閉' };
    }
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
