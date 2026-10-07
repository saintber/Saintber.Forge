// 單元測試：只測純函式（POL-TEST-001 R4）。不使用檔案系統、git 或子程序。
import test from "node:test";
import assert from "node:assert/strict";
import * as r from "../scripts/lib/requirements.mjs";
import { fenceMask } from "../scripts/lib/markdown.mjs";
import { assertChangeId, assertCapabilityId, assertRequirementId, SafetyError } from "../scripts/lib/safety.mjs";

const reqIds = (text) => r.parseSpec(text).blocks.filter((b) => b.type === "req").map((b) => b.id);
const delta = (text) => r.parseDelta(text);

// ───────────────────────── R10：applyDelta 保留不受影響的內容 ─────────────────────────

const ORIGINAL = "# X\n## Requirements\n### REQ-X-001 One\nkeep one\n## Important constraints\nKEEP THIS SECTION\n### REQ-X-002 Two\nkeep two\n## Change Log\n";

test("R10：兩條 requirement 之間的非 requirement 章節，套用 Delta 後完整保留", () => {
  const d = delta("## Delta\n### cap-x\n#### ADDED\n##### REQ-X-003 Three\nthree\n");
  assert.deepEqual(d.errors, []);
  const res = r.applyDelta(ORIGINAL, d.capabilities.get("cap-x"));
  assert.deepEqual(res.errors, []);
  assert.match(res.text, /## Important constraints\nKEEP THIS SECTION\n/);
  assert.match(res.text, /### REQ-X-001 One\nkeep one/);
  assert.match(res.text, /### REQ-X-002 Two\nkeep two/);
  assert.match(res.text, /### REQ-X-003 Three\nthree/);
});

test("R10：REMOVED / MODIFIED 也不影響其他章節", () => {
  const rm = r.applyDelta(ORIGINAL, delta("## Delta\n### cap-x\n#### REMOVED\n- REQ-X-001\n").capabilities.get("cap-x"));
  assert.deepEqual(rm.errors, []);
  assert.match(rm.text, /KEEP THIS SECTION/);
  assert.doesNotMatch(rm.text, /REQ-X-001/);
  const mod = r.applyDelta(ORIGINAL, delta("## Delta\n### cap-x\n#### MODIFIED\n##### REQ-X-002 Two v2\nnew two\n").capabilities.get("cap-x"));
  assert.match(mod.text, /KEEP THIS SECTION/);
  assert.match(mod.text, /### REQ-X-002 Two v2\nnew two/);
  assert.doesNotMatch(mod.text, /keep two/);
});

// ───────────────────────── R10：多段 ID 與嚴格拒絕 ─────────────────────────

test("R10：多段 requirement ID（REQ-AIQ-RETRY-001）被支援，不被靜默忽略", () => {
  const d = delta("## Delta\n### aiq\n#### ADDED\n##### REQ-AIQ-RETRY-001 Retry\nMUST enforce retry limit\n");
  assert.deepEqual(d.errors, []);
  assert.deepEqual(d.capabilities.get("aiq").added.map((x) => x.id), ["REQ-AIQ-RETRY-001"]);
});

test("R10：標準 ID 格式的驗證", () => {
  for (const ok of ["REQ-PH-001", "REQ-AIQ-RETRY-001", "REQ-A1-B2-C3-010"]) assert.doesNotThrow(() => assertRequirementId(ok));
  for (const bad of ["REQ-x-1", "REQ-001", "req-PH-001", "REQ-PH-", "REQ--001", "REQ-PH-001-", "../REQ-A-1"]) {
    assert.throws(() => assertRequirementId(bad), SafetyError, bad);
  }
});

test("R10：空 Delta、未知區段、孤立內容、格式不合法的 ID 一律是錯誤，不被忽略", () => {
  assert.ok(delta("## Delta\n\n").errors.length, "空 Delta");
  assert.ok(delta("## Delta\n### cap-x\n").errors.some((e) => /空/.test(e)), "capability 沒有任何項目");
  assert.ok(delta("## Delta\n### cap-x\n#### WHATEVER\n").errors.some((e) => /未知的 Delta 區段/.test(e)));
  assert.ok(delta("## Delta\n### cap-x\n#### ADDED\nstray text\n##### REQ-A-1 ok\nb\n").errors.some((e) => /無法辨識/.test(e)));
  assert.ok(delta("## Delta\n### cap-x\n#### ADDED\n##### REQ-x-1 lower\nb\n").errors.some((e) => /格式不合法/.test(e)));
  assert.ok(delta("## Delta\n### cap-x\n#### REMOVED\n- not-an-id\n").errors.some((e) => /ID 格式不合法/.test(e)));
  assert.ok(delta("## Delta\n#### ADDED\n##### REQ-A-1 x\nb\n").errors.some((e) => /capability/.test(e)), "區段在 capability 之前");
});

test("R10：同一個 Delta 內重複的原始 ID 被拒絕", () => {
  const d = delta("## Delta\n### cap-x\n#### ADDED\n##### REQ-A-001 a\nx\n#### MODIFIED\n##### REQ-A-001 a2\ny\n");
  assert.ok(d.errors.some((e) => /重複/.test(e)));
});

test("R12：一個工作包可以有多個 capability，各自有自己的 Delta", () => {
  const d = delta("## Delta\n### cap-a\n#### ADDED\n##### REQ-A-001 a\nx\n### cap-b\n#### REMOVED\n- REQ-B-001\n");
  assert.deepEqual(d.errors, []);
  assert.deepEqual([...d.capabilities.keys()].sort(), ["cap-a", "cap-b"]);
});

test("R12：capability 名稱要合法（不能是路徑）", () => {
  assert.ok(delta("## Delta\n### ../../../outside\n#### ADDED\n##### REQ-A-1 x\nb\n").errors.length);
  assert.throws(() => assertCapabilityId("../../../outside-project"), SafetyError);
});

// ───────────────────────── R13：fenced code block ─────────────────────────

test("R13：fenced code 內的 ### REQ-… 不是 requirement；REMOVED 它會報『不存在』而不是刪掉範例", () => {
  const ex = "# Test\n\n## Requirements\n### REQ-Q-001 Real\nExample:\n```markdown\n### REQ-Q-002 Example only\nexample\n```\n\n## Other\nKeep.\n";
  assert.deepEqual(reqIds(ex), ["REQ-Q-001"]);
  const res = r.applyDelta(ex, { added: [], modified: [], removed: [{ id: "REQ-Q-002" }] });
  assert.ok(res.errors.some((e) => /不存在/.test(e)));
  assert.equal(res.text, ex, "錯誤時文字完全不變（範例與 closing fence 都還在）");
});

test("R13：各種 fence 字元與長度（~~~、````、縮排 3 格）都辨識為 code", () => {
  for (const [open, close] of [["```", "```"], ["~~~", "~~~"], ["````", "````"], ["   ```", "```"], ["~~~~~", "~~~~~~"]]) {
    const t = `# T\n\n## Requirements\n### REQ-A-001 Real\n${open}\n### REQ-A-002 fake\n${close}\n### REQ-A-003 after\nx\n`;
    assert.deepEqual(reqIds(t), ["REQ-A-001", "REQ-A-003"], `${open} … ${close}`);
  }
});

test("R13：較短的 fence 不能關閉較長的 fence；不同字元不能互相關閉", () => {
  const nested = "# T\n\n## Requirements\n### REQ-A-001 Real\n````\n```\n### REQ-A-002 still inside\n```\n````\n### REQ-A-003 after\nx\n";
  assert.deepEqual(reqIds(nested), ["REQ-A-001", "REQ-A-003"]);
  const mixed = "# T\n\n## Requirements\n### REQ-A-001 Real\n```\n### REQ-A-002 inside\n~~~\n### REQ-A-004 still inside\n```\n### REQ-A-003 after\nx\n";
  assert.deepEqual(reqIds(mixed), ["REQ-A-001", "REQ-A-003"]);
});

test("R13：未關閉的 fence 延伸到文件結尾", () => {
  assert.deepEqual(reqIds("## Requirements\n### REQ-A-001 Real\n```\n### REQ-A-002 fake\n"), ["REQ-A-001"]);
});

test("R13：Change Log 表格列與標題不受 fenced code 影響", () => {
  const log = "## Change Log\n| Date | Change | Requirements | Summary | Archive |\n|---|---|---|---|---|\n| 2026 | 001-a | +REQ-A-1 | s | a |\n\n```\n| 2026 | 002-fake | -REQ-A-9 | s | a |\n```\n";
  assert.deepEqual(r.changeLogRows(log).map((x) => x.change), ["001-a"]);
  assert.equal(r.removedIdsFromChangeLog(log).has("REQ-A-9"), false, "fence 內的 -REQ 不算移除紀錄");
  const fakeHeading = "# T\n\n```\n## Change Log\n```\n\n## Change Log\n| Date | Change | Requirements | Summary | Archive |\n|---|---|---|---|---|\n";
  const out = r.appendChangeLog(fakeHeading, { date: "d", change: "001-x", requirements: "+REQ-A-1", summary: "s", archive: "a", snapshot: "abc" });
  assert.match(out, /\| d \| 001-x \|/);
  assert.equal(out.indexOf("| d | 001-x"), out.lastIndexOf("| d | 001-x"));
  assert.ok(out.indexOf("| d | 001-x") > out.lastIndexOf("## Change Log"), "新列加在真正的 Change Log，不是 fence 內的");
});

test("R13：Delta 內的 code fence 是 requirement 內容；Delta 標題在 fence 內不算 Delta", () => {
  const d = delta("## Delta\n### cap-x\n#### ADDED\n##### REQ-A-001 With code\nSee:\n```\n#### REMOVED\n- REQ-ZZ-9\n```\n");
  assert.deepEqual(d.errors, []);
  const added = d.capabilities.get("cap-x").added[0];
  assert.match(added.body, /```\n#### REMOVED/);
  assert.equal(d.capabilities.get("cap-x").removed.length, 0);
  assert.equal(delta("```\n## Delta\n### cap-x\n#### ADDED\n##### REQ-A-1 x\nb\n```\n").found, false, "整個 Delta 在 fence 內");
});

test("fenceMask：fence 線本身也標為 fence 內", () => {
  assert.deepEqual(fenceMask(["a", "```", "b", "```", "c"]), [false, true, true, true, false]);
});

// ───────────────────────── R13：Delta 內容快照 ─────────────────────────

const cap = (text, name = "queue") => delta(text).capabilities.get(name);

test("R13：ID 相同但 body 不同 → 快照不同（Codex 探針 modified-body-after-adopt）", () => {
  const a = r.deltaSnapshot(cap("## Delta\n### queue\n#### ADDED\n##### REQ-Q-001 Retry limit\nVerified limit is 3.\n"));
  const b = r.deltaSnapshot(cap("## Delta\n### queue\n#### ADDED\n##### REQ-Q-001 Retry limit\nUnverified modified limit is 999.\n"));
  assert.notEqual(a, b);
});

test("R13：標題改變、MODIFIED 內文改變、REMOVED tombstone 改變，快照都不同", () => {
  const base = r.deltaSnapshot(cap("## Delta\n### queue\n#### MODIFIED\n##### REQ-Q-001 T\nbody\n"));
  assert.notEqual(base, r.deltaSnapshot(cap("## Delta\n### queue\n#### MODIFIED\n##### REQ-Q-001 T2\nbody\n")), "標題");
  assert.notEqual(base, r.deltaSnapshot(cap("## Delta\n### queue\n#### MODIFIED\n##### REQ-Q-001 T\nbody!\n")), "內文");
  assert.notEqual(r.deltaSnapshot(cap("## Delta\n### queue\n#### REMOVED\n- REQ-Q-001\n")), r.deltaSnapshot(cap("## Delta\n### queue\n#### REMOVED\n- REQ-Q-002\n")), "tombstone");
  assert.notEqual(r.deltaSnapshot(cap("## Delta\n### queue\n#### ADDED\n##### REQ-Q-001 T\nbody\n")), base, "ADDED 與 MODIFIED 不同");
});

test("R13：只有行尾 / 尾端空白的差異不改變快照（不產生誤報）", () => {
  const a = r.deltaSnapshot(cap("## Delta\n### queue\n#### ADDED\n##### REQ-Q-001 T\nbody\n"));
  const b = r.deltaSnapshot(cap("## Delta\r\n### queue\r\n#### ADDED\r\n##### REQ-Q-001 T\r\nbody\r\n\r\n"));
  assert.equal(a, b);
});

// ───────────────────────── R11：ID 邊界 ─────────────────────────

test("R11：change ID 只接受 NNN-name；路徑、分隔符、磁碟代號、絕對路徑、.. 一律拒絕", () => {
  for (const ok of ["001-a", "002-selective-install", "010-x1"]) assert.doesNotThrow(() => assertChangeId(ok));
  for (const bad of ["", "..", "../x", "001/../x", "001-a/b", "001-a\\b", "C:\\x", "C:x", "/abs/001-x", "\\\\server\\share", "001-A", "1-a", "001-", "001--a", "001-a b", "001-a\u0000"]) {
    assert.throws(() => assertChangeId(bad), SafetyError, JSON.stringify(bad));
  }
});

test("R11：capability ID 只接受小寫 kebab-case", () => {
  for (const ok of ["portal-home", "a", "tool-registry-2"]) assert.doesNotThrow(() => assertCapabilityId(ok));
  for (const bad of ["", "..", "../../../outside-project", "a/b", "a\\b", "C:\\x", "/abs", "Portal", "a_b", "a b", "-a", "a-"]) {
    assert.throws(() => assertCapabilityId(bad), SafetyError, JSON.stringify(bad));
  }
});
