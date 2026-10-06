#!/usr/bin/env node
// speckit.hub.adopt：把已驗證的工作包合併進有效規格（設計 §12.5、§12.6；POL-SPEC-001 R5、R7、R9）
//
// 用法：node adopt.mjs --change <NNN-name> [--root <dir>] [--project <id>] [--date YYYY-MM-DD] [--json]
//
// 關卡（任一失敗即停止，不修改任何有效規格）：
//   1. verification.md 結論為通過
//   2. 工作包狀態不是 cancelled / superseded
//   3. 工作包 spec.md 有 Delta 與 Affected Capabilities
//   4. 基線檢查：目標規格自 baseline 起沒有 committed / staged / unstaged / untracked 變更
//   5. 在暫存區產生並驗證（requirement ID 重複、重用、存在）
//   6. 套用前再檢查一次（防止檢查與套用之間被修改）
// 套用失敗：只回復本次觸及的檔案。**絕不** git add / commit。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";
import { pathChangeState, GitError, repoRoot } from "./lib/git.mjs";
import { parseDelta, applyDelta, appendChangeLog, validateSpec } from "./lib/requirements.mjs";

export class AdoptError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = "AdoptError";
    this.code = code;
    this.details = details;
  }
}

const read = (p) => fs.readFileSync(p, "utf8");

