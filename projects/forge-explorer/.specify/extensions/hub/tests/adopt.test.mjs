import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { adopt, AdoptError } from "../scripts/adopt.mjs";
import { makeWorkspace, write, git, commitAll } from "./helpers.mjs";

const TOOL = "projects/tool-a";
const SPEC = `${TOOL}/docs/specifications/cap-x/spec.md`;

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

### REQ-CX-002 Second
second body

## Change Log
| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-01-01 | 001-first | +REQ-CX-001, +REQ-CX-002 | init | archive/changes/001-first |
`;

function workPackage(root, change, { baseline, status = "verified", verified = true, delta, caps = "cap-x" }) {
  write(root, `${TOOL}/specs/${change}/spec.md`, `# Feature Specification: ${change}

**Status**: ${status}
**Baseline**: \`${baseline}\`
**Affected Capabilities**: \`${caps}\`

## Delta
${delta}
`);
  write(root, `${TOOL}/specs/${change}/verification.md`, `# Verification Record — ${change}

## Final Status
- ${verified ? "Done" : "Not Done"}
`);
}

const DELTA_ADD3 = `### ADDED
#### REQ-CX-003 Third
third body
`;

function setup() {
  const ws = makeWorkspace();
  write(ws, SPEC, EFFECTIVE);
  const base = commitAll(ws, "effective spec");
  return { ws, base, project: path.join(ws, TOOL) };
}

const staged = (ws) => git(ws, "diff", "--cached", "--name-only").trim();

test("驗收 4：adopt 後只有一份有效規格，Change Log 指向封存位置，歷史不遺失", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-add-third", { baseline: base, delta: DELTA_ADD3 });
  const r = adopt({ projectRoot: project, change: "002-add-third", date: "2026-10-06" });
  assert.equal(r.ok, true);
  const t = fs.readFileSync(path.join(ws, SPEC), "utf8");
  assert.match(t, /### REQ-CX-003 Third/);
  assert.match(t, /### REQ-CX-001 First/, "既有 requirement 保留");
  assert.match(t, /\| 2026-01-01 \| 001-first \|/, "歷史 Change Log 保留");
  assert.match(t, /\| 2026-10-06 \| 002-add-third \| \+REQ-CX-003 \|.*\| archive\/changes\/002-add-third \|/, "Change Log 指向封存位置");
  assert.match(t, /^last-adopted: 002-add-third$/m);
  const specs = fs.readdirSync(path.join(project, "docs", "specifications", "cap-x"));
  assert.deepEqual(specs, ["spec.md"], "同一 capability 只有一份有效規格");
  assert.equal(staged(ws), "", "不得自動 stage");
  assert.equal(git(ws, "rev-parse", "HEAD").trim(), base, "不得自動 commit");
  assert.ok(!fs.existsSync(path.join(project, ".specify", "tmp", "002-add-third")), "暫存區要清掉");
});

test("驗證未通過 → 拒絕，不修改有效規格", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3, verified: false });
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e instanceof AdoptError && e.code === "NOT_VERIFIED");
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
});

test("cancelled / superseded → 只能 archive，不能 adopt", () => {
  for (const status of ["cancelled", "superseded"]) {
    const { ws, base, project } = setup();
    workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3, status });
    assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "NOT_ADOPTABLE");
    assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
  }
});

test("驗收 5（並行）：另一個工作包已 adopt 並 commit → 後者被基線檢查攔下", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-a", { baseline: base, delta: DELTA_ADD3 });
  workPackage(ws, "003-b", { baseline: base, delta: "### ADDED\n#### REQ-CX-004 Fourth\nx\n" });
  adopt({ projectRoot: project, change: "002-a" });
  commitAll(ws, "adopt 002-a");
  const afterFirst = fs.readFileSync(path.join(ws, SPEC), "utf8");
  assert.throws(() => adopt({ projectRoot: project, change: "003-b" }), (e) => {
    assert.equal(e.code, "BASELINE_CONFLICT");
    assert.ok(e.details[0].kinds.includes("committed"));
    return true;
  });
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), afterFirst, "不覆蓋先 adopt 的結果");
});

