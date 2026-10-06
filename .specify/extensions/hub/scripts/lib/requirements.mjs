// 有效規格的 requirement ID 解析、Delta 套用與檢查（設計 §12.2、§12.5；POL-SPEC-001 R1、R5）
//
// 有效規格格式（節錄）：
//   ### REQ-PH-001 標題
//   ...內容...
//   ## Change Log
//   | Date | Change | Requirements | Summary | Archive |
//
// 工作包 spec.md 的 Delta 區段格式（本擴充定義，依設計 §12.3 的「ADDED / MODIFIED / REMOVED」）：
//   ## Delta
//   ### ADDED
//   #### REQ-XX-010 標題
//   內容
//   ### MODIFIED
//   #### REQ-XX-003 標題
//   內容
//   ### REMOVED
//   - REQ-XX-005

const REQ_HEADING = /^###\s+(REQ-[A-Z0-9]+-\d+)\b(.*)$/;
const DELTA_REQ_HEADING = /^####\s+(REQ-[A-Z0-9]+-\d+)\b(.*)$/;
const REQ_ID = /REQ-[A-Z0-9]+-\d+/g;

/** 解析有效規格，回傳 { front, before, reqs:[{id, title, body}], after } */
export function parseSpec(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const reqs = [];
  let first = -1;
  let last = -1; // 最後一條 requirement 內容的結束 index（不含）
  let i = 0;
  while (i < lines.length) {
    const m = REQ_HEADING.exec(lines[i]);
    if (m) {
      if (first < 0) first = i;
      let j = i + 1;
      while (j < lines.length && !/^#{1,3}\s/.test(lines[j])) j++;
      reqs.push({ id: m[1], title: m[2].trim(), body: lines.slice(i + 1, j).join("\n").replace(/\s+$/, "") });
      last = j;
      i = j;
    } else {
      i++;
    }
  }
  if (first < 0) return { lines, reqs: [], first: -1, last: -1 };
  return { lines, reqs, first, last };
}

/** 檢查有效規格本身：ID 是否重複。 */
export function validateSpec(text) {
  const { reqs } = parseSpec(text);
  const seen = new Set();
  const errors = [];
  for (const r of reqs) {
    if (seen.has(r.id)) errors.push(`requirement ID 重複：${r.id}`);
    seen.add(r.id);
  }
  return errors;
}

/** 解析工作包 spec.md 的 Delta。 */
export function parseDelta(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^##\s+Delta\b/.test(l));
  if (start < 0) return { found: false, added: [], modified: [], removed: [] };

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const out = { found: true, added: [], modified: [], removed: [] };
  let section = null;
  let cur = null;
  const flush = () => {
    if (cur) {
      cur.body = cur.body.replace(/\s+$/, "");
      out[section].push(cur);
      cur = null;
    }
  };
  for (let i = start + 1; i < end; i++) {
    const h = /^###\s+(ADDED|MODIFIED|REMOVED)\b/.exec(lines[i]);
    if (h) {
      flush();
      section = h[1].toLowerCase();
      continue;
    }
    if (!section) continue;
    if (section === "removed") {
      const ids = lines[i].match(REQ_ID);
      if (ids) for (const id of ids) out.removed.push({ id });
      continue;
    }
    const m = DELTA_REQ_HEADING.exec(lines[i]);
    if (m) {
      flush();
      cur = { id: m[1], title: m[2].trim(), body: "" };
    } else if (cur) {
      cur.body += (cur.body ? "\n" : "") + lines[i];
    }
  }
  flush();
  return out;
}

/**
 * 把 Delta 套用到有效規格文字，回傳 { text, errors }。
 * 檢查：新增的 ID 不得已存在、也不得是 Change Log 中標示為 removed 的 ID（不重用）；
 *       修改與移除的 ID 必須存在；Delta 內 ID 不得重複。
 */
export function applyDelta(specText, delta) {
  const errors = [];
  const parsed = parseSpec(specText);
  const existing = new Map(parsed.reqs.map((r) => [r.id, r]));
  const removedBefore = removedIdsFromChangeLog(specText);

  const seen = new Set();
  for (const sec of ["added", "modified", "removed"]) {
    for (const r of delta[sec]) {
      if (seen.has(r.id)) errors.push(`Delta 內 requirement ID 重複：${r.id}`);
      seen.add(r.id);
    }
  }
  for (const r of delta.added) {
    if (existing.has(r.id)) errors.push(`ADDED 的 ${r.id} 已存在於有效規格`);
    if (removedBefore.has(r.id)) errors.push(`ADDED 的 ${r.id} 曾被移除，requirement ID 不得重用`);
  }
  for (const r of delta.modified) if (!existing.has(r.id)) errors.push(`MODIFIED 的 ${r.id} 不存在於有效規格`);
  for (const r of delta.removed) if (!existing.has(r.id)) errors.push(`REMOVED 的 ${r.id} 不存在於有效規格`);
  if (errors.length) return { text: specText, errors };

  const removedNow = new Set(delta.removed.map((r) => r.id));
  const modMap = new Map(delta.modified.map((r) => [r.id, r]));
  const rendered = [];
  for (const r of parsed.reqs) {
    if (removedNow.has(r.id)) continue;
    const m = modMap.get(r.id);
    rendered.push(m ? render(m) : render(r));
  }
  for (const r of delta.added) rendered.push(render(r));

  let lines = parsed.lines;
  if (parsed.first < 0) {
    // 沒有任何 requirement：加在 "## Requirements" 之後；沒有就加在檔尾
    const at = lines.findIndex((l) => /^##\s+Requirements\b/.test(l));
    const head = at >= 0 ? lines.slice(0, at + 1) : [...lines, "", "## Requirements"];
    const tail = at >= 0 ? lines.slice(at + 1) : [];
    lines = [...head, "", ...rendered.join("\n\n").split("\n"), "", ...tail];
  } else {
    lines = [...lines.slice(0, parsed.first), ...rendered.join("\n\n").split("\n"), "", ...lines.slice(parsed.last)];
  }
  return { text: lines.join("\n"), errors: [] };
}

function render(r) {
  return `### ${r.id}${r.title ? " " + r.title : ""}\n${r.body ? r.body + "\n" : ""}`.replace(/\n+$/, "\n");
}

/** Change Log 中以 `-REQ-XX-n` 標示為移除的 ID。 */
export function removedIdsFromChangeLog(specText) {
  const out = new Set();
  const lines = specText.replace(/\r\n/g, "\n").split("\n");
  let inLog = false;
  for (const l of lines) {
    if (/^##\s+Change Log\b/.test(l)) {
      inLog = true;
      continue;
    }
    if (inLog && /^##\s+/.test(l)) inLog = false;
    if (inLog && l.startsWith("|")) {
      for (const m of l.matchAll(/-\s*(REQ-[A-Z0-9]+-\d+)/g)) out.add(m[1]);
    }
  }
  return out;
}

/** 在 Change Log 表格新增一列；找不到 Change Log 則建立。 */
export function appendChangeLog(specText, row) {
  const lines = specText.replace(/\r\n/g, "\n").split("\n");
  const line = `| ${row.date} | ${row.change} | ${row.requirements} | ${row.summary} | ${row.archive} |`;
  const at = lines.findIndex((l) => /^##\s+Change Log\b/.test(l));
  if (at < 0) {
    const tail = ["", "## Change Log", "| Date | Change | Requirements | Summary | Archive |", "|---|---|---|---|---|", line, ""];
    return [...lines.filter((_, i) => !(i === lines.length - 1 && lines[i] === "")), ...tail].join("\n");
  }
  let end = at + 1;
  let lastRow = -1;
  while (end < lines.length && !/^##\s+/.test(lines[end])) {
    if (lines[end].startsWith("|")) lastRow = end;
    end++;
  }
  if (lastRow < 0) {
    return [...lines.slice(0, at + 1), "| Date | Change | Requirements | Summary | Archive |", "|---|---|---|---|---|", line, ...lines.slice(at + 1)].join("\n");
  }
  return [...lines.slice(0, lastRow + 1), line, ...lines.slice(lastRow + 1)].join("\n");
}
