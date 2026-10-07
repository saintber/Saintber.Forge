// R10–R13 回歸測試：針對審閱探針（Codex）與安全層的行為。全部在系統暫存目錄的隔離 repo 內執行。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { adopt } from "../scripts/adopt.mjs";
import { archive } from "../scripts/archive.mjs";
import { resolveProject } from "../scripts/lib/project.mjs";
import { makeWorkspace, write, git, commitAll, writeWorkPackage, tmpDir } from "./helpers.mjs";

const TOOL = "projects/tool-a";
const SPEC = `${TOOL}/docs/specifications/cap-x/spec.md`;
const INDEX = `${TOOL}/docs/specifications/README.md`;

const EFFECTIVE = `---
capability: cap-x
owner: tool-a
status: active
last-adopted: 001-first
---

# Cap X

## Requirements

### REQ-CX-001 First
first body

\`\`\`md
### REQ-CX-009 Fenced（只是範例文字，不是 requirement）
example
\`\`\`

## Change Log
| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-01-01 | 001-first | +REQ-CX-001 | init | archive/changes/001-first |
`;

const ADD2 = "### ADDED\n#### REQ-CX-002 Second\nsecond body\n";

function setup({ index } = {}) {
  const ws = makeWorkspace();
  write(ws, SPEC, EFFECTIVE);
  if (index !== undefined) write(ws, INDEX, index);
  const base = commitAll(ws, "effective");
  return { ws, base, project: path.join(ws, TOOL) };
}
const wp = (ws, change, o) => writeWorkPackage(ws, TOOL, change, o);
const code = (c) => (e) => e.code === c;

// ── R10：adopt 之後內容被改動 ──
test("R10：adopt 後工作包的 Delta 內文被改動 → archive 拒絕（snapshot 不符，視為未採納）", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  adopt({ projectRoot: project, change: "002-x" });
  const f = path.join(project, "specs/002-x/spec.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("second body", "TAMPERED body"));
  assert.throws(() => archive({ projectRoot: project, change: "002-x" }), code("NOT_ADOPTED"));
  assert.ok(fs.existsSync(path.join(project, "specs/002-x")), "工作包不動");
});

test("R10：fence 內的 `### REQ-…` 不是 requirement → REMOVED 它被拒絕，且 fence 內容原樣保留", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, delta: "### REMOVED\n- REQ-CX-009\n" });
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }));
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
  // 正常新增後，fence 內容仍在
  wp(ws, "003-y", { baseline: base, delta: "### ADDED\n#### REQ-CX-003 Third\nbody\n" });
  adopt({ projectRoot: project, change: "003-y" });
  assert.match(fs.readFileSync(path.join(ws, SPEC), "utf8"), /### REQ-CX-009 Fenced/);
});

// ── R11：路徑與 ID 安全 ──
test("R11：change ID 含路徑穿越 → adopt 與 archive 都拒絕，不碰任何檔案", () => {
  const { ws, project } = setup();
  for (const bad of ["../escape", "..", "002/x", "002-X", "a\\b", ""]) {
    assert.throws(() => adopt({ projectRoot: project, change: bad }), (e) => ["INVALID_ID", "USAGE"].includes(e.code), `adopt ${bad}`);
    assert.throws(() => archive({ projectRoot: project, change: bad }), (e) => ["INVALID_ID", "USAGE"].includes(e.code), `archive ${bad}`);
  }
  assert.equal(git(ws, "status", "--porcelain").trim(), "");
});

test("R11：docs/intent/<change> 是指向專案外的 junction → archive 拒絕且不刪外部檔案", (t) => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  const outside = tmpDir("hubext-out-");
  write(outside, "keep.md", "外部檔案");
  fs.mkdirSync(path.join(project, "docs/intent"), { recursive: true });
  try {
    fs.symlinkSync(outside, path.join(project, "docs/intent/002-x"), "junction");
  } catch (e) {
    return t.skip(`無法建立 junction/symlink：${e.code}`);
  }
  assert.throws(() => archive({ projectRoot: project, change: "002-x", status: "cancelled" }), code("UNSAFE_PATH"));
  assert.ok(fs.existsSync(path.join(outside, "keep.md")), "外部檔案完好");
  assert.ok(fs.existsSync(path.join(project, "specs/002-x/spec.md")), "工作包不動");
});