/** 讀取工作包的狀態與基線（從 spec.md 開頭的 **Status** / **Baseline** 欄位）。 */
export function readWorkPackage(projectRoot, change) {
  const dir = path.join(projectRoot, "specs", change);
  if (!fs.existsSync(dir)) throw new AdoptError(`找不到工作包：specs/${change}`, "NO_CHANGE");
  const specPath = path.join(dir, "spec.md");
  if (!fs.existsSync(specPath)) throw new AdoptError(`工作包沒有 spec.md：specs/${change}`, "NO_SPEC");
  const spec = read(specPath);
  const field = (name) => {
    const m = new RegExp(`^\\*\\*${name}\\*\\*\\s*[:：]\\s*(.+)$`, "mi").exec(spec);
    return m ? m[1].trim() : null;
  };
  const status = (field("Status") || "").split(/[\s（(]/)[0].toLowerCase();
  const baselineRaw = field("Baseline");
  const baseline = baselineRaw ? (/[0-9a-f]{7,40}/i.exec(baselineRaw) || [null])[0] : null;
  const capabilities = (field("Affected Capabilities") || "")
    .split(/[,，、\s]+/)
    .map((s) => s.replace(/`/g, "").trim())
    .filter(Boolean);
  return { dir, specPath, spec, status, baseline, capabilities };
}

/** verification.md 的結論必須是通過。接受 `Final Status: Done` 或 `**Result**: PASS`。 */
export function verificationPassed(dir) {
  const p = path.join(dir, "verification.md");
  if (!fs.existsSync(p)) return { ok: false, reason: "沒有 verification.md" };
  const t = read(p);
  // 取「## Final Status」到下一個 ## 標題（或檔尾）之間的內容。JS 沒有 \Z，所以手動切。
  const lines = t.replace(/\r\n/g, "\n").split("\n");
  const at = lines.findIndex((l) => /^##\s*Final Status\s*$/.test(l));
  let section = "";
  if (at >= 0) {
    let end = lines.length;
    for (let i = at + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { end = i; break; }
    section = lines.slice(at + 1, end).join("\n");
  }
  if (/\bNot Done\b/i.test(section)) return { ok: false, reason: "Final Status 為 Not Done" };
  if (/\bBlocked\b/i.test(section)) return { ok: false, reason: "Final Status 為 Blocked" };
  if (/^\s*-\s*Done\b/m.test(section)) return { ok: true };
  return { ok: false, reason: "verification.md 的 Final Status 不是 Done" };
}

/**
 * 計畫：在暫存區產生結果。不修改工作目錄。
 * @returns {{files:{target:string, rel:string, before:string|null, after:string}[], capabilities:string[]}}
 */
export function plan({ projectRoot, change, date }) {
  const wp = readWorkPackage(projectRoot, change);

  if (["cancelled", "superseded"].includes(wp.status)) {
    throw new AdoptError(`工作包狀態為 ${wp.status}：只能 archive，不能 adopt`, "NOT_ADOPTABLE");
  }
  const v = verificationPassed(wp.dir);
  if (!v.ok) throw new AdoptError(`驗證未通過，拒絕 adopt：${v.reason}`, "NOT_VERIFIED");
  if (!wp.baseline) throw new AdoptError("spec.md 沒有 **Baseline** commit，無法做基線檢查", "NO_BASELINE");
  if (wp.capabilities.length !== 1) {
    throw new AdoptError(
      `spec.md 的 **Affected Capabilities** 必須恰好一個（目前：${wp.capabilities.join(", ") || "無"}）；多個 capability 請分開工作包`,
      "CAPABILITY_COUNT",
    );
  }
  const delta = parseDelta(wp.spec);
  if (!delta.found) throw new AdoptError("spec.md 沒有 ## Delta 區段", "NO_DELTA");

  const cap = wp.capabilities[0];
  const target = path.join(projectRoot, "docs", "specifications", cap, "spec.md");
  const before = fs.existsSync(target) ? read(target) : null;
  const base = before ?? `---\ncapability: ${cap}\nstatus: active\n---\n\n# ${cap}\n\n## Requirements\n`;

  const applied = applyDelta(base, delta);
  if (applied.errors.length) throw new AdoptError("requirement ID 檢查失敗", "REQ_INVALID", applied.errors);

  const ids = [
    ...delta.added.map((r) => `+${r.id}`),
    ...delta.modified.map((r) => `~${r.id}`),
    ...delta.removed.map((r) => `-${r.id}`),
  ].join(", ");
  let after = appendChangeLog(applied.text, {
    date,
    change,
    requirements: ids || "—",
    summary: firstLineTitle(wp.spec) || change,
    archive: `archive/changes/${change}`,
  });
  after = after.replace(/^last-adopted:.*$/m, `last-adopted: ${change}`);
  if (!/^last-adopted:/m.test(after)) after = after.replace(/^(status:.*)$/m, `$1\nlast-adopted: ${change}`);

  const post = validateSpec(after);
  if (post.length) throw new AdoptError("套用後的規格驗證失敗", "REQ_INVALID", post);

  return {
    baseline: wp.baseline,
    capabilities: [cap],
    files: [{ target, rel: path.relative(projectRoot, target).split(path.sep).join("/"), before, after }],
  };
}

function firstLineTitle(spec) {
  const m = /^#\s+(?:Feature Specification:\s*)?(.+)$/m.exec(spec);
  return m ? m[1].trim().replace(/\|/g, "/") : null;
}

/** 基線檢查（設計 §12.6）：目標規格自 baseline 起不得有任何變更。 */
export function baselineCheck(projectRoot, files, baseline) {
  const problems = [];
  for (const f of files) {
    const s = pathChangeState(projectRoot, f.target, baseline);
    if (s.any) {
      const kinds = Object.entries(s).filter(([k, v]) => v && k !== "any").map(([k]) => k);
      problems.push({ path: f.rel, kinds });
    }
  }
  return problems;
}

/**
 * 執行 adopt。
 * @param {object} o
 * @param {(file:string)=>void} [o.faultInjection] 測試用：在寫入某個檔案之後丟錯，用來驗證回復
 */
export function adopt({ projectRoot, change, date = today(), faultInjection, betweenChecks } = {}) {
  repoRoot(projectRoot); // 沒有 git 就明確報錯，不略過基線檢查

  const p = plan({ projectRoot, change, date });

  // 1) 基線檢查
  const first = baselineCheck(projectRoot, p.files, p.baseline);
  if (first.length) {
    throw new AdoptError("基線檢查失敗：目標規格自基線後有變更（另一個工作包已 adopt，或有 staged / 未提交的修改）。請重新比對後再試，不會覆蓋任何變更。", "BASELINE_CONFLICT", first);
  }

  // 測試用：模擬「第一次檢查之後、套用之前」有人修改了目標規格
  if (betweenChecks) betweenChecks(p.files.map((f) => f.target));

  // 2) 暫存區（不提交；.gitignore 已排除 .specify/tmp/）
  const tmp = path.join(projectRoot, ".specify", "tmp", change);
  if (fs.existsSync(tmp)) {
    throw new AdoptError(`暫存區已有殘留：${path.relative(projectRoot, tmp)}（上次可能失敗）。請檢查後手動刪除再重試。`, "TMP_EXISTS");
  }
  fs.mkdirSync(tmp, { recursive: true });
  for (const f of p.files) fs.writeFileSync(path.join(tmp, path.basename(f.target)), f.after);

  // 3) 套用前再檢查一次
  const second = baselineCheck(projectRoot, p.files, p.baseline);
  const changedSincePlan = p.files.filter((f) => (fs.existsSync(f.target) ? read(f.target) : null) !== f.before);
  if (second.length || changedSincePlan.length) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new AdoptError("套用前的再檢查失敗：目標規格在檢查之後被修改。沒有寫入任何檔案。", "BASELINE_CONFLICT", second.length ? second : changedSincePlan.map((f) => ({ path: f.rel })));
  }

  // 4) 套用；失敗時只回復本次觸及的檔案
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
    for (const f of touched.reverse()) {
      if (f.before === null) {
        if (fs.existsSync(f.target)) fs.rmSync(f.target);
      } else {
        fs.writeFileSync(f.target, f.before);
      }
      restored.push(f.rel);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new AdoptError(`套用中途失敗，已只回復本次觸及的檔案：${restored.join(", ")}。原因：${e.message}`, "APPLY_FAILED", { restored });
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  return {
    ok: true,
    change,
    capabilities: p.capabilities,
    written: p.files.map((f) => f.rel),
    note: "變更留在工作目錄，沒有 stage 或 commit；請交由一般的提交流程審查。下一步：archive。",
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
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
    if (e instanceof AdoptError || e instanceof ProjectError || e instanceof GitError) {
      const msg = { ok: false, error: e.code, message: e.message, details: e.details };
      if (json) console.log(JSON.stringify(msg, null, 2));
      else console.error(`錯誤（${e.code}）：${e.message}${e.details ? "\n" + JSON.stringify(e.details, null, 2) : ""}`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
