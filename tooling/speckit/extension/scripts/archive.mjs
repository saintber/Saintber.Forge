#!/usr/bin/env node
// speckit.hub.archive：封存工作包與其輸入（設計 §12.5；POL-SPEC-001 R6、R7；Codex 審閱 R13）
//
// 用法：node archive.mjs --change <NNN-name> [--status adopted|cancelled|superseded] [--root <dir>] [--project <id>] [--date YYYY-MM-DD] [--json]
//
// 規則：
//   - 結構：archive/changes/<change>/{archive.md, inputs/, work/}
//   - archive.md 不記錄自己所在的 commit
//   - adopted 的前提：工作包 **Affected Capabilities** 的**每一個**有效規格，Change Log 都有一列
//     change 欄等於本 change，且 Requirements 欄與工作包目前的 Delta 完全相同（adopt 後工作包又被改 → 拒絕）
//   - cancelled / superseded：只封存；若任何有效規格已記錄本 change 則拒絕
//   - 重試：目標已存在時，比對**完整快照**（archive.md 的狀態、work/、inputs/）；
//     相同 → 已完成；不同 → 報錯，不覆蓋。目標存在但來源已不在 → 驗證目標結構完整才算已完成
//   - 套用：先在暫存區組好完整快照並驗證 → 再比對來源仍未變動 → 寫入目標並驗證
//     → 刪除來源。任何一步失敗都回復本次觸及的全部檔案（含已刪除的來源，從暫存區還原）
//   - 活動上下文：只有 .specify/feature.json 的 feature_directory **精確等於** specs/<change> 才清除
//   - **絕不** git add / commit

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";
import { headCommit, repoRoot, GitError } from "./lib/git.mjs";
import { readWorkPackage, AdoptError } from "./adopt.mjs";
import { parseDelta, changeLogRows, deltaSummaryIds } from "./lib/requirements.mjs";
import { assertChangeId, within, safeRemove, assertNoLinks, SafetyError } from "./lib/safety.mjs";

export class ArchiveError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = "ArchiveError";
    this.code = code;
    this.details = details;
  }
}

const STATUSES = new Set(["adopted", "cancelled", "superseded"]);

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) throw new ArchiveError(`工作包內含 symlink / junction，拒絕封存：${p}`, "UNSAFE_PATH");
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** 兩個目錄的檔案清單與內容是否完全相同（不存在視為空集合）。 */
export function sameTree(a, b) {
  const fa = listFiles(a);
  const fb = listFiles(b);
  if (fa.length !== fb.length || fa.some((x, i) => x !== fb[i])) return false;
  return fa.every((r) => fs.readFileSync(path.join(a, r)).equals(fs.readFileSync(path.join(b, r))));
}

function copyTree(src, dst) {
  for (const r of listFiles(src)) {
    const to = path.join(dst, r);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, r), to);
  }
}

/**
 * adopted 檢查：Affected Capabilities 的每一個有效規格都有對應本 change 的 Change Log 列，
 * 且 Requirements 欄與工作包**目前**的 Delta 相同。
 * @returns {{adopted:boolean, anyRecorded:boolean, problems:string[]}}
 */
export function adoptionState(projectRoot, wp, change) {
  const problems = [];
  let anyRecorded = false;
  const delta = parseDelta(wp.spec);
  if (delta.found && delta.errors.length) problems.push(`工作包的 Delta 格式錯誤：${delta.errors.join("; ")}`);
  if (!wp.capabilities.length) problems.push("工作包沒有 **Affected Capabilities**");
  for (const cap of wp.capabilities) {
    const f = within(projectRoot, "docs", "specifications", cap, "spec.md");
    if (!fs.existsSync(f)) {
      problems.push(`${cap}：有效規格不存在`);
      continue;
    }
    const rows = changeLogRows(fs.readFileSync(f, "utf8")).filter((r) => r.change === change);
    if (rows.length) anyRecorded = true;
    if (rows.length !== 1) {
      problems.push(`${cap}：Change Log 中 ${change} 的列數為 ${rows.length}（應為 1）`);
      continue;
    }
    const capDelta = delta.capabilities.get(cap);
    const expected = capDelta ? deltaSummaryIds(capDelta) : null;
    if (expected === null) problems.push(`${cap}：工作包目前的 Delta 沒有這個 capability`);
    else if (rows[0].requirements !== expected) {
      problems.push(`${cap}：Change Log 記錄的是「${rows[0].requirements}」，工作包目前的 Delta 是「${expected}」（adopt 之後工作包被修改過）`);
    }
  }
  return { adopted: problems.length === 0, anyRecorded, problems };
}

