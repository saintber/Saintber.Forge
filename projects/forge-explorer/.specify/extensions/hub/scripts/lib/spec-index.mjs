// 有效規格索引（docs/specifications/README.md）的更新（設計 §12.2；Codex 審閱 R12）
//
// 規則：只更新或新增「該 capability 的那一列」，其餘內容（使用者的說明、其他列、其他章節）原樣保留。
// 索引表的辨識：第一個表頭第一欄是 `capability` 的表格。

const lf = (t) => t.replace(/\r\n/g, "\n");
const HEADER = "| capability | owner | 一句話說明 | 最後採納 | 規格 |";

function cells(line) {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

/**
 * @param {string} text 索引原文
 * @param {{capability:string, owner:string, change:string, isNew:boolean}} row
 */
export function upsertIndexRow(text, row) {
  const lines = lf(text).split("\n");
  const head = lines.findIndex((l) => l.startsWith("|") && /^capability$/i.test(cells(l)[0] || ""));
  const link = `[spec.md](${row.capability}/spec.md)`;

  if (head < 0) {
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return [...lines, "", "## Capability 索引", "", HEADER, "|---|---|---|---|---|", `| \`${row.capability}\` | ${row.owner} | （待補） | \`${row.change}\` | ${link} |`, ""].join("\n");
  }

  const header = cells(lines[head]).map((c) => c.toLowerCase());
  const col = (name) => header.findIndex((h) => h.includes(name));
  const iCap = 0;
  const iOwner = col("owner");
  const iAdopted = header.findIndex((h) => h.includes("最後採納") || h.includes("last"));

  let end = head + 2;
  while (end < lines.length && lines[end].startsWith("|")) end++;

  for (let i = head + 2; i < end; i++) {
    const c = cells(lines[i]);
    if ((c[iCap] || "").replace(/`/g, "") !== row.capability) continue;
    if (iAdopted >= 0) c[iAdopted] = `\`${row.change}\``;
    if (iOwner >= 0 && !c[iOwner]) c[iOwner] = row.owner;
    lines[i] = `| ${c.join(" | ")} |`;
    return lines.join("\n");
  }

  const c = header.map(() => "");
  c[iCap] = `\`${row.capability}\``;
  if (iOwner >= 0) c[iOwner] = row.owner;
  if (iAdopted >= 0) c[iAdopted] = `\`${row.change}\``;
  const iDesc = header.findIndex((h) => h.includes("說明") || h.includes("desc"));
  if (iDesc >= 0) c[iDesc] = "（待補）";
  const iLink = header.findIndex((h) => h.includes("規格") || h.includes("spec"));
  if (iLink >= 0) c[iLink] = link;
  lines.splice(end, 0, `| ${c.join(" | ")} |`);
  return lines.join("\n");
}
