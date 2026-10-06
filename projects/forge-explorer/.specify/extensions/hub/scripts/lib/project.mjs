// 專案解析與模式判定（設計 §13.2、§13.4；POL-SPECKIT-001 R2、R3）
//
// 規則：
//   1. 解析順序：明確指定 → SPECIFY_INIT_DIR → 目前目錄最近的 .specify/
//   2. 明確指定的目標無效 → 報錯，不退回 Hub，不降級成 standalone
//   3. 找到 workspace.json：目標必須登錄其中，否則報錯（workspace 模式）
//   4. 找不到 workspace.json 且沒有明確指定 workspace：standalone 模式

import fs from "node:fs";
import path from "node:path";

export class ProjectError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ProjectError";
    this.code = code;
  }
}

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

/** 從 start 往上找含有 `.specify/` 的最近目錄；找不到回傳 null。 */
export function findNearestSpecifyRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (isDir(path.join(dir, ".specify"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** 從 start 往上找含有 `workspace.json` 的最近目錄；找不到回傳 null。 */
export function findWorkspaceRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (isFile(path.join(dir, "workspace.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * 解析目標專案。
 * @param {object} o
 * @param {string} [o.project]   明確指定的專案 ID 或目錄（優先）
 * @param {string} [o.workspace] 明確指定的 workspace 根目錄
 * @param {string} [o.cwd]       目前目錄（預設 process.cwd()）
 * @param {object} [o.env]       環境變數（預設 process.env）
 */
export function resolveProject({ project, workspace, cwd = process.cwd(), env = process.env } = {}) {
  const explicit = Boolean(project || workspace);
  let wsRoot = null;

  if (workspace) {
    const w = path.resolve(workspace);
    if (!isDir(w)) throw new ProjectError(`指定的 workspace 不存在：${w}`, "WORKSPACE_INVALID");
    if (!isFile(path.join(w, "workspace.json"))) {
      throw new ProjectError(`指定的 workspace 沒有 workspace.json：${w}`, "WORKSPACE_INVALID");
    }
    wsRoot = w;
  }

  // ---- 決定專案根目錄 ----
  let projectRoot = null;
  let projectId = null;
  let source;

  if (project) {
    source = "explicit";
    const asPath = path.resolve(cwd, project);
    // 1) 當作目錄
    if (isDir(asPath) && isDir(path.join(asPath, ".specify"))) {
      projectRoot = asPath;
    } else {
      // 2) 當作 workspace.json 中的專案 ID
      const searchFrom = wsRoot ?? findWorkspaceRoot(cwd);
      if (!searchFrom) {
        throw new ProjectError(`找不到指定的專案：${project}（不是含 .specify/ 的目錄，也找不到 workspace.json）`, "PROJECT_INVALID");
      }
      wsRoot = searchFrom;
      const reg = readWorkspace(wsRoot).projects.find((p) => p.id === project);
      if (!reg) throw new ProjectError(`workspace.json 沒有登錄專案：${project}`, "PROJECT_NOT_REGISTERED");
      projectRoot = path.resolve(wsRoot, reg.path);
      if (!isDir(path.join(projectRoot, ".specify"))) {
        throw new ProjectError(`專案 ${project} 的目錄沒有 .specify/：${projectRoot}`, "PROJECT_INVALID");
      }
    }
  } else if (env.SPECIFY_INIT_DIR) {
    source = "SPECIFY_INIT_DIR";
    const d = path.resolve(env.SPECIFY_INIT_DIR);
    if (!isDir(d)) throw new ProjectError(`SPECIFY_INIT_DIR 不是存在的目錄：${d}`, "PROJECT_INVALID");
    if (!isDir(path.join(d, ".specify"))) {
      throw new ProjectError(`SPECIFY_INIT_DIR 不是 Spec Kit 專案（沒有 .specify/）：${d}`, "PROJECT_INVALID");
    }
    projectRoot = d;
  } else {
    source = "nearest";
    projectRoot = findNearestSpecifyRoot(cwd);
    if (!projectRoot) throw new ProjectError(`從 ${path.resolve(cwd)} 往上找不到 .specify/`, "PROJECT_INVALID");
  }

  // ---- 決定模式 ----
  if (!wsRoot) wsRoot = findWorkspaceRoot(projectRoot);

  let mode;
  if (wsRoot) {
    const ws = readWorkspace(wsRoot);
    const rel = path.relative(wsRoot, projectRoot);
    const reg = ws.projects.find((p) => path.resolve(wsRoot, p.path) === projectRoot);
    if (!reg) {
      // 找到了 workspace.json，但專案沒有登錄：報錯（不降級）
      throw new ProjectError(`專案 ${rel || "."} 沒有登錄在 ${path.join(wsRoot, "workspace.json")}`, "PROJECT_NOT_REGISTERED");
    }
    mode = "workspace";
    projectId = reg.id;
  } else {
    if (explicit && workspace) {
      throw new ProjectError("明確指定了 workspace，但找不到 workspace.json", "WORKSPACE_INVALID");
    }
    mode = "standalone";
    projectId = path.basename(projectRoot);
  }

  return { mode, projectId, projectRoot, workspaceRoot: wsRoot, source };
}

export function readWorkspace(wsRoot) {
  const file = path.join(wsRoot, "workspace.json");
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    throw new ProjectError(`無法讀取 ${file}：${e.message}`, "WORKSPACE_INVALID");
  }
  if (!Array.isArray(data.projects)) {
    throw new ProjectError(`${file} 缺少 projects 陣列`, "WORKSPACE_INVALID");
  }
  return data;
}