test("R11：workspace.json 登錄的專案路徑跑出 workspace → 拒絕", () => {
  const ws = makeWorkspace({ withGit: false });
  const outside = tmpDir("hubext-out-");
  write(outside, ".specify/memory/constitution.md", "x");
  const rel = path.relative(ws, outside).split(path.sep).join("/");
  const reg = JSON.parse(fs.readFileSync(path.join(ws, "workspace.json"), "utf8"));
  reg.projects.push({ id: "evil", path: rel, status: "active" });
  fs.writeFileSync(path.join(ws, "workspace.json"), JSON.stringify(reg));
  assert.throws(() => resolveProject({ project: "evil", workspace: ws, cwd: ws, env: {} }));
});

// ── R11：archive 重試與部分失敗 ──
function archivedThenSourceBack() {
  const s = setup();
  wp(s.ws, "002-x", { baseline: s.base, delta: ADD2 });
  write(s.ws, `${TOOL}/docs/intent/002-x/intent.md`, "# intent\n");
  adopt({ projectRoot: s.project, change: "002-x" });
  archive({ projectRoot: s.project, change: "002-x" });
  return s;
}

test("R11：封存完成後來源又出現 → 不重複封存、不默默刪除（SOURCE_NOT_REMOVED）", () => {
  const { ws, base, project } = archivedThenSourceBack();
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  write(ws, `${TOOL}/docs/intent/002-x/intent.md`, "# intent\n");
  const a = fs.readFileSync(path.join(project, "archive/changes/002-x/work/spec.md"), "utf8");
  fs.writeFileSync(path.join(project, "specs/002-x/spec.md"), a); // 與封存相同
  assert.throws(() => archive({ projectRoot: project, change: "002-x" }), (e) => ["SOURCE_NOT_REMOVED", "TARGET_DIFFERS"].includes(e.code));
  assert.ok(fs.existsSync(path.join(project, "specs/002-x/spec.md")), "來源不被默默刪除");
});

test("R11：重試時封存的 inputs 與來源不同 → TARGET_DIFFERS，不覆蓋", () => {
  const { ws, base, project } = archivedThenSourceBack();
  const aw = fs.readFileSync(path.join(project, "archive/changes/002-x/work/spec.md"), "utf8");
  write(ws, `${TOOL}/specs/002-x/spec.md`, aw);
  write(ws, `${TOOL}/docs/intent/002-x/intent.md`, "# 不同的 intent\n");
  assert.throws(() => archive({ projectRoot: project, change: "002-x" }), code("TARGET_DIFFERS"));
  assert.equal(fs.readFileSync(path.join(project, "archive/changes/002-x/inputs/intent.md"), "utf8"), "# intent\n");
});

test("R11：feature.json 指向 specs/002-xyz 時，封存 002-x 不得清掉它（精確比對）", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  write(project, ".specify/feature.json", JSON.stringify({ feature_directory: "specs/002-xyz" }));
  const r = archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  assert.equal(r.clearedContext, false);
  assert.ok(fs.existsSync(path.join(project, ".specify/feature.json")));
});

test("R11：寫入封存之後、刪除之前來源被修改 → SOURCE_CHANGED，修改保留、封存移除", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  const src = path.join(project, "specs/002-x/spec.md");
  assert.throws(
    () => archive({ projectRoot: project, change: "002-x", status: "cancelled", faultInjection: (p) => { if (p === "after-copy") fs.appendFileSync(src, "\n使用者在封存期間的新修改\n"); } }),
    code("SOURCE_CHANGED"),
  );
  assert.match(fs.readFileSync(src, "utf8"), /使用者在封存期間的新修改/);
  assert.ok(!fs.existsSync(path.join(project, "archive/changes/002-x")), "本次建立的封存被移除");
  assert.ok(!fs.existsSync(path.join(project, ".specify/tmp/archive-002-x")), "暫存區清掉");
});

test("R11：部分刪除後失敗 → 已刪除的來源檔案從快照還原", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  write(ws, `${TOOL}/specs/002-x/plan.md`, "# plan\n");
  write(ws, `${TOOL}/specs/002-x/tasks.md`, "# tasks\n");
  let n = 0;
  assert.throws(
    () => archive({ projectRoot: project, change: "002-x", status: "cancelled", faultInjection: (p) => { if (p === "after-remove-file" && ++n === 2) throw new Error("boom"); } }),
    code("APPLY_FAILED"),
  );
  for (const f of ["spec.md", "plan.md", "tasks.md", "verification.md"]) {
    assert.ok(fs.existsSync(path.join(project, "specs/002-x", f)), `${f} 已還原`);
  }
  assert.ok(!fs.existsSync(path.join(project, "archive/changes/002-x")));
});

