// 集中式的 ID 與路徑邊界檢查（Codex 審閱 R11）。
//
// 所有由使用者或檔案內容決定的路徑片段（change、capability、專案路徑）都必須先經過這裡：
//   1. ID 只能是單一路徑片段，白名單字元，不得含分隔符、`..`、磁碟代號、絕對路徑。
//   2. 組出的實際路徑（解析 symlink / junction 後）必須位在指定的根目錄之內。
//   3. 遞迴刪除之前，必須再次確認目標路徑位在允許的根目錄之內，且不是根目錄本身。

import fs from "node:fs";
import path from "node:path";

export class SafetyError extends Error {
  constructor(message, code = "UNSAFE_PATH") {
    super(message);
    this.name = "SafetyError";
    this.code = code;
  }
}

// change：NNN-name（例如 002-selective-install）
const CHANGE_ID = /^\d{3,}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
// capability：小寫 kebab-case（例如 portal-home）
const CAPABILITY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// requirement：REQ-<段>(-<段>)*-<數字>，每段大寫英數（例如 REQ-PH-001、REQ-AIQ-RETRY-001）
export const REQ_ID_PATTERN = /^REQ(?:-[A-Z0-9]+)+-\d+$/;
export const REQ_ID_INLINE = /REQ(?:-[A-Z0-9]+)+-\d+/g;

function checkSegment(kind, value, pattern) {
  if (typeof value !== "string" || value.length === 0) throw new SafetyError(`${kind} 不得為空`, "INVALID_ID");
  if (value.length > 100) throw new SafetyError(`${kind} 太長：${value.slice(0, 40)}…`, "INVALID_ID");
  if (/[\\/]/.test(value) || value.includes("..") || /^[a-zA-Z]:/.test(value) || path.isAbsolute(value)) {
    throw new SafetyError(`${kind} 不得包含路徑分隔符、..、磁碟代號或絕對路徑：${value}`, "INVALID_ID");
  }
  if (!pattern.test(value)) throw new SafetyError(`${kind} 格式不合法：${value}`, "INVALID_ID");
  return value;
}

export const assertChangeId = (v) => checkSegment("change ID", v, CHANGE_ID);
export const assertCapabilityId = (v) => checkSegment("capability ID", v, CAPABILITY_ID);
export function assertRequirementId(v) {
  if (!REQ_ID_PATTERN.test(v)) throw new SafetyError(`requirement ID 格式不合法：${v}（應為 REQ-<大寫英數段>-<數字>）`, "INVALID_REQ_ID");
  return v;
}

/** 解析實際路徑（處理 symlink / junction）。不存在的部分以最近存在的祖先解析後接回。 */
export function realPathLoose(p) {
  const abs = path.resolve(p);
  let cur = abs;
  const tail = [];
  for (;;) {
    try {
      const real = fs.realpathSync.native(cur);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return abs;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);

/** target（解析 symlink 後）是否位在 root（解析後）之內；allowEqual 決定是否允許等於 root。 */
export function isInside(root, target, { allowEqual = false } = {}) {
  const r = norm(realPathLoose(root));
  const t = norm(realPathLoose(target));
  if (t === r) return allowEqual;
  const rel = path.relative(r, t);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** 以 root 為基準組出路徑，並確認結果（含 symlink 解析後）仍在 root 之內。 */
export function within(root, ...segments) {
  const p = path.join(root, ...segments);
  if (!isInside(root, p)) throw new SafetyError(`路徑越界：${p} 不在 ${root} 之內`);
  return p;
}

/**
 * 確認 root 到 target 之間（含 target 本身）沒有任何 symlink / junction。
 * 用於要寫入或刪除的位置：即使連結指向 root 之內，也拒絕，避免寫到或刪到非預期的位置。
 */
export function assertNoLinks(root, target) {
  const r = path.resolve(root);
  const t = path.resolve(target);
  const rel = path.relative(r, t);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new SafetyError(`路徑越界：${t} 不在 ${r} 之內`);
  let cur = r;
  for (const part of rel ? rel.split(path.sep) : []) {
    cur = path.join(cur, part);
    let st;
    try {
      st = fs.lstatSync(cur);
    } catch {
      return; // 尚不存在，後面的部分也不存在
    }
    if (st.isSymbolicLink()) throw new SafetyError(`拒絕操作：${cur} 是 symlink / junction`, "UNSAFE_PATH");
  }
}

/** 安全的遞迴刪除：只刪 allowedRoot 之內、不等於 allowedRoot 的路徑。 */
export function safeRemove(allowedRoot, target) {
  let st;
  try {
    st = fs.lstatSync(target);
  } catch {
    return; // 不存在
  }
  if (st.isSymbolicLink()) throw new SafetyError(`拒絕刪除：${target} 是 symlink / junction`, "UNSAFE_REMOVE");
  if (!isInside(allowedRoot, target)) {
    throw new SafetyError(`拒絕刪除：${target} 不在允許的範圍 ${allowedRoot} 之內`, "UNSAFE_REMOVE");
  }
  assertNoLinks(allowedRoot, target);
  fs.rmSync(target, { recursive: true, force: true });
}
