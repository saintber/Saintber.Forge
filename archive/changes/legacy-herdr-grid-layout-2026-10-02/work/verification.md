# Verification Record — herdr-grid-import-2026-10-07

## Scope

- 本次工作：分類並歸檔使用者提供的九份 `herdr/` 檔案；更新現行路徑、手冊與導覽。
- 目標：Hub 開發工具；不建立 Tool project、不更改產品契約、不修改 grid 演算法、不採納原 OpenSpec delta。
- 適用治理：Hub 憲章 v1.0.0、POL-STRUCT、POL-DOC、POL-SPEC、POL-DOD、POL-TEST；依 ADR-0002 直接完成這項小型歸檔工作。

## Environment

- Runner：本機 Windows／PowerShell，2026-10-07。
- Runtime：Node.js v24.19.0。
- 基線：`ca75b24`；歸檔前 Git 只有 `?? herdr/`。

## Gate A — Automated

| 檢查 | 命令／方法 | 結果 |
|---|---|---|
| 還原相依 | 兩支 `.cjs` 只使用 Node 內建模組與相鄰腳本，無第三方套件、package manifest 或 lockfile，不需還原 | 通過，無待還原相依 |
| 語法 | `node --check tooling/herdr/grid.cjs`；`node --check tooling/herdr/grid-simulate.cjs` | 兩者 exit 0 |
| 既有離線模擬 | `node tooling/herdr/grid-simulate.cjs` | exit 0；2–12 個 pane 的 11 個序列結果全部 OK |
| 原始資料保存 | 依 `../inputs/source-manifest.json` 與 `../archive.md` 路徑對照核對 SHA-256 | 九份來源全部通過；八份位元組相同，`grid.cjs` 將新路徑反向替換回原路徑後雜湊相同 |
| 不同工作目錄 | 在 repo 以外的系統暫存目錄，以絕對路徑執行 `grid-simulate.cjs` | exit 0；同樣 11 個結果全部 OK，相鄰模組載入正常 |
| 現行文件連結 | 逐一解析本次九份新增／修改導覽、手冊與紀錄的相對 Markdown 連結並檢查目標 | 51 個連結全部存在；歷史原文不納入此檢查 |
| 舊路徑移除 | `rg -n 'tools/herdr/|openspec/changes/|openspec/specs/|spectra' tooling/herdr docs/developer-guide/herdr-grid.md` | 無匹配，exit 1（搜尋成功且零結果）；歷史原文不納入此檢查 |
| 差異格式 | `git diff --check` 與提交前 `git diff --cached --check` | 通過 |

SHA-256 清單記錄使用者交付時的原始位元組，包含換行格式；它用於這次匯入的保存核對，跨平台 checkout 改變換行後需先還原原換行格式再比較，不是程式行為驗證。

## Gate B — Manual

本次需求是分類與檔案歸檔，沒有要求變更或重新驗收 Herdr 互動。已人工審閱原 README、proposal、design、tasks、spec 與程式：原稿排除 npm 發行，程式只控制 pane 版面，歸入 `tooling/herdr/` 符合現有開發工具邊界。

沒有實際建立、搬動、排序或 resize pane。舊 tasks 的人工驗證陳述保留原貌，不能當成本次重測結果；本次 Done 僅指歸檔，不宣稱完整 Herdr 功能重新驗收通過。

## Docs Consistency

- 現行腳本與手冊改用 `tooling/herdr/`，README、tooling 索引、docs 導覽、worktree 指引與 archive 索引同步。
- 原始手冊、README 及五份 OpenSpec 文件留在封存目錄，不改寫歷史。
- 不依執行語言建立 `node-tools`，不依 pane 中可能執行 AI 而建立 AI project；未來產品化須再討論 Node.js／AI 工具集歸屬。
- 未把舊 delta 複製成 Hub 有效規格；未偏離已採納架構、放寬 Policy 或改變公開契約。

## Final Status

- Done：分類、歸檔、來源保存、必要驗證與文件同步完成；範圍僅限本次歸檔。
