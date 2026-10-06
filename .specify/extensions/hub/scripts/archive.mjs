#!/usr/bin/env node
// speckit.hub.archive：封存工作包與其輸入（設計 §12.5；POL-SPEC-001 R6、R7）
//
// 用法：node archive.mjs --change <NNN-name> [--status adopted|cancelled|superseded] [--root <dir>] [--project <id>] [--date YYYY-MM-DD] [--json]
//
// 規則：
//   - 結構：archive/changes/<change>/{archive.md, inputs/, work/}
//   - archive.md 不記錄自己所在的 commit（一個檔案無法記錄包含它自己的 commit）
//   - 目標已存在：內容相同 → 視為已完成（可重試）；不同 → 報錯，不覆蓋
//   - adopted 前提：該變更已 adopt（有效規格的 Change Log 有這個 change）
//   - cancelled / superseded：只封存，不 adopt
//   - 先在暫存區組好完整結果並驗證，再移動；失敗只回復本次觸及的檔案
//   - 清除活動上下文（.specify/feature.json 若指向本工作包）
//   - **絕不** git add / commit

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";
import { headCommit, repoRoot, GitError } from "./lib/git.mjs";
import { readWorkPackage } from "./adopt.mjs";

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
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

/** 兩個目錄的檔案清單與內容是否完全相同。 */
function sameTree(a, b) {
  const fa = listFiles(a);
  const fb = listFiles(b);
  if (fa.length !== fb.length || fa.some((x, i) => x !== fb[i])) return false;
  return fa.every((rel) => fs.readFileSync(path.join(a, rel)).equals(fs.readFileSync(path.join(b, rel))));
}

function copyTree(src, dst) {
  for (const rel of listFiles(src)) {
    const to = path.join(dst, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, rel), to);
  }
}

/** 該 change 是否已 adopt：任一有效規格的 Change Log 有這個 change。 */
export function isAdopted(projectRoot, change) {
  const specsDir = path.join(projectRoot, "docs", "specifications");
  if (!fs.existsSync(specsDir)) return false;
  for (const cap of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!cap.isDirectory()) continue;
    const f = path.join(specsDir, cap.name, "spec.md");
    if (!fs.existsSync(f)) continue;
    const t = fs.readFileSync(f, "utf8");
    if (new RegExp(`^\\|[^|]*\\|\\s*${change.replace(/[-]/g, "\\-")}\\s*\\|`, "m").test(t)) return true;
  }
  return false;
}

function renderArchiveMd({ change, status, date, baseline, sourceWork, sourceInputs }) {
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
| 工作包 | \`${sourceWork}\` | \`work/\` |
| 輸入（intent / decision） | ${sourceInputs ? "`" + sourceInputs + "`" : "（無）"} | ${sourceInputs ? "`inputs/`" : "—"} |
`;
}

export function archive({ projectRoot, change, status = "adopted", date = new Date().toISOString().slice(0, 10), faultInjection } = {}) {
  if (!STATUSES.has(status)) throw new ArchiveError(`--status 必須是 adopted、cancelled 或 superseded（目前：${status}）`, "USAGE");
  repoRoot(projectRoot); // 沒有 git 就明確報錯

  const target = path.join(projectRoot, "archive", "changes", change);
  const workSrc = path.join(projectRoot, "specs", change);
  const inputsSrc = path.join(projectRoot, "docs", "intent", change);
  const workExists = fs.existsSync(workSrc);

  // ---- 可重試：目標已存在 ----
  if (fs.existsSync(target)) {
    if (!workExists) {
      return { ok: true, change, status, alreadyArchived: true, note: "已封存（工作包已不在 specs/），視為已完成。" };
    }
    // 工作包還在、目標也在：比對內容
    if (sameTree(workSrc, path.join(target, "work"))) {
      return { ok: true, change, status, alreadyArchived: true, note: "封存內容已存在且相同，視為已完成；原工作包未移除，請手動確認後刪除。" };
    }
    throw new ArchiveError(`封存目標已存在且內容不同：archive/changes/${change}。不覆蓋。`, "TARGET_DIFFERS");
  }

  if (!workExists) throw new ArchiveError(`找不到工作包：specs/${change}`, "NO_CHANGE");

  // ---- 狀態關卡 ----
  const wp = readWorkPackage(projectRoot, change);
  if (status === "adopted" && !isAdopted(projectRoot, change)) {
    throw new ArchiveError(`狀態為 adopted，但沒有任何有效規格的 Change Log 記錄 ${change}；請先 adopt`, "NOT_ADOPTED");
  }
  if (status !== "adopted" && isAdopted(projectRoot, change)) {
    throw new ArchiveError(`${change} 已 adopt，不能以 ${status} 封存`, "STATUS_CONFLICT");
  }

  // ---- 暫存區：組好完整結果 ----
  const tmp = path.join(projectRoot, ".specify", "tmp", `archive-${change}`);
  if (fs.existsSync(tmp)) throw new ArchiveError(`暫存區已有殘留：${path.relative(projectRoot, tmp)}。請檢查後刪除再重試。`, "TMP_EXISTS");
  fs.mkdirSync(tmp, { recursive: true });
  try {
    copyTree(workSrc, path.join(tmp, "work"));
    const hasInputs = fs.existsSync(inputsSrc);
    if (hasInputs) copyTree(inputsSrc, path.join(tmp, "inputs"));
    fs.writeFileSync(
      path.join(tmp, "archive.md"),
      renderArchiveMd({
        change,
        status,
        date,
        baseline: wp.baseline,
        sourceWork: `specs/${change}/`,
        sourceInputs: hasInputs ? `docs/intent/${change}/` : null,
      }),
    );
    // 驗證：工作包的每個檔案都在暫存區
    if (!sameTree(workSrc, path.join(tmp, "work"))) throw new ArchiveError("暫存區內容與工作包不一致", "VERIFY_FAILED");
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }

  // ---- 套用：先寫入目標，最後才刪除來源（失敗時來源仍在） ----
  let createdTarget = false;
  try {
    copyTree(tmp, target);
    createdTarget = true;
    if (faultInjection) faultInjection("after-copy");
    if (!sameTree(path.join(tmp, "work"), path.join(target, "work"))) throw new Error("寫入後驗證失敗");
  } catch (e) {
    if (createdTarget || fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new ArchiveError(`封存中途失敗，已移除本次建立的 archive/changes/${change}；原工作包未動。原因：${e.message}`, "APPLY_FAILED");
  }

  fs.rmSync(workSrc, { recursive: true, force: true });
  if (fs.existsSync(inputsSrc)) fs.rmSync(inputsSrc, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });

  // ---- 清除活動上下文 ----
  let clearedContext = false;
  const fj = path.join(projectRoot, ".specify", "feature.json");
  if (fs.existsSync(fj)) {
    try {
      const data = JSON.parse(fs.readFileSync(fj, "utf8"));
      const v = JSON.stringify(data);
      if (v.includes(change)) {
        fs.rmSync(fj);
        clearedContext = true;
      }
    } catch {
      /* 無法解析就不動它 */
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
    console.log(json ? JSON.stringify({ project: r.projectId, ...result }, null, 2) : `archive 完成：${result.archivedTo ?? result.note}\n${result.note ?? ""}`);
  } catch (e) {
    if (e instanceof ArchiveError || e instanceof ProjectError || e instanceof GitError || e?.name === "AdoptError") {
      const msg = { ok: false, error: e.code, message: e.message, details: e.details };
      if (json) console.log(JSON.stringify(msg, null, 2));
      else console.error(`錯誤（${e.code}）：${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
