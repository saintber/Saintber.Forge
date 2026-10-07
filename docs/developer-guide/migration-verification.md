# 遷移交付驗證

- 日期：2026-10-07；驗證者：Codex；環境：Windows、Node v24.19.0、.NET SDK 10.0.302、Spec Kit 1.1.0。
- 範圍：[ADR-0002](../architecture/decisions/0002-migration-delivery-scope.md) 的目錄遷移與已開始工作的必要驗證，不是完整前景功能驗收。
- 狀態：**本次遷移交付驗證完成**；測試、重新安裝、目錄、引用與實際 worktree 檢查通過。

## 已執行的必要檢查

| 檢查 | 命令或方法 | 結果 |
|---|---|---|
| 擴充修正版 | `node tooling/speckit/extension/tests/run-all.mjs all` | 88 通過、0 失敗、0 略過；單元 20、整合 68 |
| Tool 建置 | 在 Tool 執行 `dotnet build Saintber.Forge.sln --no-restore` | 0 警告、0 錯誤 |
| Tool 測試入口 | `dotnet test tests/Saintber.Forge.BlazorServer.UnitTests --no-build --no-restore` | 1 通過；空方法，非 Portal 行為證據 |
| Hub 擴充安裝 | `node tooling/speckit/install.mjs --project-dir .` | Claude／Codex 各 3/3 技能；預設還原；modified 0、missing 0 |
| Tool 擴充安裝 | `node tooling/speckit/install.mjs --project-dir projects/forge-explorer` | 同上 |
| 目錄、安裝內容、追蹤與引用 | 最後核對結果見下方 | 24 個必要目錄、最終 54 份本輪 Markdown 的 148 個本機連結、16 個 ignore 情境均符合 |
| 提交後 worktree | 從 `f3541a8` 建立自己的暫存 detached worktree，核對目錄與專案解析 | PASS；Hub／Tool 解析到各自 worktree 路徑，輸出位置正確；Git root 正確，工作目錄乾淨 |

擴充測試在暫存 Git fixture 中執行，沒有在本 repo 建立測試 feature、切換 branch 或由擴充自動提交。CLI 安裝副本以現有安裝器產生，沒有手改核心產生檔案。

本輪測試完整輸出在 `%TEMP%/saintber-review/migration-extension-tests.txt`。本文件保存命令、結果與限制，worktree 不依賴該暫存紀錄存在。

## 限制與保留工作

- 不把目前 88 項腳本測試擴張成兩代理原生流程或 adopt／archive 的完整代理驗收。已有 S2／S3／SA 證據及限制見 [001 驗證](../../specs/001-stage1-speckit-extension/verification.md)。
- 001 整個工作包 Not Done，未採納／封存。G-PC、G-NUM、格式確認等完整擴充事項保留為後續討論，不阻擋遷移。
- 沒有新增 Portal 行為、未執行 Playwright、真實 Identity 登入、Token 過期或資料庫驗收。
- 沒有驗證 Linux、standalone 治理內化與完整遷出，也沒有原子交易或崩潰復原保證。
- 未實作 saintber CLI、bootstrap、工具入口、Shared 套件或發佈腳本；保留的位置不是可執行功能。

## 最後核對

Codex 已在本次工作目錄客觀核對：

- 24 個必要目錄全部存在；新增的骨架檔案可以追蹤。
- 最後以 `9b5e4f3` 起的本輪改動核對，54 份 Markdown 的 148 個本機連結沒有缺檔（不包含唯讀歷史中的舊引用）。先前暫存前的檢查是 52 份／140 連結，屬不同時點；當時 fence 也均成對。
- 擴充原始碼 20 檔與 Hub／Tool 安裝位置逐檔內容相同，沒有額外舊測試或測試 helper。
- 16 個代表 ignore 情境全部符合，包含根與 Tool 的 `.specify/tmp/`，以及新的 src／tests／packages／release／範本占位檔可追蹤。
- `b5c7239` 的 51 個 .NET 檔案全部存在於 Tool；50 個 Git blob 相同，唯一不同仍是整合測試 README 的三處路徑調整。原始碼和 solution 未改。

最後檢查輸出在 `%TEMP%/saintber-review/migration-delivery-check.json`。

## 實際 worktree 與提交基準

- `cee7dd1`：保存擴充內容安全修正、回歸與上游 CLI 重新安裝結果；工作包仍未採納。
- `f3541a8`：保存完整目錄骨架、文件、範本與補建規格證據更正。
- 從 `f3541a8` 實際建立暫存 detached worktree，確認 `.git` 是 worktree 的檔案形式；擴充 Git 查詢仍解析到該工作目錄根，不會回到主要 worktree。
- Hub context 解析 workspace／hub，Tool context 解析 workspace／forge-explorer；兩者根目錄與 `specs/` 輸出位置均在新 worktree，必要目錄完整、context 後無新檔案、狀態乾淨。
- 探針第一次直接比較 Windows 的反斜線路徑與 Git 輸出的斜線字串而失敗；統一路徑表示後 PASS，沒有修改專案程式來配合測試。
- 結果在 `%TEMP%/saintber-review/worktree-smoke-result.json`；暫存 worktree 驗證後移除，沒有動其他 worktree。

本文件與繼承基線的最後同步是交付證據整理，不改變已測試的骨架與程式。主要 worktree 在提交後保持乾淨；不 push、不開 PR。

Claude 於 2026-10-07 最後唯讀核對遷移狀態、並行開發與本文件，確認與 ADR-0002 的範圍一致，同意主要遷移完成，沒有看到會阻擋 worktree 使用的缺陷。這項文件審閱沒有替代 Codex 的實際測試與安裝驗證；沒有要求補做未完功能。