test("R11：活動上下文無法清除／解析 → 封存成功但回報 warning，不假裝成功", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  write(project, ".specify/feature.json", "{ not json");
  const r = archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  assert.equal(r.ok, true);
  assert.equal(r.clearedContext, false);
  assert.match(r.warning, /feature\.json/);
});

// ── R12：多 capability、Owner、索引 ──
const MULTI = [
  "### cap-x", "#### ADDED", "##### REQ-CX-002 Second", "second body", "",
  "### cap-y", "#### ADDED", "##### REQ-CY-001 Y first", "y body", "",
].join("\n");

test("R12：多 capability 的 Delta → 兩個有效規格都更新；缺 Owner 的新 capability 被拒絕且不寫任何檔", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-multi", { baseline: base, caps: "cap-x, cap-y", deltaFull: MULTI });
  assert.throws(() => adopt({ projectRoot: project, change: "002-multi" }), (e) => e.code === "REQ_INVALID" && /owner/i.test(JSON.stringify(e.details)));
  assert.ok(!fs.existsSync(path.join(project, "docs/specifications/cap-y")), "沒有寫出半套");
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);

  wp(ws, "002-multi", { baseline: base, caps: "cap-x, cap-y", owner: "tool-a", deltaFull: MULTI });
  adopt({ projectRoot: project, change: "002-multi", date: "2026-10-07" });
  assert.match(fs.readFileSync(path.join(ws, SPEC), "utf8"), /REQ-CX-002 Second/);
  const y = fs.readFileSync(path.join(project, "docs/specifications/cap-y/spec.md"), "utf8");
  assert.match(y, /REQ-CY-001 Y first/);
  assert.match(y, /^owner: tool-a$/m);
  const idx = fs.readFileSync(path.join(ws, INDEX), "utf8");
  assert.match(idx, /cap-y/, "索引新增該 capability");
});

test("R12：Affected Capabilities 與 Delta 的 capability 不一致 → 拒絕", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, caps: "cap-x, cap-z", delta: ADD2 });
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), code("CAPABILITY_MISMATCH"));
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
});

test("R12：索引只更新該 capability 的那一列，使用者的其他內容與列原樣保留", () => {
  const index = [
    "# 有效規格索引", "", "使用者寫的說明：請勿刪。", "",
    "| capability | owner | 一句話說明 | 最後採納 | 規格 |",
    "|---|---|---|---|---|",
    "| `cap-x` | tool-a | 手寫的說明 | `001-first` | [spec.md](cap-x/spec.md) |",
    "| `cap-other` | tool-a | 別人的 | `000-old` | [spec.md](cap-other/spec.md) |",
    "", "## 使用者另一章", "不要動", "",
  ].join("\n");
  const { ws, base, project } = setup({ index });
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  adopt({ projectRoot: project, change: "002-x" });
  const out = fs.readFileSync(path.join(ws, INDEX), "utf8");
  assert.match(out, /使用者寫的說明：請勿刪。/);
  assert.match(out, /\| `cap-other` \| tool-a \| 別人的 \| `000-old` \|/);
  assert.match(out, /不要動/);
  assert.match(out, /\| `cap-x` \| tool-a \| 手寫的說明 \| `002-x` \|/);
});

test("R12：索引有未提交的使用者修改時，仍被基線檢查保護（不覆蓋）", () => {
  const { ws, base, project } = setup({ index: "# index\n" });
  fs.appendFileSync(path.join(ws, INDEX), "\n使用者未提交的筆記\n");
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  let threw = false;
  try { adopt({ projectRoot: project, change: "002-x" }); } catch { threw = true; }
  const out = fs.readFileSync(path.join(ws, INDEX), "utf8");
  assert.match(out, /使用者未提交的筆記/, "使用者的修改不得遺失");
  if (threw) assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE, "拒絕時不得寫出半套");
});

// ── R13：重試時驗證完整快照（manifest）──
function cancelledArchive() {
  const s = setup();
  wp(s.ws, "002-retry", { baseline: s.base, status: "cancelled", delta: ADD2 });
  write(s.ws, `${TOOL}/docs/intent/002-retry/intent.md`, "# intent\n");
  write(s.ws, `${TOOL}/specs/002-retry/plan.md`, "# plan\n");
  const r = archive({ projectRoot: s.project, change: "002-retry", status: "cancelled", date: "2026-10-07" });
  assert.equal(r.ok, true);
  return { ...s, dir: path.join(s.project, "archive/changes/002-retry") };
}
const retry = (p) => archive({ projectRoot: p, change: "002-retry", status: "cancelled", date: "2026-10-07" });

