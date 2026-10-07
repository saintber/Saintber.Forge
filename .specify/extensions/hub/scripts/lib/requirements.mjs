// 有效規格與 Delta 的解析、套用與檢查（設計 §12.2、§12.3、§12.5；Codex 審閱 R10、R12）
//
// ── 有效規格的格式 ──
//   frontmatter（--- … ---）
//   ## Requirements
//   ### REQ-XX-001 標題          ← requirement：一個 ### 標題，到下一個「任何層級 ≤ 3 的標題」為止
//   …內容…
//   ## 其他章節                   ← 不是 requirement 的內容：**一律原樣保留**
//   ## Change Log
//   | Date | Change | Requirements | Summary | Archive |
//
// ── 工作包 spec.md 的 Delta 格式 ──
//   ## Delta
//   ### cap-x                     ← capability（一個工作包可有多個）
//   #### ADDED
//   ##### REQ-XX-010 標題
//   內容
//   #### MODIFIED
//   ##### REQ-XX-003 標題
//   內容
//   #### REMOVED
//   - REQ-XX-005
//
// 嚴格規則：Delta 區段裡**任何無法辨識的內容都是錯誤**，不得靜默忽略；空 Delta 是錯誤。

import { REQ_ID_PATTERN, REQ_ID_INLINE, assertCapabilityId } from "./safety.mjs";
import { fenceMask, digest } from "./markdown.mjs";

const HEADING = /^(#{1,6})\s+(.*)$/;
const REQ_HEAD = /^###\s+(\S+)(.*)$/;

const lf = (t) => t.replace(/\r\n/g, "\n");

// ───────────────────────── 有效規格 ─────────────────────────

/**
 * 把有效規格切成「區塊」，requirement 區塊可被替換或移除，其他區塊原樣保留。
 * @returns {{blocks:{type:'text'|'req', id?:string, title?:string, lines:string[]}[], errors:string[]}}
 */
export function parseSpec(text) {
  const lines = lf(text).split("\n");
  const mask = fenceMask(lines);
  const blocks = [];
  const errors = [];
  let cur = { type: "text", lines: [] };
  const push = () => {
    if (cur.lines.length || cur.type === "req") blocks.push(cur);
  };
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // fenced code block 內的任何行（含 ### REQ-…、| 資料列）都不是結構，只是內容
    if (mask[li]) {
      cur.lines.push(line);
      continue;
    }
    const h = HEADING.exec(line);
    if (h && h[1].length <= 3) {
      // 任何 ≤ 3 層的標題都會結束前一個 requirement
      if (h[1].length === 3) {
        const m = REQ_HEAD.exec(line);
        if (m && /^REQ-/.test(m[1])) {
          if (!REQ_ID_PATTERN.test(m[1])) errors.push(`有效規格中的 requirement ID 格式不合法：${m[1]}`);
          push();
          cur = { type: "req", id: m[1], title: m[2].trim(), lines: [line] };
          continue;
        }
      }
      if (cur.type === "req") {
        push();
        cur = { type: "text", lines: [] };
      }
    }
    cur.lines.push(line);
  }
  push();
  const seen = new Set();
  for (const b of blocks) {
    if (b.type !== "req") continue;
    if (seen.has(b.id)) errors.push(`有效規格中的 requirement ID 重複：${b.id}`);
    seen.add(b.id);
  }
  return { blocks, errors };
}

export function validateSpec(text) {
  return parseSpec(text).errors;
}

// ───────────────────────── Delta ─────────────────────────

/**
 * 解析工作包的 Delta。
 * @returns {{found:boolean, capabilities: Map<string,{added:Req[],modified:Req[],removed:{id:string}[]}>, errors:string[]}}
 */
