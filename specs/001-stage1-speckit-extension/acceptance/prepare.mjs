#!/usr/bin/env node
// 為代理驗收建立隔離副本（設計 §13.5；POL-SPECKIT-001 R7）。**不碰本 repo。**
//
// 為每個代理建立**獨立**的副本，避免一個代理看到另一個的產出：
//   <base>/<agent>/hub        Hub 的完整副本（git repo，含已安裝的 hub 擴充）
//   <base>/<agent>/standalone 只含 forge-explorer 的獨立副本（沒有 workspace.json，沒有父 repo）
//
// 用法：node prepare.mjs --repo <本 repo 路徑> --base <輸出目錄> --agents claude,codex

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function args(argv) {
  const a = { agents: ["claude", "codex"] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo") a.repo = path.resolve(argv[++i]);
    else if (argv[i] === "--base") a.base = path.resolve(argv[++i]);
    else if (argv[i] === "--agents") a.agents = argv[++i].split(",");
    else throw new Error(`未知的參數：${argv[i]}`);
  }
  if (!a.repo || !a.base) throw new Error("需要 --repo 與 --base");
  if (a.base.startsWith(a.repo)) throw new Error("--base 不得位在本 repo 內");
  return a;
}

const SKIP = new Set([".git", "node_modules", "bin", "obj"]);
function copy(src, dst, { skipTop = [] } = {}) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    if (skipTop.includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copy(s, d);
    } else fs.copyFileSync(s, d);
  }
}

function git(cwd, ...a) {
  return execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function initGit(dir, msg) {
  git(dir, "init", "-q");
  git(dir, "config", "user.email", "acceptance@local");
  git(dir, "config", "user.name", "acceptance");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", msg);
}

function main() {
  const a = args(process.argv.slice(2));
  fs.mkdirSync(a.base, { recursive: true });
  for (const agent of a.agents) {
    const root = path.join(a.base, agent);
    fs.rmSync(root, { recursive: true, force: true });

    // Hub 副本（排除 .NET 原始碼，代理驗收用不到）
    const hub = path.join(root, "hub");
    fs.mkdirSync(hub, { recursive: true });
    copy(a.repo, hub);
    fs.rmSync(path.join(hub, "projects", "forge-explorer", "src"), { recursive: true, force: true });
    fs.rmSync(path.join(hub, "projects", "forge-explorer", "tests"), { recursive: true, force: true });
    // 驗收用的第二個專案：ai-queue（設計 §13.5 的範例名稱）
    const aq = path.join(hub, "projects", "ai-queue");
    fs.mkdirSync(path.join(aq, "specs"), { recursive: true });
    fs.mkdirSync(path.join(aq, ".specify", "memory"), { recursive: true });
    fs.copyFileSync(path.join(hub, "projects", "forge-explorer", ".specify", "memory", "constitution.md"), path.join(aq, ".specify", "memory", "constitution.md"));
    for (const sub of ["scripts", "templates", "integrations"]) {
      const s = path.join(hub, "projects", "forge-explorer", ".specify", sub);
      if (fs.existsSync(s)) {
        fs.mkdirSync(path.join(aq, ".specify", sub), { recursive: true });
        copy(s, path.join(aq, ".specify", sub));
      }
    }
    for (const f of ["init-options.json", "integration.json"]) {
      const s = path.join(hub, "projects", "forge-explorer", ".specify", f);
      if (fs.existsSync(s)) fs.copyFileSync(s, path.join(aq, ".specify", f));
    }
    fs.writeFileSync(path.join(aq, "README.md"), "# ai-queue (acceptance fixture)\n");
    fs.writeFileSync(path.join(aq, "specs", ".gitkeep"), "");
    const ws = JSON.parse(fs.readFileSync(path.join(hub, "workspace.json"), "utf8"));
    ws.projects.push({ id: "ai-queue", path: "projects/ai-queue", status: "incubating", owner: "saintber" });
    fs.writeFileSync(path.join(hub, "workspace.json"), JSON.stringify(ws, null, 2) + "\n");
    initGit(hub, "acceptance baseline");

    // 安裝 hub 擴充給所有整合（方案 A）
    execFileSync("node", [path.join(hub, "tooling", "speckit", "install.mjs"), "--project-dir", hub], { stdio: "inherit" });
    git(hub, "add", "-A");
    git(hub, "commit", "-q", "-m", "install hub extension");

    // standalone 副本：只有 forge-explorer，沒有 workspace.json、沒有父 repo
    const sa = path.join(root, "standalone");
    fs.mkdirSync(sa, { recursive: true });
    copy(path.join(hub, "projects", "forge-explorer"), sa);
    fs.mkdirSync(path.join(sa, ".specify", "extensions"), { recursive: true });
    copy(path.join(hub, ".specify", "extensions"), path.join(sa, ".specify", "extensions"));
    for (const d of [".claude", ".agents"]) {
      const s = path.join(hub, d, "skills");
      if (!fs.existsSync(s)) continue;
      for (const e of fs.readdirSync(s)) {
        if (!e.startsWith("speckit-hub-")) continue;
        fs.mkdirSync(path.join(sa, d, "skills", e), { recursive: true });
        copy(path.join(s, e), path.join(sa, d, "skills", e));
      }
    }
    initGit(sa, "standalone baseline");

    console.log(`\n${agent}: hub=${hub}\n${agent}: standalone=${sa}`);
  }
}

main();
