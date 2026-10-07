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
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";
import { headCommit, repoRoot, GitError } from "./lib/git.mjs";
import { readWorkPackage, AdoptError } from "./adopt.mjs";
import { parseDelta, changeLogRows, deltaSummaryIds, deltaSnapshot } from "./lib/requirements.mjs";
import { digest } from "./lib/markdown.mjs";
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

/** 刪除所有空目錄（由內而外）；不遞迴刪除含檔案的目錄。 */
function pruneEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) pruneEmptyDirs(path.join(dir, e.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function hasWorkSnapshot(tmp) {
  return fs.existsSync(path.join(tmp, "work"));
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
    if (expected === null) {
      problems.push(`${cap}：工作包目前的 Delta 沒有這個 capability`);
    } else if (rows[0].requirements !== expected) {
      problems.push(`${cap}：Change Log 記錄的是「${rows[0].requirements}」，工作包目前的 Delta 是「${expected}」（adopt 之後工作包被修改過）`);
    } else if (!rows[0].snapshot) {
      // 只有 ID 清單、沒有內容快照：無法確認 requirement 內文沒被改，不能當作已採納
      problems.push(`${cap}：Change Log 的 ${change} 沒有內容快照（Snapshot 欄），無法確認採納的內容與工作包現在相同；請重新 adopt`);
    } else if (rows[0].snapshot !== deltaSnapshot(capDelta).slice(0, 16)) {
      problems.push(`${cap}：requirement ID 相同，但**內容**與採納時不同（ADDED / MODIFIED 的標題或內文，或 REMOVED 的 tombstone 被改過）。adopt 之後工作包被修改過`);
    }
  }
  return { adopted: problems.length === 0, anyRecorded, problems };
}

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** 封存快照的清單：work/、inputs/ 下每個檔案的 sha256（相對於封存根目錄）。 */
function buildManifest(root) {
  const rows = [];
  for (const top of ["work", "inputs"]) {
    for (const r of listFiles(path.join(root, top))) rows.push([`${top}/${r}`, sha(fs.readFileSync(path.join(root, top, ...r.split("/"))))]);
  }
  return rows;
}
const metaDigest = (m) => digest(["change", m.change, "status", m.status, "date", m.date, "baseline", m.baseline].join("\u0001"));

/** 從 archive.md 讀回 metadata 與清單。 */
function readArchiveMd(file) {
  const t = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const cell = (label) => (new RegExp(String.raw`^\|\s*${label}\s*\|\s*(.*?)\s*\|\s*$`, "m").exec(t) || [])[1]?.replace(/`/g, "") ?? null;
  const meta = { change: cell("change ID"), status: cell("狀態"), date: cell("封存日期"), baseline: cell("baseline-commit") };
  const md = /^Metadata-Digest:\s*([0-9a-f]{64})\s*$/m.exec(t)?.[1] ?? null;
  const files = [];
  let inM = false;
  for (const l of t.split("\n")) {
    if (/^##\s+Manifest\s*$/.test(l)) { inM = true; continue; }
    if (inM && /^##\s+/.test(l)) break;
    const m = inM && /^\|\s*`((?:work|inputs)\/[^`]+)`\s*\|\s*([0-9a-f]{64})\s*\|\s*$/.exec(l);
    if (m) files.push([m[1], m[2]]);
  }
  return { meta, metaDigest: md, files, hasManifest: inM };
}

/** 驗證既有封存的完整性：manifest 與實際檔案逐一相同（缺檔、多檔、內容被改、metadata 被改都回報）。 */
function verifyArchive(target, expect = {}) {
  const problems = [];
  const a = readArchiveMd(path.join(target, "archive.md"));
  if (!a.hasManifest || !a.metaDigest) return ["archive.md 沒有 Manifest / Metadata-Digest（不是由本工具產生的完整封存）"];
  if (metaDigest(a.meta) !== a.metaDigest) problems.push("archive.md 的 metadata（change / 狀態 / 日期 / baseline）與 Metadata-Digest 不符");
  // 身份：archive.md 記錄的 change / 狀態必須就是被請求的（不接受別的工作包的封存被複製過來）
  if (expect.change !== undefined && a.meta.change !== expect.change) problems.push(`archive.md 記錄的 change 是 ${a.meta.change}，不是 ${expect.change}（不接受別的工作包的封存紀錄）`);
  if (expect.status !== undefined && a.meta.status !== expect.status) problems.push(`archive.md 記錄的狀態是 ${a.meta.status}，不是 ${expect.status}`);
  if (!fs.existsSync(path.join(target, "work", "spec.md"))) problems.push("缺檔：work/spec.md（必要結構）");
  const actual = new Map(buildManifest(target));
  const want = new Map(a.files);
  for (const [f, h] of want) {
    if (!actual.has(f)) problems.push(`缺檔：${f}`);
    else if (actual.get(f) !== h) problems.push(`內容被改：${f}`);
  }
  for (const f of actual.keys()) if (!want.has(f)) problems.push(`多出的檔案：${f}`);
  return problems;
}

function renderArchiveMd({ change, status, date, baseline, hasInputs, manifest }) {
  const meta = { change, status, date, baseline: baseline || "（工作包未記錄）" };
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

## Manifest

Metadata-Digest: ${metaDigest(meta)}

| 檔案 | sha256 |
|---|---|
${manifest.map(([f, h]) => `| \`${f}\` | ${h} |`).join("\n")}
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
    // 完整性：archive.md 的 Manifest 與 work/、inputs/ 實際內容逐檔比對（缺檔、多檔、內容被改、metadata 被改都拒絕）
    const integrity = verifyArchive(target, { change, status });
    if (integrity.length) throw new ArchiveError(`既有封存的完整性驗證失敗，不視為已完成、不覆蓋：${integrity.join("；")}`, "TARGET_INCOMPLETE", integrity);
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
    fs.writeFileSync(path.join(tmp, "archive.md"), renderArchiveMd({ change, status, date, baseline: wp.baseline, hasInputs, manifest: buildManifest(tmp) }));
    if (!sameTree(workSrc, path.join(tmp, "work")) || !sameTree(inputsSrc, path.join(tmp, "inputs"))) {
      throw new ArchiveError("暫存區快照與來源不一致", "VERIFY_FAILED");
    }
    const tmpProblems = verifyArchive(tmp, { change, status });
    if (tmpProblems.length) throw new ArchiveError(`暫存封存未通過完整性驗證：${tmpProblems.join("；")}`, "VERIFY_FAILED", tmpProblems);
  } catch (e) {
    safeRemove(tmpRoot, tmp);
    throw e;
  }

  // ── 套用 ──
  // 原則：先寫目標、驗證，**每一次刪除來源之前都再比對一次來源仍與快照相同**；
  // 刪除是逐檔進行並逐檔記錄，部分刪除失敗時能把已刪的檔案從快照還原。
  const created = { target: false };
  const deleted = []; // { root: "work" | "inputs", rel }
  const sourceMatchesSnapshot = () =>
    sameTree(workSrc, path.join(tmp, "work")) && sameTree(inputsSrc, path.join(tmp, "inputs"));

  // 刪除單一檔案前，確認這個檔案此刻仍與快照位元組相同；不同就停止（不用過期快照抹除新的修改）
  const removeVerified = (srcRoot, snapRoot, rootName, relPath, allowedRoot) => {
    const src = path.join(srcRoot, ...relPath.split("/"));
    const snap = path.join(snapRoot, ...relPath.split("/"));
    if (!fs.existsSync(src)) return;
    if (!fs.readFileSync(src).equals(fs.readFileSync(snap))) {
      throw new ArchiveError(`來源檔案在封存期間被修改，停止刪除：${rootName}/${relPath}`, "SOURCE_CHANGED");
    }
    assertNoLinks(allowedRoot, src);
    fs.rmSync(src);
    deleted.push({ root: rootName, rel: relPath });
  };

  try {
    if (faultInjection) faultInjection("before-copy");
    if (!sourceMatchesSnapshot()) throw new ArchiveError("來源在組好快照之後被修改，停止封存", "SOURCE_CHANGED");

    copyTree(tmp, target);
    created.target = true;
    if (faultInjection) faultInjection("after-copy");
    if (!sameTree(tmp, target)) throw new Error("寫入後驗證失敗：封存內容與快照不同");
    const targetProblems = verifyArchive(target, { change, status });
    if (targetProblems.length) throw new ArchiveError(`寫入後的封存未通過完整性驗證，停止刪除來源：${targetProblems.join("；")}`, "VERIFY_FAILED", targetProblems);

    // 刪除前再比對整個來源（涵蓋「寫入目標之後、刪除之前」的修改）
    if (!sourceMatchesSnapshot()) throw new ArchiveError("來源在寫入封存之後被修改，停止刪除來源", "SOURCE_CHANGED");

    for (const rel of listFiles(path.join(tmp, "work"))) {
      removeVerified(workSrc, path.join(tmp, "work"), "work", rel, specsRoot);
      if (faultInjection) faultInjection("after-remove-file");
    }
    if (hasInputs) {
      for (const rel of listFiles(path.join(tmp, "inputs"))) {
        removeVerified(inputsSrc, path.join(tmp, "inputs"), "inputs", rel, intentRoot);
        if (faultInjection) faultInjection("after-remove-file");
      }
    }
    // 目錄本身：只有在空了才移除（有新增的檔案會讓它非空，保留並報錯，不遞迴刪除）
    for (const dir of [workSrc, ...(hasInputs ? [inputsSrc] : [])]) pruneEmptyDirs(dir);
    if (fs.existsSync(workSrc) || (hasInputs && fs.existsSync(inputsSrc))) {
      throw new ArchiveError("來源目錄內有封存快照以外的新檔案，未刪除（沒有遞迴刪除）", "SOURCE_CHANGED");
    }
    if (faultInjection) faultInjection("after-remove-dirs");
  } catch (e) {
    // 回復本次觸及的全部檔案：已刪除的來源檔案從快照還原，再移除本次建立的封存
    const notes = [];
    const restoreErrors = [];
    for (const d of deleted) {
      try {
        const [srcRoot, snapRoot] = d.root === "work" ? [workSrc, path.join(tmp, "work")] : [inputsSrc, path.join(tmp, "inputs")];
        const to = path.join(srcRoot, ...d.rel.split("/"));
        const snapFile = path.join(snapRoot, ...d.rel.split("/"));
        if (fs.existsSync(to)) {
          // 來源位置已有檔案：相同就不用還原；不同代表有人在期間新增／修改了它 → 保留新內容，不覆蓋，回報衝突
          if (fs.readFileSync(to).equals(fs.readFileSync(snapFile))) continue;
          restoreErrors.push(`${d.root}/${d.rel}（來源位置已有不同的新內容，保留新內容未覆蓋；原內容仍在暫存快照）`);
          continue;
        }
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(snapFile, to);
      } catch (re) {
        restoreErrors.push(`${d.root}/${d.rel}（${re.message}）`);
      }
    }
    if (deleted.length) notes.push(`還原 ${deleted.length} 個已刪除的來源檔案`);
    // 空目錄在 pruneEmptyDirs 時可能已被移除：補回結構
    try {
      if (hasWorkSnapshot(tmp) && !fs.existsSync(workSrc)) fs.mkdirSync(workSrc, { recursive: true });
      if (hasInputs && !fs.existsSync(inputsSrc)) fs.mkdirSync(inputsSrc, { recursive: true });
    } catch (re) {
      restoreErrors.push(`目錄結構（${re.message}）`);
    }
    try {
      if (created.target || fs.existsSync(target)) {
        safeRemove(archiveRoot, target);
        notes.push(`移除 archive/changes/${change}`);
      }
    } catch (re) {
      restoreErrors.push(`封存目標（${re.message}）`);
    }
    if (restoreErrors.length) {
      // 回復不完整：保留暫存區（內含完整快照）供手動還原，並明確說明
      throw new ArchiveError(
        `封存失敗且**回復不完整**。暫存區 .specify/tmp/archive-${change} 已保留（含完整快照）供手動還原。原因：${e.message}；無法回復：${restoreErrors.join("; ")}`,
        "ROLLBACK_INCOMPLETE",
        { notes, restoreErrors },
      );
    }
    try { safeRemove(tmpRoot, tmp); } catch { /* 暫存區保留供檢查 */ }
    if (e instanceof ArchiveError) {
      e.details = { ...(e.details || {}), rolledBack: notes };
      throw e;
    }
    throw new ArchiveError(`封存中途失敗，已回復：${notes.join("、") || "（無需回復）"}。原因：${e.message}`, "APPLY_FAILED", { rolledBack: notes });
  }

  // ── 活動上下文：精確匹配；失敗要如實回報，不假裝成功 ──
  let clearedContext = false;
  let contextWarning = null;
  const fj = within(projectRoot, ".specify", "feature.json");
  if (fs.existsSync(fj)) {
    let pointsHere = false;
    try {
      const data = JSON.parse(fs.readFileSync(fj, "utf8"));
      const dir = String(data.feature_directory ?? "").replace(/\\/g, "/").replace(/\/+$/, "");
      pointsHere = dir === `specs/${change}` || path.resolve(projectRoot, dir) === workSrc;
    } catch (pe) {
      contextWarning = `.specify/feature.json 無法解析，未清除活動上下文：${pe.message}`;
    }
    if (pointsHere) {
      try {
        assertNoLinks(projectRoot, fj);
        fs.rmSync(fj);
        clearedContext = true;
      } catch (ce) {
        // 封存已完成且已驗證；上下文清除失敗不回復封存（那會讓兩邊更不一致），但必須如實回報
        contextWarning = `封存已完成，但**無法清除**活動上下文 .specify/feature.json（它仍指向已封存的 specs/${change}）：${ce.message}。請手動刪除，否則下一個指令可能找到舊路徑。`;
      }
    }
  }

  safeRemove(tmpRoot, tmp);

  return {
    ok: true,
    change,
    status,
    archivedTo: `archive/changes/${change}`,
    head: headCommit(projectRoot),
    clearedContext,
    ...(contextWarning ? { warning: contextWarning } : {}),
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
