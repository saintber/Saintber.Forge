#!/usr/bin/env node
// 執行 hub 擴充的測試。依 POL-TEST-001 R2：測試類型必須能從**命名**辨識。
//
//   *.unit.test.mjs         單元測試：只測純函式，**不得**使用檔案系統、git、網路或子程序（R4）。
//                           本 runner 會**檢查**這一點：unit 測試檔若 import node:fs / node:child_process
//                           或 helpers.mjs，直接判為違規。
//   *.integration.test.mjs  整合測試：使用暫存檔案系統與 git repo（隔離於系統暫存目錄，絕不碰本 repo）。
//
// 用法：node tests/run-all.mjs [unit|integration|all]   （預設 all）
//
// 不直接用 `node --test tests/`：在 Windows 上它會把目錄當成一個測試檔而失敗。
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] ?? "all";
if (!["unit", "integration", "all"].includes(which)) {
  console.error("用法：node tests/run-all.mjs [unit|integration|all]");
  process.exit(2);
}

const all = readdirSync(here).filter((f) => f.endsWith(".test.mjs"));
const unit = all.filter((f) => f.endsWith(".unit.test.mjs"));
const integration = all.filter((f) => f.endsWith(".integration.test.mjs"));
const unnamed = all.filter((f) => !unit.includes(f) && !integration.includes(f));

if (unnamed.length) {
  console.error(`違反 POL-TEST-001 R2：測試檔名沒有標明類型（*.unit.test.mjs 或 *.integration.test.mjs）：\n  ${unnamed.join("\n  ")}`);
  process.exit(1);
}

// R4：單元測試不得依賴檔案系統、git、子程序。
const FORBIDDEN = [/from\s+["']node:fs["']/, /from\s+["']node:child_process["']/, /from\s+["']\.\/helpers\.mjs["']/, /require\(["']fs["']\)/];
const violations = [];
for (const f of unit) {
  const src = readFileSync(path.join(here, f), "utf8");
  for (const re of FORBIDDEN) if (re.test(src)) violations.push(`${f}：${re}`);
}
if (violations.length) {
  console.error(`違反 POL-TEST-001 R4：單元測試使用了檔案系統 / 子程序 / helpers：\n  ${violations.join("\n  ")}`);
  process.exit(1);
}

const pick = which === "unit" ? unit : which === "integration" ? integration : [...unit, ...integration];
if (!pick.length) {
  console.error(`沒有 ${which} 測試`);
  process.exit(1);
}
console.log(`執行 ${which}：單元 ${which === "integration" ? 0 : unit.length} 個檔案、整合 ${which === "unit" ? 0 : integration.length} 個檔案`);
const r = spawnSync(process.execPath, ["--test", ...pick.map((f) => path.join(here, f))], { stdio: "inherit" });
process.exit(r.status ?? 1);
