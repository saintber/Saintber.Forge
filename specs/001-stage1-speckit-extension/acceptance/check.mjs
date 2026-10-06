#!/usr/bin/env node
// 代理執行後的**客觀檢查**：不採信代理的自述，只看檔案系統與 git 的實際變化。
//
// 用法：node check.mjs --base <prepare 的輸出目錄> --agent <claude|codex>
//
// 檢查：
//   S2  Hub 指定 ai-queue 執行 specify：新檔案只出現在 projects/ai-queue/specs/ 底下
//   S3  指定不存在的專案：沒有任何新檔案
//   SA  standalone：在獨立副本執行 context，結果為 standalone，且沒有讀取父路徑
// 每個情境在代理執行前後各取一次快照（由 run 步驟負責），這裡比對 git status。

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") a.base = path.resolve(argv[++i]);
    else if (argv[i] === "--agent") a.agent = argv[++i];
    else throw new Error(`未知的參數：${argv[i]}`);
  }
  return a;
}

/** 自 baseline commit 起，工作目錄中新增或修改的檔案（含未追蹤）。 */
function changedSince(dir) {
  const out = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: dir, encoding: "utf8" });
  return out
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ""))
    .filter((p) => !p.startsWith(".specify/feature.json")); // 活動上下文屬本機狀態
}

function main() {
  const a = args(process.argv.slice(2));
  const root = path.join(a.base, a.agent);
  const results = [];

  const logs = path.join(root, "logs");
  const readLog = (n) => (fs.existsSync(path.join(logs, n)) ? fs.readFileSync(path.join(logs, n), "utf8") : null);

  // S2 / S3 共用 hub 副本：S3 先執行，S2 後執行；run.md 規定每個情境結束後記錄快照
  const snapS3 = readLog("S3.changes.txt");
  const snapS2 = readLog("S2.changes.txt");

  if (snapS3 === null) results.push({ id: "S3", pass: false, why: "沒有 S3 快照（請依 run.md 執行）" });
  else {
    const files = snapS3.split("\n").filter(Boolean);
    results.push({ id: "S3", pass: files.length === 0, why: files.length ? `不該有任何新檔案，但有：${files.join(", ")}` : "沒有任何新檔案" });
  }

  if (snapS2 === null) results.push({ id: "S2", pass: false, why: "沒有 S2 快照" });
  else {
    const files = snapS2.split("\n").filter(Boolean);
    // 設計 §13.5：「產出只出現在該專案目錄」。
    // 工作包必須在 projects/ai-queue/specs/；目標專案自己的活動上下文指標
    // projects/ai-queue/.specify/feature.json 也在該專案內，屬本機狀態（上游 .specify/.gitignore 排除），允許。
    const ACTIVE_CONTEXT = "projects/ai-queue/.specify/feature.json";
    const work = files.filter((f) => f.startsWith("projects/ai-queue/specs/"));
    const allowedLocalState = files.filter((f) => f === ACTIVE_CONTEXT);
    const outside = files.filter((f) => !f.startsWith("projects/ai-queue/specs/") && f !== ACTIVE_CONTEXT);
    const pass = work.length > 0 && outside.length === 0;
    results.push({
      id: "S2",
      pass,
      why: !work.length
        ? "projects/ai-queue/specs/ 底下沒有產出"
        : outside.length
          ? `有產出在目標專案以外：${outside.join(", ")}`
          : `產出只在目標專案：${work.join(", ")}${allowedLocalState.length ? `（另有該專案的活動上下文 ${ACTIVE_CONTEXT}）` : ""}`,
    });
  }

  const sa = readLog("SA.context.json");
  if (sa === null) results.push({ id: "SA", pass: false, why: "沒有 SA 的 context 輸出" });
  else {
    let j;
    try {
      j = JSON.parse(sa);
    } catch {
      j = null;
    }
    const saChanges = (readLog("SA.changes.txt") || "").split("\n").filter(Boolean);
    const parentRead = j?.read?.some((r) => r.path.startsWith("..")) ?? true;
    const pass = j?.ok === true && j.mode === "standalone" && j.workspaceRoot === null && !parentRead && saChanges.length === 0;
    results.push({ id: "SA", pass, why: j ? `mode=${j.mode}, workspaceRoot=${j.workspaceRoot}, 讀父路徑=${parentRead}, 新檔案=${saChanges.length}` : "context 輸出不是 JSON" });
  }

  console.log(`代理：${a.agent}`);
  for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.why}`);
  process.exitCode = results.every((r) => r.pass) ? 0 : 1;
}

main();
