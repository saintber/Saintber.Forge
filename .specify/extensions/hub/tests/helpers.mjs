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

/** 工作包 Delta 的標題層級升級：舊寫法 `### ADDED / #### REQ-…` → 新寫法 `#### ADDED / ##### REQ-…`。 */
function upgradeDelta(text) {
  return String(text)
    .replace(/^### (ADDED|MODIFIED|REMOVED)/gm, "#### $1")
    .replace(/^#### (REQ-)/gm, "##### $1");
}

/**
 * 在 `<root>/<toolDir>/specs/<change>/` 建立工作包（spec.md + verification.md）。
 * delta：只含 ADDED / MODIFIED / REMOVED 的片段，會包進 caps 的第一個 capability；
 * deltaFull：完整的 `## Delta` 內容（多 capability 時使用）。
 */
export function writeWorkPackage(root, toolDir, change, o) {
  const { baseline, status = "verified", verified = true, delta, deltaFull, caps = "cap-x", owner } = o;
  const capList = String(caps).split(/[,\s]+/).filter(Boolean);
  const body = deltaFull ?? `### ${capList[0]}\n${upgradeDelta(delta)}`;
  const capsLine = capList.map((c) => "`" + c + "`").join(", ");
  const ownerLine = owner ? `\n**Owner**: ${owner}` : "";
  write(root, `${toolDir}/specs/${change}/spec.md`, [
    `# Feature Specification: ${change}`,
    "",
    `**Status**: ${status}`,
    "**Baseline**: `" + baseline + "`",
    `**Affected Capabilities**: ${capsLine}${ownerLine}`,
    "",
    "## Delta",
    body,
    "",
  ].join("\n"));
  write(root, `${toolDir}/specs/${change}/verification.md`, [
    `# Verification Record — ${change}`,
    "",
    "## Final Status",
    `- ${verified ? "Done" : "Not Done"}`,
    "",
  ].join("\n"));
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