export function parseDelta(text) {
  const lines = lf(text).split("\n");
  const mask = fenceMask(lines);
  const start = lines.findIndex((l, i) => !mask[i] && /^##\s+Delta\s*$/.test(l));
  const out = { found: start >= 0, capabilities: new Map(), errors: [] };
  if (start < 0) return out;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (mask[i]) continue;
    const h = HEADING.exec(lines[i]);
    if (h && h[1].length <= 2) {
      end = i;
      break;
    }
  }

  let cap = null;
  let section = null;
  let req = null;
  const flush = () => {
    if (req) {
      req.body = req.body.replace(/\s+$/, "");
      req.digest = digest(`${req.id}\n${req.title}\n${req.body}`); // 標題與內容的雜湊：adopt 後工作包若被改，採納快照就對不上
      cap[section].push(req);
      req = null;
    }
  };

  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    const where = `Delta 第 ${i + 1} 行`;
    // fence 內的行是 requirement 內容的一部分，不是結構
    if (mask[i]) {
      if (req) req.body += (req.body ? "\n" : "") + line;
      else out.errors.push(`${where}：程式碼區塊不在任何 requirement 之下`);
      continue;
    }
    const h = HEADING.exec(line);

    if (h && h[1].length === 3) {
      flush();
      const name = h[2].trim().replace(/`/g, "");
      try {
        assertCapabilityId(name);
      } catch (e) {
        out.errors.push(`${where}：${e.message}`);
        cap = null;
        section = null;
        continue;
      }
      if (out.capabilities.has(name)) out.errors.push(`${where}：capability 重複：${name}`);
      cap = { added: [], modified: [], removed: [] };
      out.capabilities.set(name, cap);
      section = null;
      continue;
    }
    if (h && h[1].length === 4) {
      flush();
      const s = h[2].trim().toUpperCase();
      if (!cap) {
        out.errors.push(`${where}：${h[2].trim()} 出現在任何 capability（### <capability>）之前`);
        continue;
      }
      if (!["ADDED", "MODIFIED", "REMOVED"].includes(s)) {
        out.errors.push(`${where}：未知的 Delta 區段「${h[2].trim()}」（只允許 ADDED、MODIFIED、REMOVED）`);
        section = null;
        continue;
      }
      section = s.toLowerCase();
      continue;
    }
    if (h && h[1].length === 5) {
      flush();
      if (!cap || !section) {
        out.errors.push(`${where}：requirement 標題不在任何 capability / 區段之下`);
        continue;
      }
      if (section === "removed") {
        out.errors.push(`${where}：REMOVED 只能用「- REQ-...」列出 ID，不能有 requirement 標題`);
        continue;
      }
      const m = /^#####\s+(\S+)(.*)$/.exec(line);
      if (!REQ_ID_PATTERN.test(m[1])) {
        out.errors.push(`${where}：requirement ID 格式不合法：${m[1]}`);
        continue;
      }
      req = { id: m[1], title: m[2].trim(), body: "" };
      continue;
    }
    if (h) {
      out.errors.push(`${where}：Delta 內不允許這個標題層級：${line.trim()}`);
      continue;
    }

    if (section === "removed") {
      if (!line.trim()) continue;
      const m = /^\s*[-*]\s+(\S+)\s*$/.exec(line);
      if (!m) {
        out.errors.push(`${where}：REMOVED 的每一行必須是「- REQ-...」：${line.trim()}`);
        continue;
      }
      if (!REQ_ID_PATTERN.test(m[1])) {
        out.errors.push(`${where}：requirement ID 格式不合法：${m[1]}`);
        continue;
      }
      cap.removed.push({ id: m[1] });
      continue;
    }
    if (req) {
      req.body += (req.body ? "\n" : "") + line;
      continue;
    }
    if (line.trim()) out.errors.push(`${where}：無法辨識的內容（不在任何 requirement 之下）：${line.trim()}`);
  }
  flush();

  if (out.capabilities.size === 0 && out.errors.length === 0) out.errors.push("Delta 是空的：沒有任何 capability");
  for (const [name, c] of out.capabilities) {
    if (!c.added.length && !c.modified.length && !c.removed.length) out.errors.push(`capability ${name} 的 Delta 是空的`);
    const seen = new Set();
    for (const r of [...c.added, ...c.modified, ...c.removed]) {
      if (seen.has(r.id)) out.errors.push(`capability ${name} 的 Delta 內 requirement ID 重複：${r.id}`);
      seen.add(r.id);
    }
  }
  return out;
}

// ───────────────────────── 套用 ─────────────────────────

/**
 * 把一個 capability 的 Delta 套用到有效規格，回傳 { text, errors }。
 * - requirement 以外的內容**原樣保留**。
 * - MODIFIED 在原位置替換；REMOVED 移除該區塊；ADDED 接在最後一條 requirement 之後
 *   （沒有 requirement 時接在「## Requirements」標題之後；沒有該標題則在 Change Log 之前建立）。
 */
