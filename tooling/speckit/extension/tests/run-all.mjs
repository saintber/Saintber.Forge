#!/usr/bin/env node
// 執行 hub 擴充的全部測試。
// 不直接用 `node --test tests/`：在 Windows 上它會把目錄當成一個測試檔而失敗。
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith(".test.mjs")).map((f) => path.join(here, f));
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