test("R13：完整封存重試 → alreadyArchived（基準）", () => {
  const { project } = cancelledArchive();
  assert.equal(retry(project).alreadyArchived, true);
});

test("R13：封存後 inputs/intent.md 被刪 → 重試拒絕，不宣稱已完成（Codex 探針）", () => {
  const { project, dir } = cancelledArchive();
  fs.rmSync(path.join(dir, "inputs/intent.md"));
  assert.throws(() => retry(project), (e) => e.code === "TARGET_INCOMPLETE" && /缺檔：inputs\/intent\.md/.test(e.message));
});

test("R13：work/ 的非 spec 檔被刪 → 拒絕", () => {
  const { project, dir } = cancelledArchive();
  fs.rmSync(path.join(dir, "work/plan.md"));
  assert.throws(() => retry(project), (e) => e.code === "TARGET_INCOMPLETE");
});

test("R13：封存內多出檔案 → 拒絕", () => {
  const { project, dir } = cancelledArchive();
  fs.writeFileSync(path.join(dir, "work/extra.md"), "x");
  assert.throws(() => retry(project), (e) => e.code === "TARGET_INCOMPLETE" && /多出/.test(e.message));
});

test("R13：封存內檔案內容被改 → 拒絕", () => {
  const { project, dir } = cancelledArchive();
  fs.appendFileSync(path.join(dir, "work/spec.md"), "\n竄改\n");
  assert.throws(() => retry(project), (e) => e.code === "TARGET_INCOMPLETE" && /內容被改/.test(e.message));
});

test("R13：archive.md 的 metadata（baseline / 日期）被改 → 拒絕", () => {
  const { project, dir } = cancelledArchive();
  const f = path.join(dir, "archive.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("2026-10-07", "1999-01-01"));
  assert.throws(() => retry(project), (e) => e.code === "TARGET_INCOMPLETE" && /metadata/.test(e.message));
});

test("R13：沒有 Manifest 的封存（手寫或舊格式）→ 不視為已完成", () => {
  const { project, dir } = cancelledArchive();
  const f = path.join(dir, "archive.md");
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").split("## Manifest")[0]);
  assert.throws(() => retry(project), code("TARGET_INCOMPLETE"));
});

// ── R10/R13：fence 內的 ## Requirements 不得成為插入點 ──
test("R10：有效規格只有 code 範例內的 `## Requirements` → ADDED 不得插進 code block，也不得空採納", () => {
  const spec = "---\ncapability: cap-q\nowner: tool-a\nstatus: active\n---\n\n# Cap Q\n\n範例：\n\n```md\n## Requirements\n\n## Change Log\n```\n";
  const ws = makeWorkspace();
  write(ws, `${TOOL}/docs/specifications/cap-q/spec.md`, spec);
  const base = commitAll(ws, "q");
  const project = path.join(ws, TOOL);
  wp(ws, "002-q", { baseline: base, caps: "cap-q", delta: "### ADDED\n#### REQ-Q-001 First\nbody\n" });
  adopt({ projectRoot: project, change: "002-q" });
  const out = fs.readFileSync(path.join(project, "docs/specifications/cap-q/spec.md"), "utf8");
  const lines = out.split("\n");
  const fenceEnd = lines.lastIndexOf("```");
  const reqAt = lines.findIndex((l) => l.startsWith("### REQ-Q-001"));
  assert.ok(reqAt > fenceEnd, "REQ 在 code block 之外");
  assert.match(out, /^## Requirements$/m);
  assert.match(out, /```md\n## Requirements\n\n## Change Log\n```/, "範例 code block 原樣保留");
});

// ── 舊五欄 Change Log 的升級 ──
test("Change Log：舊五欄表 → 表頭與分隔列升級為六欄，舊資料列與非表格文字保留", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  adopt({ projectRoot: project, change: "002-x", date: "2026-10-07" });
  const t = fs.readFileSync(path.join(ws, SPEC), "utf8");
  assert.match(t, /\| Date \| Change \| Requirements \| Summary \| Archive \| Snapshot \|/);
  assert.match(t, /\|---\|---\|---\|---\|---\|---\|/);
  const rows = t.split("\n").filter((l) => /^\| 20\d\d-/.test(l));
  assert.equal(rows.length, 2);
  for (const r of rows) assert.equal(r.split("|").length - 2, 6, `每列六欄：${r}`);
  assert.match(t, /\| 2026-01-01 \| 001-first \| \+REQ-CX-001 \| init \| archive\/changes\/001-first \|/);
  assert.match(t, /首段說明文字不動|first body/);
});

// ── R13：回復不覆蓋並行新增；封存身份驗證 ──
test("R13：回復時來源位置被外部重建為新內容 → 保留新內容、保留暫存快照、ROLLBACK_INCOMPLETE（Codex 探針）", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  write(ws, `${TOOL}/specs/002-x/plan.md`, "# plan\n");
  // listFiles 依字母排序：plan.md 先被刪 → 在它被刪之後重建它，再於下一個檔案之後失敗
  const specFile = path.join(project, "specs/002-x/plan.md");
  let n = 0;
  assert.throws(
    () => archive({ projectRoot: project, change: "002-x", status: "cancelled", faultInjection: (p) => {
      if (p !== "after-remove-file") return;
      n++;
      if (n === 1) fs.writeFileSync(specFile, "NEW USER CONTENT"); // 剛刪掉的檔案被使用者重建
      if (n === 2) throw new Error("boom");
    } }),
    code("ROLLBACK_INCOMPLETE"),
  );
  assert.equal(fs.readFileSync(specFile, "utf8"), "NEW USER CONTENT", "新內容不得被舊快照覆蓋");
  assert.ok(fs.existsSync(path.join(project, ".specify/tmp/archive-002-x/work/spec.md")), "完整快照保留供手動還原");
});

