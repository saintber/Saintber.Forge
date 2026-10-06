#!/usr/bin/env node
// 把 hub 擴充安裝給「每一個」已安裝的整合（例如 claude 與 codex）。
//
// 為什麼需要這個腳本：上游 Spec Kit v1.1.0 的 `specify extension add` 一次只會把指令註冊給
// **一個**代理（init-options.json 的 active 代理）。見 specs/001-stage1-speckit-extension/research.md。
//
// 做法（研究中的方案 A）：對每個整合依序
//   specify integration use <agent>  →  specify extension add --dev --force <extension>
// 最後把預設整合**切回原值**，並以 `specify integration status` 驗證沒有被修改的受管理檔案。
// 全程只使用上游 CLI，不手改任何 CLI 產生的檔案。
//
// 用法：node tooling/speckit/install.mjs [--project-dir <dir>] [--dry-run]
//   --project-dir  要安裝的 Spec Kit 專案根目錄（含 .specify/），預設為目前目錄
//   --dry-run      只列出會執行的指令

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(here, "extension");

function parseArgs(argv) {
  const a = { projectDir: process.cwd(), dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project-dir") a.projectDir = path.resolve(argv[++i]);
    else if (argv[i] === "--dry-run") a.dryRun = true;
    else throw new Error(`未知的參數：${argv[i]}`);
  }
  return a;
}

function specify(cwd, args, { dryRun } = {}) {
  const shown = `specify ${args.join(" ")}`;
  if (dryRun) {
    console.log(`[dry-run] (${cwd}) ${shown}`);
    return "";
  }
  try {
    return execFileSync("specify", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NO_COLOR: "1" } });
  } catch (e) {
    throw new Error(`${shown} 失敗：${(e.stderr || e.stdout || e.message).toString().trim()}`);
  }
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

function main() {
  const a = parseArgs(process.argv.slice(2));
  const stateFile = path.join(a.projectDir, ".specify", "integration.json");
  if (!fs.existsSync(stateFile)) throw new Error(`不是 Spec Kit 專案（找不到 ${stateFile}）`);

  const state = readJson(stateFile);
  const agents = state.installed_integrations || [];
  const originalDefault = state.default_integration || state.integration;
  if (agents.length === 0) throw new Error("沒有已安裝的整合");
  console.log(`專案：${a.projectDir}`);
  console.log(`整合：${agents.join(", ")}；原本的預設：${originalDefault}`);

  try {
    for (const agent of agents) {
      console.log(`\n→ 安裝給 ${agent}`);
      specify(a.projectDir, ["integration", "use", agent], a);
      specify(a.projectDir, ["extension", "add", "--dev", "--force", extensionDir], a);
    }
  } finally {
    // 不論成功或失敗，都把預設整合切回原值
    if (originalDefault) {
      console.log(`\n→ 還原預設整合為 ${originalDefault}`);
      specify(a.projectDir, ["integration", "use", originalDefault], a);
    }
  }

  if (a.dryRun) return;

  // 驗證：每個代理都拿到三個指令；預設已還原；沒有被修改的受管理檔案
  const after = readJson(stateFile);
  if ((after.default_integration || after.integration) !== originalDefault) {
    throw new Error(`預設整合沒有還原（目前：${after.default_integration}）`);
  }
  const status = specify(a.projectDir, ["integration", "status"]);
  const modified = /Modified managed files:\s*(\d+)/.exec(status);
  const missing = /Missing managed files:\s*(\d+)/.exec(status);
  if (!modified || !missing || modified[1] !== "0" || missing[1] !== "0") {
    throw new Error(`specify integration status 顯示受管理檔案有異動：\n${status}`);
  }
  console.log("\n驗證：");
  console.log(`  預設整合已還原為 ${originalDefault}`);
  console.log(`  受管理檔案：modified ${modified[1]}、missing ${missing[1]}`);
  for (const agent of agents) {
    const dir = agent === "claude" ? ".claude/skills" : agent === "codex" ? ".agents/skills" : null;
    if (!dir) {
      console.log(`  ${agent}：未知的技能目錄，請手動確認`);
      continue;
    }
    const got = ["context", "adopt", "archive"].filter((c) => fs.existsSync(path.join(a.projectDir, dir, `speckit-hub-${c}`, "SKILL.md")));
    console.log(`  ${agent}（${dir}）：${got.length}/3 個指令${got.length === 3 ? "" : "  ← 缺少！"}`);
    if (got.length !== 3) process.exitCode = 1;
  }
}

try {
  main();
} catch (e) {
  console.error(`錯誤：${e.message}`);
  process.exit(1);
}
