import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { run } from "../scripts/context.mjs";
import { ProjectError } from "../scripts/lib/project.mjs";
import { makeWorkspace, makeStandalone, snapshotTree, write } from "./helpers.mjs";

const norm = (p) => path.resolve(p);

test("workspace：從 Hub 根目錄指定專案 ID，解析到該專案並回報模式、讀取清單", () => {
  const ws = makeWorkspace();
  const r = run(["--project", "tool-a"], { cwd: ws, env: {} });
  assert.equal(r.mode, "workspace");
  assert.equal(r.projectId, "tool-a");
  assert.equal(norm(r.projectRoot), norm(path.join(ws, "projects", "tool-a")));
  assert.equal(norm(r.outputRoot), norm(path.join(ws, "projects", "tool-a", "specs")), "產出位置必須在專案內，不是 Hub");
  const kinds = r.read.map((x) => x.kind);
  assert.ok(kinds.includes("constitution"));
  assert.ok(kinds.includes("hub-constitution"), "workspace 模式要讀 Hub 憲章");
  assert.ok(kinds.includes("hub-policy-index"));
});

test("workspace：在專案目錄內執行（最近的 .specify/），解析到該專案而不是 Hub", () => {
  const ws = makeWorkspace();
  const r = run([], { cwd: path.join(ws, "projects", "tool-a", "docs"), env: {} });
  assert.equal(r.projectId, "tool-a");
  assert.equal(r.resolvedFrom, "nearest");
});

test("驗收 3：指定不存在的專案 → 報錯，且不建立任何檔案", () => {
  const ws = makeWorkspace();
  const before = snapshotTree(ws);
  assert.throws(() => run(["--project", "no-such"], { cwd: ws, env: {} }), (e) => e instanceof ProjectError && e.code === "PROJECT_NOT_REGISTERED");
  assert.deepEqual(snapshotTree(ws), before, "不得產生任何檔案");
});

test("不降級：SPECIFY_INIT_DIR 指向無效路徑 → 報錯，不退回 Hub", () => {
  const ws = makeWorkspace();
  assert.throws(
    () => run([], { cwd: ws, env: { SPECIFY_INIT_DIR: path.join(ws, "does-not-exist") } }),
    (e) => e instanceof ProjectError && e.code === "PROJECT_INVALID",
  );
});

test("不降級：SPECIFY_INIT_DIR 指向沒有 .specify/ 的目錄 → 報錯", () => {
  const ws = makeWorkspace();
  write(ws, "projects/plain/readme.md", "x");
  assert.throws(
    () => run([], { cwd: ws, env: { SPECIFY_INIT_DIR: path.join(ws, "projects", "plain") } }),
    (e) => e instanceof ProjectError && e.code === "PROJECT_INVALID",
  );
});

test("SPECIFY_INIT_DIR 指向有效專案 → 解析到該專案", () => {
  const ws = makeWorkspace();
  const r = run([], { cwd: ws, env: { SPECIFY_INIT_DIR: path.join(ws, "projects", "tool-a") } });
  assert.equal(r.projectId, "tool-a");
  assert.equal(r.resolvedFrom, "SPECIFY_INIT_DIR");
});

test("workspace 內有 .specify/ 但沒有登錄的專案 → 報錯（不偷偷當 standalone）", () => {
  const ws = makeWorkspace();
  write(ws, "projects/rogue/.specify/memory/constitution.md", "x");
  assert.throws(
    () => run([], { cwd: path.join(ws, "projects", "rogue"), env: {} }),
    (e) => e instanceof ProjectError && e.code === "PROJECT_NOT_REGISTERED",
  );
});

test("明確指定 --workspace 但路徑無效 → 報錯，不降級成 standalone", () => {
  const sa = makeStandalone();
  assert.throws(
    () => run(["--workspace", path.join(sa, "nope")], { cwd: sa, env: {} }),
    (e) => e instanceof ProjectError && e.code === "WORKSPACE_INVALID",
  );
});

test("standalone：沒有 workspace.json 時以 standalone 運作，不讀取任何父路徑", () => {
  const sa = makeStandalone();
  const r = run([], { cwd: sa, env: {} });
  assert.equal(r.mode, "standalone");
  assert.equal(r.workspaceRoot, null);
  const kinds = r.read.map((x) => x.kind);
  assert.ok(kinds.includes("constitution"));
  assert.ok(kinds.includes("inherited-policy"), "standalone 讀版本固定的 distribution Policy 快照");
  assert.ok(!kinds.includes("hub-constitution"), "standalone 不得讀 Hub 檔案");
  for (const x of r.read) {
    assert.ok(!x.path.startsWith(".."), `不得讀取父路徑：${x.path}`);
  }
});

test("編號不重用：同時掃描 specs/ 與 archive/changes/", () => {
  const ws = makeWorkspace();
  const tool = path.join(ws, "projects", "tool-a");
  fs.mkdirSync(path.join(tool, "specs", "001-live"), { recursive: true });
  fs.mkdirSync(path.join(tool, "archive", "changes", "007-old"), { recursive: true });
  const r = run(["--project", "tool-a"], { cwd: ws, env: {} });
  assert.equal(r.nextChange, "008", "封存的 007 也算，所以下一個是 008");
  assert.equal(r.existingChanges.length, 2);
});

test("context 是唯讀：成功執行也不建立或修改任何檔案", () => {
  const ws = makeWorkspace();
  const before = snapshotTree(ws);
  run(["--project", "tool-a"], { cwd: ws, env: {} });
  assert.deepEqual(snapshotTree(ws), before);
});
