import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { archive, ArchiveError } from "../scripts/archive.mjs";
import { adopt } from "../scripts/adopt.mjs";
import { makeWorkspace, write, git, commitAll } from "./helpers.mjs";

const TOOL = "projects/tool-a";
const SPEC = `${TOOL}/docs/specifications/cap-x/spec.md`;
const EFFECTIVE = `---
capability: cap-x
status: active
---

# Cap X

## Requirements

### REQ-CX-001 First
body

## Change Log
| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-01-01 | 001-first | +REQ-CX-001 | init | archive/changes/001-first |
`;

function setup(status = "verified") {
  const ws = makeWorkspace();
  write(ws, SPEC, EFFECTIVE);
  const base = commitAll(ws, "effective");
  const project = path.join(ws, TOOL);
  write(ws, `${TOOL}/specs/002-x/spec.md`, `# Feature Specification: 002-x\n\n**Status**: ${status}\n**Baseline**: \`${base}\`\n**Affected Capabilities**: \`cap-x\`\n\n## Delta\n### ADDED\n#### REQ-CX-002 Second\nx\n`);
  write(ws, `${TOOL}/specs/002-x/verification.md`, "# V\n\n## Final Status\n- Done\n");
  write(ws, `${TOOL}/specs/002-x/plan.md`, "# plan\n");
  write(ws, `${TOOL}/docs/intent/002-x/intent.md`, "# intent\n");
  return { ws, base, project };
}

test("adopted：先 adopt 後 archive → 結構正確、來源移除、archive.md 不記錄自己的 commit", () => {
  const { ws, base, project } = setup();
  adopt({ projectRoot: project, change: "002-x" });
  const r = archive({ projectRoot: project, change: "002-x", date: "2026-10-06" });
  assert.equal(r.ok, true);
  const a = path.join(project, "archive", "changes", "002-x");
  assert.ok(fs.existsSync(path.join(a, "work", "spec.md")));
  assert.ok(fs.existsSync(path.join(a, "work", "plan.md")));
  assert.ok(fs.existsSync(path.join(a, "inputs", "intent.md")));
  assert.ok(!fs.existsSync(path.join(project, "specs", "002-x")), "來源工作包移除");
  assert.ok(!fs.existsSync(path.join(project, "docs", "intent", "002-x")), "來源輸入移除");
  const md = fs.readFileSync(path.join(a, "archive.md"), "utf8");
  assert.match(md, /`adopted`/);
  assert.match(md, new RegExp(base), "記錄 baseline-commit");
  assert.doesNotMatch(md, /adopt[^\n]*commit[^\n]*[0-9a-f]{40}/i, "不得記錄 adopt 所在的 commit");
  assert.equal(git(ws, "diff", "--cached", "--name-only").trim(), "", "不得 stage");
  assert.equal(git(ws, "rev-parse", "HEAD").trim(), base, "不得 commit");
});

test("adopted 但尚未 adopt → 拒絕", () => {
  const { project } = setup();
  assert.throws(() => archive({ projectRoot: project, change: "002-x" }), (e) => e instanceof ArchiveError && e.code === "NOT_ADOPTED");
  assert.ok(fs.existsSync(path.join(project, "specs", "002-x")), "工作包不動");
});

test("cancelled / superseded：只封存，不 adopt，不修改有效規格", () => {
  for (const status of ["cancelled", "superseded"]) {
    const { ws, project } = setup(status);
    const r = archive({ projectRoot: project, change: "002-x", status });
    assert.equal(r.status, status);
    assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE, "有效規格不變");
    assert.match(fs.readFileSync(path.join(project, "archive/changes/002-x/archive.md"), "utf8"), new RegExp("`" + status + "`"));
  }
});

test("已 adopt 的變更不能以 cancelled 封存", () => {
  const { project } = setup();
  adopt({ projectRoot: project, change: "002-x" });
  assert.throws(() => archive({ projectRoot: project, change: "002-x", status: "cancelled" }), (e) => e.code === "STATUS_CONFLICT");
});

test("可重試：重複執行 → 視為已完成，不報錯、不重複", () => {
  const { project } = setup("cancelled");
  archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  const before = fs.readFileSync(path.join(project, "archive/changes/002-x/archive.md"), "utf8");
  const r = archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  assert.equal(r.alreadyArchived, true);
  assert.equal(fs.readFileSync(path.join(project, "archive/changes/002-x/archive.md"), "utf8"), before);
});

test("不覆蓋：目標已存在且內容不同 → 報錯，兩邊都不動", () => {
  const { project } = setup("cancelled");
  write(project, "archive/changes/002-x/work/spec.md", "DIFFERENT EXISTING ARCHIVE");
  assert.throws(() => archive({ projectRoot: project, change: "002-x", status: "cancelled" }), (e) => e.code === "TARGET_DIFFERS");
  assert.equal(fs.readFileSync(path.join(project, "archive/changes/002-x/work/spec.md"), "utf8"), "DIFFERENT EXISTING ARCHIVE");
  assert.ok(fs.existsSync(path.join(project, "specs/002-x/spec.md")), "工作包不動");
});

test("中途失敗 → 移除本次建立的封存，原工作包與輸入不動", () => {
  const { project } = setup("cancelled");
  assert.throws(
    () => archive({ projectRoot: project, change: "002-x", status: "cancelled", faultInjection: () => { throw new Error("injected"); } }),
    (e) => e.code === "APPLY_FAILED",
  );
  assert.ok(!fs.existsSync(path.join(project, "archive/changes/002-x")), "移除本次建立的封存");
  assert.ok(fs.existsSync(path.join(project, "specs/002-x/spec.md")), "原工作包還在");
  assert.ok(fs.existsSync(path.join(project, "docs/intent/002-x/intent.md")), "原輸入還在");
  assert.ok(!fs.existsSync(path.join(project, ".specify/tmp/archive-002-x")), "清掉暫存區");
});

test("清除活動上下文：.specify/feature.json 指向本工作包時移除", () => {
  const { project } = setup("cancelled");
  write(project, ".specify/feature.json", JSON.stringify({ feature_directory: "specs/002-x" }));
  const r = archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  assert.equal(r.clearedContext, true);
  assert.ok(!fs.existsSync(path.join(project, ".specify/feature.json")));
});

test("活動上下文指向其他工作包時不動它", () => {
  const { project } = setup("cancelled");
  write(project, ".specify/feature.json", JSON.stringify({ feature_directory: "specs/009-other" }));
  archive({ projectRoot: project, change: "002-x", status: "cancelled" });
  assert.ok(fs.existsSync(path.join(project, ".specify/feature.json")));
});