test("驗收 5（staged）：目標規格有 staged 變更 → 攔下，不覆蓋", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  const edited = EFFECTIVE + "\nstaged edit\n";
  write(ws, SPEC, edited);
  git(ws, "add", SPEC);
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "BASELINE_CONFLICT" && e.details[0].kinds.includes("staged"));
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), edited);
});

test("驗收 5（未提交）：目標規格有未提交的修改 → 攔下，不覆蓋", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  const edited = EFFECTIVE + "\nlocal edit\n";
  write(ws, SPEC, edited);
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "BASELINE_CONFLICT" && e.details[0].kinds.includes("unstaged"));
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), edited);
});

test("驗收 5（新建）：目標有效規格是未追蹤的新檔 → 攔下", () => {
  const ws = makeWorkspace();
  const base = git(ws, "rev-parse", "HEAD").trim();
  const project = path.join(ws, TOOL);
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  write(ws, SPEC, EFFECTIVE); // 新建、未追蹤
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "BASELINE_CONFLICT" && e.details[0].kinds.includes("untracked"));
});

test("驗收 5：與目標 capability 無關的使用者變更不受影響，也不被清理", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  write(ws, "notes/mine.txt", "my unrelated work");
  write(ws, "docs/governance/policy/README.md", "# Hub policy\nmy edit\n");
  adopt({ projectRoot: project, change: "002-x" });
  assert.equal(fs.readFileSync(path.join(ws, "notes/mine.txt"), "utf8"), "my unrelated work");
  assert.equal(fs.readFileSync(path.join(ws, "docs/governance/policy/README.md"), "utf8"), "# Hub policy\nmy edit\n");
});

test("驗收 5a：套用中途失敗 → 只回復本次觸及的檔案，使用者修改保留，未 stage / commit", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  write(ws, "notes/mine.txt", "user work in progress");
  assert.throws(
    () => adopt({ projectRoot: project, change: "002-x", faultInjection: () => { throw new Error("disk full (injected)"); } }),
    (e) => e instanceof AdoptError && e.code === "APPLY_FAILED",
  );
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE, "被觸及的有效規格回復成原樣");
  assert.equal(fs.readFileSync(path.join(ws, "notes/mine.txt"), "utf8"), "user work in progress", "使用者修改保留");
  assert.equal(staged(ws), "");
  assert.equal(git(ws, "rev-parse", "HEAD").trim(), base);
  assert.ok(!fs.existsSync(path.join(project, ".specify", "tmp", "002-x")), "失敗後清掉暫存區，方便重試");
});

test("驗收 5a：新 capability 的第一次 adopt 失敗 → 新建的有效規格檔被移除", () => {
  const ws = makeWorkspace();
  const base = git(ws, "rev-parse", "HEAD").trim();
  const project = path.join(ws, TOOL);
  workPackage(ws, "002-new", { baseline: base, delta: DELTA_ADD3, caps: "cap-new" });
  assert.throws(() => adopt({ projectRoot: project, change: "002-new", faultInjection: () => { throw new Error("x"); } }), (e) => e.code === "APPLY_FAILED");
  assert.ok(!fs.existsSync(path.join(project, "docs/specifications/cap-new/spec.md")));
});

test("requirement ID：ADDED 已存在 → 拒絕", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: "### ADDED\n#### REQ-CX-001 Dup\nx\n" });
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "REQ_INVALID");
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
});

