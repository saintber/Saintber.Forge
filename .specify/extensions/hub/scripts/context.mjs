#!/usr/bin/env node
// speckit.hub.context：載入上下文並回報目標專案（設計 §13.4；POL-SPECKIT-001 R2–R4）
//
// 用法：node context.mjs [--root <dir>] [--project <id|dir>] [--workspace <dir>] [--json]
//
// 只讀；不建立任何檔案。目標無效時以非零退出碼結束，且**不產生任何檔案**。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProject, ProjectError } from "./lib/project.mjs";

const exists = (p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
};

/** 掃描 specs/ 與 archive/changes/ 的編號；編號不重用（POL-SPEC-001 R8）。 */
export function nextChangeNumber(projectRoot) {
  const dirs = [path.join(projectRoot, "specs"), path.join(projectRoot, "archive", "changes")];
  let highest = 0;
  const seen = [];
  for (const d of dirs) {
    if (!exists(d)) continue;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const m = /^(\d{3,})-/.exec(ent.name);
      if (m) {
        const n = parseInt(m[1], 10);
        seen.push({ number: n, name: ent.name, where: path.relative(projectRoot, d).split(path.sep).join("/") });
        if (n > highest) highest = n;
      }
    }
  }
  return { next: String(highest + 1).padStart(3, "0"), highest, seen };
}

/** 依模式列出應讀取的文件（只列出存在的）。 */
export function collectReadList({ mode, projectRoot, workspaceRoot }) {
  const rel = (p) => path.relative(projectRoot, p).split(path.sep).join("/") || ".";
  const out = [];
  const add = (kind, p, note) => {
    if (exists(p)) out.push({ kind, path: p, display: p === projectRoot ? "." : rel(p), note });
  };

  add("constitution", path.join(projectRoot, ".specify", "memory", "constitution.md"), "專案憲章");
  add("policy-index", path.join(projectRoot, "docs", "governance", "policy", "README.md"), "專案 Policy 索引");

  if (mode === "workspace" && workspaceRoot && path.resolve(workspaceRoot) !== path.resolve(projectRoot)) {
    add("hub-constitution", path.join(workspaceRoot, ".specify", "memory", "constitution.md"), "Hub 憲章");
    add("hub-policy-index", path.join(workspaceRoot, "docs", "governance", "policy", "README.md"), "Hub Policy 索引（workspace 與 distribution）");
  }
  if (mode === "standalone") {
    add("inherited-policy", path.join(projectRoot, "docs", "governance", "policy", "inherited"), "版本固定的 distribution Policy 快照（standalone）");
  }
  add("spec-index", path.join(projectRoot, "docs", "specifications", "README.md"), "有效規格索引");
  add("architecture", path.join(projectRoot, "docs", "architecture"), "架構文件");
  return out;
}

export function run(argv, { cwd = process.cwd(), env = process.env } = {}) {
  const args = parseArgs(argv);
  const start = args.root ? path.resolve(args.root) : cwd;
  const resolved = resolveProject({ project: args.project, workspace: args.workspace, cwd: start, env });
  const numbering = nextChangeNumber(resolved.projectRoot);
  const reads = collectReadList(resolved);
  return {
    ok: true,
    mode: resolved.mode,
    projectId: resolved.projectId,
    projectRoot: resolved.projectRoot,
    workspaceRoot: resolved.workspaceRoot,
    resolvedFrom: resolved.source,
    outputRoot: path.join(resolved.projectRoot, "specs"),
    read: reads.map((r) => ({ kind: r.kind, path: r.display, note: r.note })),
    nextChange: numbering.next,
    existingChanges: numbering.seen,
  };
}

function parseArgs(argv) {
  const a = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--json") a.json = true;
    else if (k === "--root") a.root = argv[++i];
    else if (k === "--project") a.project = argv[++i];
    else if (k === "--workspace") a.workspace = argv[++i];
    else throw new ProjectError(`未知的參數：${k}`, "USAGE");
  }
  return a;
}

function main() {
  const json = process.argv.includes("--json");
  try {
    const result = run(process.argv.slice(2));
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`目標專案：${result.projectId}`);
      console.log(`專案根目錄：${result.projectRoot}`);
      console.log(`模式：${result.mode}（解析來源：${result.resolvedFrom}）`);
      console.log(`產出位置：${result.outputRoot}`);
      console.log(`下一個工作包編號：${result.nextChange}`);
      console.log("應讀取：");
      for (const r of result.read) console.log(`  - [${r.kind}] ${r.path}（${r.note}）`);
    }
  } catch (e) {
    if (e instanceof ProjectError) {
      const msg = { ok: false, error: e.code, message: e.message };
      if (json) console.log(JSON.stringify(msg, null, 2));
      else console.error(`錯誤（${e.code}）：${e.message}`);
      process.exit(2);
    }
    throw e;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
