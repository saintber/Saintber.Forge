#!/usr/bin/env node
// speckit.hub.adopt：把已驗證的工作包合併進有效規格（設計 §12.5、§12.6；POL-SPEC-001 R5、R7、R9）
//
// 用法：node adopt.mjs --change <NNN-name> [--root <dir>] [--project <id>] [--date YYYY-MM-DD] [--json]
//
// 關卡（任一失敗即停止，**不修改任何檔案**）：
//   1. change 與 capability ID 合法；所有路徑都在專案根目錄之內（含 symlink / junction）
//   2. 工作包狀態不是 cancelled / superseded；verification.md 的 Final Status 為 Done
//   3. spec.md 有 **Baseline**、**Affected Capabilities**、## Delta；Delta 嚴格解析無錯誤，
//      且 Delta 的 capability 集合 == Affected Capabilities
//   4. 基線檢查：每個要寫入的檔案（各 capability 的有效規格 + 有效規格索引）自 baseline 起
//      沒有 committed / staged / unstaged / untracked 變更
//   5. 在暫存區產生全部結果並驗證（requirement ID 重複、重用、存在）
//   6. 套用前再檢查一次
// 套用：逐檔寫入；任何一步失敗，回復**本次觸及的全部檔案**。**絕不** git add / commit。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";
import { pathChangeState, GitError, repoRoot } from "./lib/git.mjs";
import { parseDelta, applyDelta, appendChangeLog, validateSpec, deltaSummaryIds, deltaSnapshot } from "./lib/requirements.mjs";
import { assertChangeId, assertCapabilityId, within, safeRemove, assertNoLinks, SafetyError } from "./lib/safety.mjs";
import { upsertIndexRow } from "./lib/spec-index.mjs";

export class AdoptError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = "AdoptError";
    this.code = code;
    this.details = details;
  }
}

const read = (p) => fs.readFileSync(p, "utf8");
const lf = (t) => t.replace(/\r\n/g, "\n");

/** 讀取工作包 spec.md 開頭的 **欄位**。 */
export function field(spec, name) {
  const m = new RegExp(`^\\*\\*${name}\\*\\*\\s*[:：]\\s*(.+)$`, "mi").exec(spec);
  return m ? m[1].trim() : null;
}

/** 讀取工作包。change 先驗證格式，再組路徑。 */
export function readWorkPackage(projectRoot, change) {
  assertChangeId(change);
  const dir = within(projectRoot, "specs", change);
  if (!fs.existsSync(dir)) throw new AdoptError(`找不到工作包：specs/${change}`, "NO_CHANGE");
  const specPath = within(projectRoot, "specs", change, "spec.md");
  if (!fs.existsSync(specPath)) throw new AdoptError(`工作包沒有 spec.md：specs/${change}`, "NO_SPEC");
  const spec = read(specPath);
  const status = (field(spec, "Status") || "").split(/[\s（(]/)[0].toLowerCase();
  const baselineRaw = field(spec, "Baseline");
  const baseline = baselineRaw ? (/[0-9a-f]{7,40}/i.exec(baselineRaw) || [null])[0] : null;
  const owner = (field(spec, "Owner") || "").replace(/`/g, "").trim() || null;
  const capsRaw = field(spec, "Affected Capabilities");
  const capabilities = capsRaw
    ? capsRaw.split(/[,，、\s]+/).map((s) => s.replace(/`/g, "").trim()).filter(Boolean)
    : [];
  return { dir, specPath, spec, status, baseline, owner, capabilities };
}