test("requirement ID：曾被移除的 ID 不得重用", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-rm", { baseline: base, delta: "### REMOVED\n- REQ-CX-002\n" });
  adopt({ projectRoot: project, change: "002-rm" });
  const after = commitAll(ws, "adopt 002-rm");
  assert.doesNotMatch(fs.readFileSync(path.join(ws, SPEC), "utf8"), /### REQ-CX-002/);
  workPackage(ws, "003-reuse", { baseline: after, delta: "### ADDED\n#### REQ-CX-002 Reused\nx\n" });
  assert.throws(() => adopt({ projectRoot: project, change: "003-reuse" }), (e) => e.code === "REQ_INVALID" && /不得重用/.test(e.details.join()));
});

test("requirement ID：MODIFIED 的 ID 必須存在；修改後內容被替換", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-bad", { baseline: base, delta: "### MODIFIED\n#### REQ-CX-099 Nope\nx\n" });
  assert.throws(() => adopt({ projectRoot: project, change: "002-bad" }), (e) => e.code === "REQ_INVALID");
  workPackage(ws, "003-mod", { baseline: base, delta: "### MODIFIED\n#### REQ-CX-001 First v2\nnew body\n" });
  adopt({ projectRoot: project, change: "003-mod" });
  const t = fs.readFileSync(path.join(ws, SPEC), "utf8");
  assert.match(t, /### REQ-CX-001 First v2\nnew body/);
  assert.doesNotMatch(t, /first body/);
});

test("暫存區有殘留 → 要求處理，不默默覆蓋", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  write(project, ".specify/tmp/002-x/leftover", "x");
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "TMP_EXISTS");
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
});

test("第一次基線檢查：有衝突時在建立暫存區之前就停止（不只靠套用前的再檢查）", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  write(ws, SPEC, EFFECTIVE + "\nlocal edit\n");
  let reachedSecondPhase = false;
  assert.throws(
    () => adopt({ projectRoot: project, change: "002-x", betweenChecks: () => { reachedSecondPhase = true; } }),
    (e) => e.code === "BASELINE_CONFLICT",
  );
  assert.equal(reachedSecondPhase, false, "第一次檢查就要攔下，不得進到暫存與再檢查階段");
  assert.ok(!fs.existsSync(path.join(project, ".specify", "tmp", "002-x")), "不得建立暫存區");
});

test("套用前再檢查：第一次檢查之後才被修改的目標 → 攔下，不寫入", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  const sneaky = EFFECTIVE + "\nedited between checks\n";
  assert.throws(
    () => adopt({ projectRoot: project, change: "002-x", betweenChecks: (targets) => fs.writeFileSync(targets[0], sneaky) }),
    (e) => e.code === "BASELINE_CONFLICT",
  );
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), sneaky, "不覆蓋在兩次檢查之間發生的修改");
  assert.ok(!fs.existsSync(path.join(project, ".specify", "tmp", "002-x")), "清掉暫存區");
});

test("成功時不 stage、不 commit：index 與 HEAD 都不變", () => {
  const { ws, base, project } = setup();
  workPackage(ws, "002-x", { baseline: base, delta: DELTA_ADD3 });
  adopt({ projectRoot: project, change: "002-x" });
  assert.equal(git(ws, "diff", "--cached", "--name-only").trim(), "", "index 必須是空的");
  assert.equal(git(ws, "rev-parse", "HEAD").trim(), base);
  assert.match(git(ws, "status", "--porcelain"), /^ M .*cap-x\/spec\.md$/m, "變更只留在工作目錄（未 staged）");
});

test("沒有 git → 明確報錯，不略過基線檢查", () => {
  const ws = makeWorkspace({ withGit: false });
  const project = path.join(ws, TOOL);
  write(ws, SPEC, EFFECTIVE);
  workPackage(ws, "002-x", { baseline: "abcdef1", delta: DELTA_ADD3 });
  assert.throws(() => adopt({ projectRoot: project, change: "002-x" }), (e) => e.code === "NO_REPO" || e.code === "NO_GIT");
  assert.equal(fs.readFileSync(path.join(ws, SPEC), "utf8"), EFFECTIVE);
});