test("R13：把合法封存複製成另一個 change 的目錄 → 以該 change 重試被拒絕（身份不符）", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-retry", { baseline: base, status: "cancelled", delta: ADD2 });
  archive({ projectRoot: project, change: "002-retry", status: "cancelled", date: "2026-10-07" });
  fs.cpSync(path.join(project, "archive/changes/002-retry"), path.join(project, "archive/changes/003-other"), { recursive: true });
  assert.throws(
    () => archive({ projectRoot: project, change: "003-other", status: "cancelled" }),
    (e) => e.code === "TARGET_INCOMPLETE" && /不是 003-other/.test(e.message),
  );
});

test("R13：寫入後的封存驗證不過 → 停止刪除來源，來源完好、封存被移除", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, status: "cancelled", delta: ADD2 });
  const target = path.join(project, "archive/changes/002-x");
  assert.throws(
    () => archive({ projectRoot: project, change: "002-x", status: "cancelled", faultInjection: (p) => {
      if (p === "after-copy") fs.rmSync(path.join(target, "work/verification.md")); // 寫入後封存缺檔
    } }),
    (e) => ["VERIFY_FAILED", "APPLY_FAILED"].includes(e.code),
  );
  assert.ok(fs.existsSync(path.join(project, "specs/002-x/spec.md")), "來源不得被刪");
  assert.ok(!fs.existsSync(target), "不留下無法重試的封存");
});

// ── adopt 回復：不覆蓋並行修改，且保留恢復資料 ──
test("adopt 回復：失敗時目標已被外部改成新內容 → 保留新內容、ROLLBACK_INCOMPLETE、暫存區保留 before/after", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-x", { baseline: base, delta: ADD2 });
  const specFile = path.join(ws, SPEC);
  assert.throws(
    () => adopt({ projectRoot: project, change: "002-x", faultInjection: () => {
      fs.writeFileSync(specFile, "CONCURRENT USER EDIT"); // 本次寫入後，使用者又改了它
      throw new Error("boom");
    } }),
    code("ROLLBACK_INCOMPLETE"),
  );
  assert.equal(fs.readFileSync(specFile, "utf8"), "CONCURRENT USER EDIT", "使用者的新內容不得被覆蓋");
  const tmp = path.join(project, ".specify/tmp/002-x");
  assert.ok(fs.readdirSync(tmp).some((f) => f.endsWith(".before")), "保留原內容");
  assert.ok(fs.readdirSync(tmp).some((f) => f.endsWith(".after")), "保留本次寫入內容");
});

test("adopt 回復：新建檔案失敗後被使用者重建為不同內容 → 不刪除", () => {
  const { ws, base, project } = setup();
  wp(ws, "002-new", { baseline: base, caps: "cap-new", owner: "tool-a", delta: "### ADDED\n#### REQ-N-001 N\nbody\n" });
  const f = path.join(project, "docs/specifications/cap-new/spec.md");
  assert.throws(
    () => adopt({ projectRoot: project, change: "002-new", faultInjection: (rel) => {
      if (rel.endsWith("cap-new/spec.md")) { fs.writeFileSync(f, "USER OWN FILE"); throw new Error("boom"); }
    } }),
    code("ROLLBACK_INCOMPLETE"),
  );
  assert.equal(fs.readFileSync(f, "utf8"), "USER OWN FILE");
});
