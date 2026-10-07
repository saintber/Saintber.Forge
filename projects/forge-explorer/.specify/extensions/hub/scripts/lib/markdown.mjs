// Markdown 逐行解析的共用輔助：標示每一行是否位在 fenced code block 之內（Codex 審閱 R10/R13）。
//
// CommonMark 規則（本擴充採用的子集）：
//   - 開頭 fence：行首（最多 3 個空白）後接 3 個以上相同的 ` 或 ~。
//   - 結尾 fence：同一種字元、長度 ≥ 開頭 fence、後面只能有空白。
//   - 未結尾的 fence 延伸到文件結尾。
//   - fence 內的所有內容（包含 #、|、REQ- 標題）都**不是**標題或表格列。
//   - 開頭 fence 與結尾 fence 那兩行本身也算「在 fence 內」（不參與結構解析）。

const OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** @returns {boolean[]} 與 lines 等長：true = 這一行在 fenced code block 內（含 fence 線本身）。 */
export function fenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let fence = null; // { ch, len }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!fence) {
      const m = OPEN.exec(line);
      if (m) {
        const marks = m[1];
        // 以 ` 開頭的 fence，info string 不得再含 `（否則是行內程式碼）
        if (marks[0] === "`" && m[2].includes("`")) continue;
        fence = { ch: marks[0], len: marks.length };
        mask[i] = true;
      }
    } else {
      mask[i] = true;
      const close = new RegExp(`^ {0,3}${fence.ch === "`" ? "`" : "~"}{${fence.len},}\\s*$`);
      if (close.test(line)) fence = null;
    }
  }
  return mask;
}

/** 不在 fence 內的行才回傳其索引，供結構解析使用。 */
export const isStructural = (mask, i) => !mask[i];

/** 簡單的內容雜湊（用於比對 payload 是否相同）。 */
import crypto from "node:crypto";
export function digest(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n").replace(/\s+$/, "")).digest("hex");
}