/** verification.md 的 Final Status 必須是 Done（取「## Final Status」到下一個 ## 之間）。 */
export function verificationPassed(dir) {
  const p = path.join(dir, "verification.md");
  if (!fs.existsSync(p)) return { ok: false, reason: "沒有 verification.md" };
  const lines = lf(read(p)).split("\n");
  const at = lines.findIndex((l) => /^##\s*Final Status\s*$/.test(l));
  if (at < 0) return { ok: false, reason: "verification.md 沒有 ## Final Status" };
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
  const section = lines.slice(at + 1, end).join("\n");
  // 只看第一個項目：「- Done」才算通過；Not Done / Blocked 一律不通過
  const first = (/^\s*-\s*(.+)$/m.exec(section) || [])[1] || "";
  if (/^\**\s*Done\b/i.test(first) && !/Not\s+Done/i.test(first)) return { ok: true };
  return { ok: false, reason: `Final Status 不是 Done（目前：${first.trim() || "空白"}）` };
}

function title(spec) {
  const m = /^#\s+(?:Feature Specification:\s*)?(.+)$/m.exec(spec);
  return m ? m[1].trim().replace(/\|/g, "/") : null;
}

/**
 * 計畫：在記憶體中算出全部結果，**不修改任何檔案**。
 * @returns {{baseline:string, files:{target:string, rel:string, before:string|null, after:string}[], capabilities:string[]}}
 */
export function plan({ projectRoot, change, date }) {
  const wp = readWorkPackage(projectRoot, change);

  if (["cancelled", "superseded"].includes(wp.status)) {
    throw new AdoptError(`工作包狀態為 ${wp.status}：只能 archive，不能 adopt`, "NOT_ADOPTABLE");
  }
  const v = verificationPassed(wp.dir);
  if (!v.ok) throw new AdoptError(`驗證未通過，拒絕 adopt：${v.reason}`, "NOT_VERIFIED");
  if (!wp.baseline) throw new AdoptError("spec.md 沒有 **Baseline** commit，無法做基線檢查", "NO_BASELINE");
  if (!wp.capabilities.length) throw new AdoptError("spec.md 沒有 **Affected Capabilities**", "NO_CAPABILITY");
  for (const c of wp.capabilities) assertCapabilityId(c);
  if (new Set(wp.capabilities).size !== wp.capabilities.length) throw new AdoptError("**Affected Capabilities** 有重複", "CAPABILITY_DUP");

  const delta = parseDelta(wp.spec);
  if (!delta.found) throw new AdoptError("spec.md 沒有 ## Delta 區段", "NO_DELTA");
  if (delta.errors.length) throw new AdoptError("Delta 格式錯誤", "DELTA_INVALID", delta.errors);

  const declared = [...wp.capabilities].sort();
  const inDelta = [...delta.capabilities.keys()].sort();
  if (declared.join(",") !== inDelta.join(",")) {
    throw new AdoptError(
      `**Affected Capabilities**（${declared.join(", ")}）與 Delta 的 capability（${inDelta.join(", ")}）不一致`,
      "CAPABILITY_MISMATCH",
    );
  }

  const files = [];
  const indexRows = [];
  const allErrors = [];
  for (const cap of declared) {
    const target = within(projectRoot, "docs", "specifications", cap, "spec.md");
    const before = fs.existsSync(target) ? read(target) : null;
    if (before === null && !wp.owner) {
      allErrors.push(`新 capability ${cap} 需要 owner：請在 spec.md 寫 **Owner**: <專案 ID>`);
      continue;
    }
    const base = before ?? `---\ncapability: ${cap}\nowner: ${wp.owner}\nstatus: active\nlast-adopted: ${change}\n---\n\n# ${cap}\n\n## Requirements\n`;
    const capDelta = delta.capabilities.get(cap);
    const applied = applyDelta(base, capDelta);
    if (applied.errors.length) {
      allErrors.push(...applied.errors.map((e) => `${cap}：${e}`));
      continue;
    }
    let after = appendChangeLog(applied.text, {
      date,
      change,
      requirements: deltaSummaryIds(capDelta) || "—",
      summary: title(wp.spec) || change,
      archive: `archive/changes/${change}`,
      // 採納時 Delta 的完整內容快照（ADDED / MODIFIED 的內文、REMOVED 的 tombstone）。archive 用它確認 adopt 之後工作包沒被改。
      snapshot: deltaSnapshot(capDelta).slice(0, 16),
    });
    after = /^last-adopted:.*$/m.test(after) ? after.replace(/^last-adopted:.*$/m, `last-adopted: ${change}`) : after.replace(/^(status:.*)$/m, `$1\nlast-adopted: ${change}`);
    const post = validateSpec(after);
    if (post.length) {
      allErrors.push(...post.map((e) => `${cap}：${e}`));
      continue;
    }
    const owner = (/^owner:\s*(.+)$/m.exec(after) || [])[1]?.trim() || wp.owner;
    files.push({ target, rel: rel(projectRoot, target), before, after: keepEol(before, after) });
    indexRows.push({ capability: cap, owner, change, isNew: before === null });
  }
  if (allErrors.length) throw new AdoptError("requirement 檢查失敗", "REQ_INVALID", allErrors);

  // 有效規格索引（保護使用者既有修改：只更新或新增該 capability 的那一列）
  const indexPath = within(projectRoot, "docs", "specifications", "README.md");
  const indexBefore = fs.existsSync(indexPath) ? read(indexPath) : null;
  let indexAfter = indexBefore ?? "# 有效規格索引\n\n## Capability 索引\n\n| capability | owner | 一句話說明 | 最後採納 | 規格 |\n|---|---|---|---|---|\n";
  for (const r of indexRows) indexAfter = upsertIndexRow(indexAfter, r);
  files.push({ target: indexPath, rel: rel(projectRoot, indexPath), before: indexBefore, after: keepEol(indexBefore, indexAfter) });

  return { baseline: wp.baseline, capabilities: declared, files };
}

const rel = (root, p) => path.relative(root, p).split(path.sep).join("/");
const keepEol = (before, after) => (before && before.includes("\r\n") ? lf(after).replace(/\n/g, "\r\n") : after);

/** 基線檢查（設計 §12.6）：每個要寫入的檔案自 baseline 起不得有任何變更。 */
export function baselineCheck(projectRoot, files, baseline) {
  const problems = [];
  for (const f of files) {
    const s = pathChangeState(projectRoot, f.target, baseline);
    if (s.any) problems.push({ path: f.rel, kinds: Object.entries(s).filter(([k, v]) => v && k !== "any").map(([k]) => k) });
  }
  return problems;
}

/**
 * 執行 adopt。
 * @param {(rel:string)=>void} [o.faultInjection] 測試用：每寫入一個檔案後呼叫，可丟錯以驗證回復
 * @param {(targets:string[])=>void} [o.betweenChecks] 測試用：第一次檢查之後、套用之前呼叫
 */
export function adopt({ projectRoot, change, date = new Date().toISOString().slice(0, 10), faultInjection, betweenChecks } = {}) {
  repoRoot(projectRoot); // 沒有 git 就明確報錯，不略過基線檢查

  const p = plan({ projectRoot, change, date });

  const first = baselineCheck(projectRoot, p.files, p.baseline);
  if (first.length) {
    throw new AdoptError("基線檢查失敗：要寫入的檔案自基線後有變更（另一個工作包已 adopt，或有 staged / 未提交的修改）。請重新比對後再試，不會覆蓋任何變更。", "BASELINE_CONFLICT", first);
  }

  if (betweenChecks) betweenChecks(p.files.map((f) => f.target));

  for (const f of p.files) assertNoLinks(projectRoot, f.target);
  const tmpRoot = within(projectRoot, ".specify", "tmp");
  assertNoLinks(projectRoot, path.join(projectRoot, ".specify", "tmp", change));
  const tmp = within(projectRoot, ".specify", "tmp", change);
  if (fs.existsSync(tmp)) throw new AdoptError(`暫存區已有殘留：${rel(projectRoot, tmp)}（上次可能失敗）。請檢查後手動刪除再重試。`, "TMP_EXISTS");
  fs.mkdirSync(tmp, { recursive: true });
  p.files.forEach((f, i) => {
    fs.writeFileSync(path.join(tmp, `${i}-${path.basename(f.target)}.after`), f.after);
    if (f.before !== null) fs.writeFileSync(path.join(tmp, `${i}-${path.basename(f.target)}.before`), f.before);
  });

  const second = baselineCheck(projectRoot, p.files, p.baseline);
  const changedSincePlan = p.files.filter((f) => (fs.existsSync(f.target) ? read(f.target) : null) !== f.before);
  if (second.length || changedSincePlan.length) {
    safeRemove(tmpRoot, tmp);
    throw new AdoptError("套用前的再檢查失敗：要寫入的檔案在檢查之後被修改。沒有寫入任何檔案。", "BASELINE_CONFLICT", second.length ? second : changedSincePlan.map((f) => ({ path: f.rel })));
  }

  const touched = [];
  try {
    for (const f of p.files) {
      fs.mkdirSync(path.dirname(f.target), { recursive: true });
      touched.push(f);
      fs.writeFileSync(f.target, f.after);
      if (faultInjection) faultInjection(f.rel);
    }
  } catch (e) {
    const restored = [];
    const failedRestore = [];
    for (const f of [...touched].reverse()) {
      try {
        const exists = fs.existsSync(f.target);
        const current = exists ? read(f.target) : null;
        if (current === f.before) { restored.push(f.rel); continue; } // 還沒寫到或已是原內容
        if (current !== f.after) {
          // 目標已不是本次寫入的內容：有人在期間修改／重建，保留新內容，不覆蓋、不刪除
          failedRestore.push(`${f.rel}（目標已被其他程序修改，保留新內容未覆蓋；本次原內容在暫存區 .before）`);
          continue;
        }
        if (f.before === null) fs.rmSync(f.target);
        else fs.writeFileSync(f.target, f.before);
        restored.push(f.rel);
      } catch (re) {
        failedRestore.push(`${f.rel}（${re.message}）`);
      }
    }
    if (!failedRestore.length) { try { safeRemove(tmpRoot, tmp); } catch { /* 暫存區保留供檢查 */ } }
    throw new AdoptError(
      `套用中途失敗，已只回復本次觸及的檔案：${restored.join(", ") || "（無）"}${failedRestore.length ? `；**無法回復**：${failedRestore.join(", ")}` : ""}。${failedRestore.length ? `暫存區 ${rel(projectRoot, tmp)} 已保留（含寫入前後的內容）。` : ""}原因：${e.message}`,
      failedRestore.length ? "ROLLBACK_INCOMPLETE" : "APPLY_FAILED",
      { restored, failedRestore },
    );
  }

  safeRemove(tmpRoot, tmp);
  return {
    ok: true,
    change,
    capabilities: p.capabilities,
    written: p.files.map((f) => f.rel),
    note: "變更留在工作目錄，沒有 stage 或 commit；請交由一般的提交流程審查。下一步：archive。",
  };
}

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--json") a.json = true;
    else if (k === "--root") a.root = argv[++i];
    else if (k === "--project") a.project = argv[++i];
    else if (k === "--change") a.change = argv[++i];
    else if (k === "--date") a.date = argv[++i];
    else throw new AdoptError(`未知的參數：${k}`, "USAGE");
  }
  if (!a.change) throw new AdoptError("必須指定 --change <NNN-name>", "USAGE");
  return a;
}

function main() {
  const json = process.argv.includes("--json");
  try {
    const a = parseArgs(process.argv.slice(2));
    const r = resolveProject({ project: a.project, cwd: a.root ? path.resolve(a.root) : process.cwd() });
    const result = adopt({ projectRoot: r.projectRoot, change: a.change, date: a.date });
    console.log(json ? JSON.stringify({ project: r.projectId, ...result }, null, 2) : `adopt 完成：${result.written.join(", ")}\n${result.note}`);
  } catch (e) {
    if (e instanceof AdoptError || e instanceof ProjectError || e instanceof GitError || e instanceof SafetyError) {
      const msg = { ok: false, error: e.code, message: e.message, details: e.details };
      if (json) console.log(JSON.stringify(msg, null, 2));
      else console.error(`錯誤（${e.code}）：${e.message}${e.details ? "\n" + JSON.stringify(e.details, null, 2) : ""}`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
