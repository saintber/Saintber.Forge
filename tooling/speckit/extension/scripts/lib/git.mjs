// 唯讀的 git 狀態查詢（設計 §12.6；POL-SPEC-001 R7、R9）
//
// 原則：
//   - 只讀，**絕不** git add / commit / checkout / reset / stash。
//   - 只針對指定的路徑（不檢查整個工作目錄）。
//   - 沒有 git 時明確報錯，不得略過檢查。

import { execFileSync } from "node:child_process";
import path from "node:path";

export class GitError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "GitError";
    this.code = code;
  }
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const stderr = (e.stderr || "").toString().trim();
    if (e.code === "ENOENT") throw new GitError("找不到 git 指令", "NO_GIT");
    throw new GitError(`git ${args.join(" ")} 失敗：${stderr || e.message}`, "GIT_FAILED");
  }
}

/** 回傳 repo 根目錄；不在 git repo 內則丟 GitError(NO_REPO)。 */
export function repoRoot(cwd) {
  try {
    return git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  } catch (e) {
    if (e.code === "NO_GIT") throw e;
    throw new GitError(`${cwd} 不在 git repo 內；無法執行基線檢查，必須明確報錯而不是略過`, "NO_REPO");
  }
}

export function headCommit(cwd) {
  try {
    return git(cwd, ["rev-parse", "HEAD"]).trim();
  } catch (e) {
    if (e.code === "NO_GIT") throw e;
    throw new GitError("repo 還沒有任何 commit", "NO_COMMIT");
  }
}

/**
 * 回傳指定檔案（repo 相對路徑）自 baseline 以來的變更狀態。
 * @returns {{committed:boolean, staged:boolean, unstaged:boolean, untracked:boolean, any:boolean}}
 */
export function pathChangeState(cwd, relPath, baseline) {
  const root = repoRoot(cwd);
  const rel = path.relative(root, path.resolve(cwd, relPath)).split(path.sep).join("/");

  let committed = false;
  if (baseline) {
    const out = git(root, ["diff", "--name-only", `${baseline}`, "HEAD", "--", rel]).trim();
    committed = out.length > 0;
  }
  const staged = git(root, ["diff", "--cached", "--name-only", "--", rel]).trim().length > 0;
  const unstaged = git(root, ["diff", "--name-only", "--", rel]).trim().length > 0;
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "--", rel]).trim().length > 0;

  return { committed, staged, unstaged, untracked, any: committed || staged || unstaged || untracked };
}

/** 路徑目前的內容雜湊（工作目錄，不看 index）；不存在回傳 null。 */
export function worktreeBlob(cwd, relPath) {
  try {
    return git(cwd, ["hash-object", "--", path.resolve(cwd, relPath)]).trim();
  } catch {
    return null;
  }
}
