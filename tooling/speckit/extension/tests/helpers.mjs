// 測試輔助：在系統暫存目錄建立隔離的 workspace 與 git repo。**絕不碰本 repo。**
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function tmpDir(prefix = "hubext-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

export function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function initRepo(root) {
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@t");
  git(root, "config", "user.name", "t");
  git(root, "config", "core.autocrlf", "false");
}

export function commitAll(root, msg = "c") {
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", msg);
  return git(root, "rev-parse", "HEAD").trim();
}

/** 建立一個 workspace：Hub（根）+ 一個登錄的專案 `tool-a`。 */
export function makeWorkspace({ withGit = true } = {}) {
  const root = tmpDir();
  write(root, "workspace.json", JSON.stringify({
    schemaVersion: 1, workspace: "t",
    projects: [{ id: "hub", path: ".", status: "active" }, { id: "tool-a", path: "projects/tool-a", status: "incubating" }],
  }, null, 2));
  write(root, ".specify/memory/constitution.md", "# Hub constitution\n");
  write(root, "docs/governance/policy/README.md", "# Hub policy\n");
  write(root, "projects/tool-a/.specify/memory/constitution.md", "# tool-a constitution\n");
  write(root, "projects/tool-a/docs/governance/policy/README.md", "# tool-a policy\n");
  write(root, "projects/tool-a/docs/specifications/README.md", "# index\n");
  fs.mkdirSync(path.join(root, "projects/tool-a/specs"), { recursive: true });
  if (withGit) {
    initRepo(root);
    commitAll(root, "init");
  }
  return root;
}

/** 建立一個沒有 workspace.json 的獨立工具目錄（standalone）。 */
export function makeStandalone() {
  const root = tmpDir("hubext-sa-");
  write(root, ".specify/memory/constitution.md", "# standalone constitution\n");
  write(root, "docs/governance/policy/README.md", "# policy\n");
  write(root, "docs/governance/policy/inherited/README.md", "# inherited\n");
  return root;
}

export function snapshotTree(root) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === ".git") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  walk(root);
  return out.sort();
}