function renderArchiveMd({ change, status, date, baseline, hasInputs }) {
  return `# Archive Record: ${change}

| 項目 | 內容 |
|---|---|
| change ID | ${change} |
| 狀態 | \`${status}\` |
| 封存日期 | ${date} |
| baseline-commit | ${baseline ? "`" + baseline + "`" : "（工作包未記錄）"} |
| 交付版本 | （未記錄） |

> 依 POL-SPEC-001 R6，本檔**不記錄** adopt 所在的 commit。需要時以 change ID 查詢：\`git log -- archive/changes/${change}\`。

## 來源路徑

| 內容 | 原位置 | 封存位置 |
|---|---|---|
| 工作包 | \`specs/${change}/\` | \`work/\` |
| 輸入（intent / decision） | ${hasInputs ? `\`docs/intent/${change}/\`` : "（無）"} | ${hasInputs ? "`inputs/`" : "—"} |
`;
}

/** archive.md 中記錄的狀態。 */
function recordedStatus(archiveMd) {
  const m = /^\|\s*狀態\s*\|\s*`([a-z]+)`\s*\|/m.exec(fs.readFileSync(archiveMd, "utf8"));
  return m ? m[1] : null;
}

export function archive({ projectRoot, change, status = "adopted", date = new Date().toISOString().slice(0, 10), faultInjection } = {}) {
  if (!STATUSES.has(status)) throw new ArchiveError(`--status 必須是 adopted、cancelled 或 superseded（目前：${status}）`, "USAGE");
  assertChangeId(change);
  repoRoot(projectRoot);

  const archiveRoot = within(projectRoot, "archive", "changes");
  const target = within(projectRoot, "archive", "changes", change);
  const specsRoot = within(projectRoot, "specs");
  const workSrc = within(projectRoot, "specs", change);
  const intentRoot = within(projectRoot, "docs", "intent");
  const inputsSrc = within(projectRoot, "docs", "intent", change);
  const tmpRoot = within(projectRoot, ".specify", "tmp");
  const tmp = within(projectRoot, ".specify", "tmp", `archive-${change}`);
  // 要寫入或刪除的每個位置，路徑上都不得有 symlink / junction（即使指向專案內）
  for (const p of [target, workSrc, inputsSrc, tmp]) assertNoLinks(projectRoot, p);
  const workExists = fs.existsSync(workSrc);

  // ── 目標已存在：重試或衝突 ──
  if (fs.existsSync(target)) {
    const md = path.join(target, "archive.md");
    const structureOk = fs.existsSync(md) && fs.existsSync(path.join(target, "work", "spec.md"));
    if (!structureOk) throw new ArchiveError(`封存目標已存在但結構不完整：archive/changes/${change}（缺 archive.md 或 work/spec.md）。不覆蓋，請手動檢查。`, "TARGET_INCOMPLETE");
    const rec = recordedStatus(md);
    if (rec !== status) throw new ArchiveError(`封存目標已存在，但記錄的狀態是 ${rec}，不是 ${status}。不覆蓋。`, "TARGET_DIFFERS");
    if (!workExists) {
      if (fs.existsSync(inputsSrc)) throw new ArchiveError(`封存已存在且工作包已移除，但 docs/intent/${change} 仍在：狀態不一致，請手動檢查。`, "INCONSISTENT");
      return { ok: true, change, status, alreadyArchived: true, note: "已封存（來源已移除，封存結構完整），視為已完成。" };
    }
    const same = sameTree(workSrc, path.join(target, "work")) && sameTree(inputsSrc, path.join(target, "inputs"));
    if (!same) throw new ArchiveError(`封存目標已存在且內容與來源不同：archive/changes/${change}。不覆蓋。`, "TARGET_DIFFERS");
    throw new ArchiveError(`封存已存在且與來源相同，但來源仍在：上次封存可能在刪除來源前中斷。請確認後手動刪除 specs/${change}${fs.existsSync(inputsSrc) ? ` 與 docs/intent/${change}` : ""}。`, "SOURCE_NOT_REMOVED");
  }

  if (!workExists) throw new ArchiveError(`找不到工作包：specs/${change}`, "NO_CHANGE");

  // ── 狀態關卡 ──
  const wp = readWorkPackage(projectRoot, change);
  const st = adoptionState(projectRoot, wp, change);
  if (status === "adopted" && !st.adopted) throw new ArchiveError(`狀態為 adopted，但採納紀錄與工作包不一致，請先（重新）adopt`, "NOT_ADOPTED", st.problems);
  if (status !== "adopted" && st.anyRecorded) throw new ArchiveError(`${change} 已被記錄在有效規格的 Change Log，不能以 ${status} 封存`, "STATUS_CONFLICT");

  // ── 暫存區：完整快照 ──
  if (fs.existsSync(tmp)) throw new ArchiveError(`暫存區已有殘留：.specify/tmp/archive-${change}。請檢查後刪除再重試。`, "TMP_EXISTS");
  const hasInputs = fs.existsSync(inputsSrc);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    copyTree(workSrc, path.join(tmp, "work"));
    if (hasInputs) copyTree(inputsSrc, path.join(tmp, "inputs"));
    fs.writeFileSync(path.join(tmp, "archive.md"), renderArchiveMd({ change, status, date, baseline: wp.baseline, hasInputs }));
    if (!sameTree(workSrc, path.join(tmp, "work")) || !sameTree(inputsSrc, path.join(tmp, "inputs"))) {
      throw new ArchiveError("暫存區快照與來源不一致", "VERIFY_FAILED");
    }
  } catch (e) {
    safeRemove(tmpRoot, tmp);
    throw e;
  }

  // ── 套用 ──
  const steps = { targetCreated: false, workRemoved: false, inputsRemoved: false };
  try {
    if (faultInjection) faultInjection("before-copy");
    // 套用前再比對：來源在組快照後沒有被修改
    if (!sameTree(workSrc, path.join(tmp, "work")) || !sameTree(inputsSrc, path.join(tmp, "inputs"))) {
      throw new ArchiveError("來源在組好快照之後被修改，停止封存", "SOURCE_CHANGED");
    }
    copyTree(tmp, target);
    steps.targetCreated = true;
    if (faultInjection) faultInjection("after-copy");
    if (!sameTree(tmp, target)) throw new Error("寫入後驗證失敗：封存內容與快照不同");

    safeRemove(specsRoot, workSrc);
    steps.workRemoved = true;
    if (faultInjection) faultInjection("after-remove-work");
    if (hasInputs) {
      safeRemove(intentRoot, inputsSrc);
      steps.inputsRemoved = true;
    }
    if (faultInjection) faultInjection("after-remove-inputs");
  } catch (e) {
    // 回復本次觸及的全部檔案
    const notes = [];
    try {
      if (steps.workRemoved && !fs.existsSync(workSrc)) { copyTree(path.join(tmp, "work"), workSrc); notes.push(`還原 specs/${change}`); }
      if (steps.inputsRemoved && !fs.existsSync(inputsSrc)) { copyTree(path.join(tmp, "inputs"), inputsSrc); notes.push(`還原 docs/intent/${change}`); }
      if (steps.targetCreated || fs.existsSync(target)) { safeRemove(archiveRoot, target); notes.push(`移除 archive/changes/${change}`); }
      safeRemove(tmpRoot, tmp);
    } catch (re) {
      throw new ArchiveError(`封存失敗且**回復不完整**（暫存區 .specify/tmp/archive-${change} 已保留供手動還原）。原因：${e.message}；回復錯誤：${re.message}`, "ROLLBACK_INCOMPLETE", { notes });
    }
    if (e instanceof ArchiveError) { e.details = { ...(e.details || {}), rolledBack: notes }; throw e; }
    throw new ArchiveError(`封存中途失敗，已回復：${notes.join("、") || "（無需回復）"}。原因：${e.message}`, "APPLY_FAILED", { rolledBack: notes });
  }

  safeRemove(tmpRoot, tmp);

  // ── 活動上下文：精確匹配 ──
  let clearedContext = false;
  const fj = within(projectRoot, ".specify", "feature.json");
  if (fs.existsSync(fj)) {
    try {
      const data = JSON.parse(fs.readFileSync(fj, "utf8"));
      const dir = String(data.feature_directory ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
      if (dir === `specs/${change}` || path.resolve(projectRoot, dir) === workSrc) {
        fs.rmSync(fj);
        clearedContext = true;
      }
    } catch {
      /* 無法解析就不動 */
    }
  }

  return {
    ok: true,
    change,
    status,
    archivedTo: `archive/changes/${change}`,
    head: headCommit(projectRoot),
    clearedContext,
    note: "變更留在工作目錄，沒有 stage 或 commit；請交由一般的提交流程審查。",
  };
}

function parseArgs(argv) {
  const a = { json: false, status: "adopted" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--json") a.json = true;
    else if (k === "--root") a.root = argv[++i];
    else if (k === "--project") a.project = argv[++i];
    else if (k === "--change") a.change = argv[++i];
    else if (k === "--status") a.status = argv[++i];
    else if (k === "--date") a.date = argv[++i];
    else throw new ArchiveError(`未知的參數：${k}`, "USAGE");
  }
  if (!a.change) throw new ArchiveError("必須指定 --change <NNN-name>", "USAGE");
  return a;
}

function main() {
  const json = process.argv.includes("--json");
  try {
    const a = parseArgs(process.argv.slice(2));
    const r = resolveProject({ project: a.project, cwd: a.root ? path.resolve(a.root) : process.cwd() });
    const result = archive({ projectRoot: r.projectRoot, change: a.change, status: a.status, date: a.date });
    console.log(json ? JSON.stringify({ project: r.projectId, ...result }, null, 2) : `archive 完成：${result.archivedTo ?? result.note}`);
  } catch (e) {
    if (e instanceof ArchiveError || e instanceof ProjectError || e instanceof GitError || e instanceof SafetyError || e instanceof AdoptError) {
      const msg = { ok: false, error: e.code, message: e.message, details: e.details };
      if (json) console.log(JSON.stringify(msg, null, 2));
      else console.error(`錯誤（${e.code}）：${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