export function applyDelta(specText, delta) {
  const errors = [];
  const { blocks, errors: parseErrors } = parseSpec(specText);
  errors.push(...parseErrors);

  const existing = new Map(blocks.filter((b) => b.type === "req").map((b) => [b.id, b]));
  const removedBefore = removedIdsFromChangeLog(specText);

  for (const r of delta.added) {
    if (existing.has(r.id)) errors.push(`ADDED 的 ${r.id} 已存在於有效規格`);
    if (removedBefore.has(r.id)) errors.push(`ADDED 的 ${r.id} 曾被移除，requirement ID 不得重用`);
  }
  for (const r of delta.modified) if (!existing.has(r.id)) errors.push(`MODIFIED 的 ${r.id} 不存在於有效規格`);
  for (const r of delta.removed) if (!existing.has(r.id)) errors.push(`REMOVED 的 ${r.id} 不存在於有效規格`);
  if (errors.length) return { text: specText, errors };

  const modMap = new Map(delta.modified.map((r) => [r.id, r]));
  const rmSet = new Set(delta.removed.map((r) => r.id));

  const out = [];
  for (const b of blocks) {
    if (b.type === "req" && rmSet.has(b.id)) continue;
    if (b.type === "req" && modMap.has(b.id)) out.push({ type: "req", lines: renderReq(modMap.get(b.id), trailingBlank(b.lines)) });
    else out.push(b);
  }

  if (delta.added.length) {
    const added = delta.added.flatMap((r) => renderReq(r, 1));
    let at = -1;
    for (let i = out.length - 1; i >= 0; i--) if (out[i].type === "req") { at = i; break; }
    if (at >= 0) {
      ensureTrailingBlank(out[at].lines);
      out.splice(at + 1, 0, { type: "req", lines: added });
    } else {
      // 沒有 requirement：只在「真正的結構」（不在 fenced code block 內）找 ## Requirements / ## Change Log
      const findHeading = (re) => {
        for (let bi = 0; bi < out.length; bi++) {
          if (out[bi].type !== "text") continue;
          const ls = out[bi].lines;
          const mk = fenceMask(ls);
          const li = ls.findIndex((l, i) => !mk[i] && re.test(l));
          if (li >= 0) return { bi, li };
        }
        return null;
      };
      const req = findHeading(/^##\s+Requirements\s*$/);
      if (req) {
        out[req.bi].lines.splice(req.li + 1, 0, "", ...added);
      } else {
        const block = ["## Requirements", "", ...added];
        const cl = findHeading(/^##\s+Change Log\s*$/);
        if (cl) out[cl.bi].lines.splice(cl.li, 0, ...block);
        else {
          const last = out[out.length - 1];
          if (last) ensureTrailingBlank(last.lines);
          out.push({ type: "text", lines: block });
        }
      }
    }
  }

  const text = out.flatMap((b) => b.lines).join("\n");
  // 套用後驗證：每條 ADDED/MODIFIED 必須真的被解析為 requirement，REMOVED 必須消失（不得空採納）
  const after = new Map(parseSpec(text).blocks.filter((b) => b.type === "req").map((b) => [b.id, b]));
  for (const r of [...delta.added, ...delta.modified]) {
    const b = after.get(r.id);
    if (!b) errors.push(`套用後 ${r.id} 沒有出現在有效規格的 requirement 結構中（可能落入 code block）`);
    else if (digest(b.lines.join("\n")) !== digest(renderReq(r, 1).join("\n"))) errors.push(`套用後 ${r.id} 的內容與 Delta 不一致`);
  }
  for (const r of delta.removed) if (after.has(r.id)) errors.push(`套用後 ${r.id} 仍存在`);
  if (errors.length) return { text: specText, errors };
  return { text, errors: [] };
}

function trailingBlank(lines) {
  let n = 0;
  for (let i = lines.length - 1; i >= 0 && lines[i] === ""; i--) n++;
  return n;
}
function ensureTrailingBlank(lines) {
  if (lines[lines.length - 1] !== "") lines.push("");
}
function renderReq(r, blankAfter = 1) {
  const body = r.body ? r.body.split("\n") : [];
  return [`### ${r.id}${r.title ? " " + r.title : ""}`, ...body, ...Array(Math.max(blankAfter, 1)).fill("")];
}

// ───────────────────────── Change Log ─────────────────────────

/** Change Log 中以 `-REQ-...` 標示為移除的 ID。 */
export function removedIdsFromChangeLog(specText) {
  const out = new Set();
  let inLog = false;
  const all = lf(specText).split("\n");
  const mk = fenceMask(all);
  for (let i = 0; i < all.length; i++) {
    if (mk[i]) continue;
    const l = all[i];
    if (/^##\s+Change Log\s*$/.test(l)) { inLog = true; continue; }
    if (inLog && /^##\s+/.test(l)) inLog = false;
    if (inLog && l.startsWith("|")) for (const m of l.matchAll(/-\s*(REQ(?:-[A-Z0-9]+)+-\d+)/g)) out.add(m[1]);
  }
  return out;
}

/**
 * Change Log 的資料列（不含表頭與分隔列）。略過 fenced code block 內的表格列。
 * 第 6 欄 `Snapshot`（內容雜湊）可有可無：沒有的舊資料列 snapshot 為 null。
 */
export function changeLogRows(specText) {
  const rows = [];
  let inLog = false;
  const all = lf(specText).split("\n");
  const mk = fenceMask(all);
  for (let i = 0; i < all.length; i++) {
    if (mk[i]) continue;
    const l = all[i];
    if (/^##\s+Change Log\s*$/.test(l)) { inLog = true; continue; }
    if (inLog && /^##\s+/.test(l)) inLog = false;
    if (!inLog || !l.startsWith("|")) continue;
    const cells = l.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5 || /^-+$/.test(cells[0]) || cells[0] === "Date") continue;
    rows.push({ date: cells[0], change: cells[1], requirements: cells[2], summary: cells[3], archive: cells[4], snapshot: (cells[5] || "").replace(/`/g, "") || null });
  }
  return rows;
}

const LOG_HEAD = "| Date | Change | Requirements | Summary | Archive | Snapshot |";
const LOG_SEP = "|---|---|---|---|---|---|";

/** 在 Change Log 表格新增一列；找不到 Change Log 則建立。略過 fenced code block 內的「## Change Log」。 */
export function appendChangeLog(specText, row) {
  const lines = lf(specText).split("\n");
  const mk = fenceMask(lines);
  const line = `| ${row.date} | ${row.change} | ${row.requirements} | ${row.summary} | ${row.archive} | \`${row.snapshot || ""}\` |`;
  const at = lines.findIndex((l, i) => !mk[i] && /^##\s+Change Log\s*$/.test(l));
  if (at < 0) {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return [...lines, "", "## Change Log", LOG_HEAD, LOG_SEP, line, ""].join("\n");
  }
  let lastRow = -1;
  const tableRows = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (mk[i]) continue;
    if (/^##\s+/.test(lines[i])) break;
    if (lines[i].startsWith("|")) { lastRow = i; tableRows.push(i); }
  }
  // 舊的五欄表：升級表頭與分隔列為六欄，並把舊資料列補一個空的 Snapshot 儲存格（保留舊紀錄原文，Markdown 才能完整顯示）
  const cellCount = (l) => l.split("|").slice(1, -1).length;
  const head = tableRows.find((i) => /^\|\s*Date\s*\|/.test(lines[i]));
  if (head !== undefined && cellCount(lines[head]) === 5) {
    for (const i of tableRows) {
      if (cellCount(lines[i]) !== 5) continue;
      if (i === head) lines[i] = LOG_HEAD;
      else if (/^\|[\s:|-]+\|\s*$/.test(lines[i]) && /-/.test(lines[i])) lines[i] = LOG_SEP;
      else lines[i] = lines[i].replace(/\s*$/, "") + "  |";
    }
  }
  if (lastRow < 0) return [...lines.slice(0, at + 1), LOG_HEAD, LOG_SEP, line, ...lines.slice(at + 1)].join("\n");
  return [...lines.slice(0, lastRow + 1), line, ...lines.slice(lastRow + 1)].join("\n");
}

/** 一個 capability 的 Delta 對應的 Change Log 欄位文字。 */
export function deltaSummaryIds(capDelta) {
  return [
    ...capDelta.added.map((r) => `+${r.id}`),
    ...capDelta.modified.map((r) => `~${r.id}`),
    ...capDelta.removed.map((r) => `-${r.id}`),
  ].join(", ");
}

/**
 * 一個 capability 的 Delta 的**完整內容快照**（雜湊）。
 * 涵蓋 ADDED / MODIFIED 的 id、標題、內文，以及 REMOVED 的 tombstone（id）。
 * 任何一個字改變，雜湊就不同；用來確認「adopt 之後工作包沒有被改」。
 */
export function deltaSnapshot(capDelta) {
  const part = (kind, list) => list.map((r) => `${kind}\u0001${r.id}\u0001${r.digest ?? ""}`).sort().join("\u0002");
  return digest(
    [part("ADDED", capDelta.added), part("MODIFIED", capDelta.modified), part("REMOVED", capDelta.removed.map((r) => ({ id: r.id, digest: "" })))].join("\u0003"),
  );
}

export { REQ_ID_INLINE };
