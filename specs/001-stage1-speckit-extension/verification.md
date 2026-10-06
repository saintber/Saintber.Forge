# Verification Record — 001-stage1-speckit-extension

## Scope
- Summary：第一階段 Spec Kit 擴充（`speckit.hub.context` / `adopt` / `archive`）、多代理安裝腳本、代理驗收工具。
- Affected Projects：hub（`tooling/speckit/`）；安裝到 hub 與 forge-explorer 的 `.specify/extensions/`、`.claude/skills/`、`.agents/skills/`。

## Environment
- Runner：local（Windows 11）
- Runtime：Node v24.19.0；specify-cli 1.1.0；Claude Code 2.1.291；codex-cli 0.160.0；.NET SDK 10.0.302
- Notes：所有破壞性與代理測試都在**系統暫存目錄的隔離副本**執行（`%TEMP%/saintber-iso`、`%TEMP%/saintber-accept`），沒有在本 repo 建立測試 feature、切換分支或覆蓋未提交內容。

## Gate A — Automated
- Restore / Build（驗收 1，forge-explorer）：
  - Command：`dotnet build Saintber.Forge.sln`
  - Result：0 警告、0 錯誤（本次執行）
- Test（驗收 1）：
  - Command：`dotnet test tests/Saintber.Forge.BlazorServer.UnitTests`
  - Result：1 通過。**注意**：唯一的單元測試是空方法，只證明測試命令可執行，**不是**行為證據。
- Test（hub 擴充）：
  - Command：`node tooling/speckit/extension/tests/run-all.mjs`
  - Result：**38 通過、0 失敗**（context 11、adopt 18、archive 9）
  - 變異測試：對每個安全機制做變異，**每個變異都至少讓一個測試失敗**（基線檢查的第一次與第二次各自、staged、untracked、失敗回復、ID 重用、未驗證、自動 `git add`、暫存區殘留、archive 覆蓋、NOT_ADOPTED、失敗清理、先刪來源、清除上下文、SPECIFY_INIT_DIR 退回、編號忽略封存）。測試過程中曾發現兩處測試不足（只拿掉第一次基線檢查時被第二次檢查掩蓋；自動 `git add` 的變異本身有語法錯誤），已補測試並重新驗證。

## 驗收對照（設計 §15.5，階段 1 = 驗收 1–5、5a）

| # | 情境 | 結果 | 證據 |
|---|---|---|---|
| 1 | 遷移後 build / 測試與基線相同 | ✅ PASS | 上方 Gate A（基線見 `docs/migration-status.md`） |
| 2 | 從 Hub 指定專案執行 specify，產出只在該專案 | ✅ PASS（Claude、Codex） | 代理驗收（範圍見下方「S2 的範圍限制」） |
| 3 | 指定不存在的專案：報錯、Hub 沒有產出 | ✅ PASS（Claude、Codex） | 代理驗收；腳本測試 |
| 4 | adopt 後只有一份有效規格、Change Log 指向封存、歷史不遺失 | ✅ PASS（腳本自動化測試） | `adopt.test.mjs` 驗收 4 |
| 5 | 並行、staged、未提交、新建的目標規格被攔下；不覆蓋 | ✅ PASS（腳本自動化測試） | `adopt.test.mjs` 驗收 5 系列、套用前再檢查 |
| 5a | 套用中途失敗：只回復觸及的檔案、使用者修改保留、未 stage / commit | ✅ PASS（腳本自動化測試） | `adopt.test.mjs` 驗收 5a 系列 |

**驗收 4、5、5a 的證據等級**：由**腳本的自動化測試**在隔離的 git repo 中驗證。指令 `.md` 只呼叫腳本並轉述結果；**沒有**用代理端到端執行 adopt / archive。若需要代理層的 adopt / archive 驗收，是另外的工作。

## 代理驗收（設計 §13.5；在隔離副本，以 `acceptance/check.mjs` 客觀判定）

| 情境 | Claude Code | Codex |
|---|---|---|
| S3 無效專案：報錯、無任何新檔案 | ✅ PASS（`PROJECT_NOT_REGISTERED`，0 個新檔案） | ✅ PASS（腳本 `PROJECT_NOT_REGISTERED`、exit 1；代理 exit 0；0 個新檔案） |
| S2 從 Hub 指定 `ai-queue` 後 specify：產出只在該專案 | ✅ PASS（`specs/001-queue-retry-limit/{spec.md, checklists/requirements.md}`） | ✅ PASS（`specs/001-queue-retry-limit/{spec.md, context.md, checklists/requirements.md}`） |
| SA 無父 repo 副本：standalone、不讀父路徑、無新檔案 | ✅ PASS | ✅ PASS |

兩者的 S2 都另有目標專案自己的本機狀態 `projects/ai-queue/.specify/feature.json`（上游 `.specify/.gitignore` 排除），位在專案內，判定允許。

**證據位置**（系統暫存目錄，不在 repo）：`%TEMP%\saintber-accept\<agent>\logs\` 下的 `S3/S2a/S2b/SA.transcript.txt`、`S3/S2/SA.changes.txt`、`SA.context.json`；Codex 另有 `check.output.txt`。

**判定的獨立性**：Codex 的情境由 Codex 執行並判定；Claude 再以同一個 `check.mjs` **獨立重跑**，結果相同（exit 0）。Codex 回報它沒有 stage、commit、修改主 repo 或 Claude 的副本；Codex 兩個副本的 HEAD 仍是基線（hub `6b4dc89`、standalone `ca287a8`），已由 Claude 確認。

### Codex 側的執行差異
- codex-cli 0.160.0 使用 `--approve-for-me --color never -C <副本>`。`--approve-for-me` 本身是 workspace-write；第一次同時帶 `--sandbox` 只輸出用法並以 exit 2 結束，**代理沒有啟動**，之後修正重跑。
- Windows 沙箱啟動曾出現 `CreateProcessAsUserW` 錯誤 5，代理經自動審核重試後實際執行。**啟動失敗不當作 PASS。**
- 變更快照以 UTF-8（無 BOM）、LF 輸出，供 JSON 與路徑判定。

### S2 的範圍限制（重要）
- **Codex 的 S2b 沒有執行上游的 `create-new-feature.ps1`**：它在產出的 `context.md` 記載「目前終端程序無法啟動；透過檔案工具讀取解析規則並完成等效的範本選擇與檔案建立」（已由 Claude 確認原文）。它也**沒有**建立或切換 branch，**沒有** extension hooks。
- **Claude 的 S2b** 自述沒有建立 git 分支，並略過 hooks（`ai-queue/.specify/` 沒有 `extensions.yml`）。
- 因此 S2 的 PASS **只證明「代理實際執行、產出被隔離在目標專案」**，**不能**擴大成上游 `create-new-feature.ps1`、編號邏輯、branch 與 hooks 的全流程已實測通過。

### SA 的範圍限制（重要）

SA **只驗證**：context 在沒有父 repo 時解析為 standalone、不讀父路徑、不產生檔案。

它**不足以**宣稱以下事項已完成：
- 設計 §11.6 的治理內化（workspace 類 Policy 內化到工具）。
- distribution Policy 的版本固定快照（`docs/governance/policy/inherited/`）——forge-explorer **目前沒有**這個目錄。
- 設計 §14.3 的整套遷出演練（驗收 11）。

實際觀察（Codex 回報）：standalone 副本中的 forge-explorer `AGENTS.md` 與 Policy README 仍描述以 `../../` 繼承 Hub 的路徑，而這些路徑在副本中**不存在**，所以代理**沒有**載入 Hub 的繼承文件。這是工具尚未做遷出準備的事實，**不是**本工作包修好的東西。

## 已知缺口

| 代號 | 缺口 | 影響 |
|---|---|---|
| G-PC | plan 的 Constitution & Policy Check 沒有自動機制。preset 包裝 `speckit.plan` 經實測會**改寫 CLI 受管理的檔案**（status modified 1）且只作用在一個代理；移除後仍未復原，須以 `specify integration upgrade --force` 修復。**不採用** | §13.5「修改憲章或升級後 plan 仍含 Policy Check」**未達成**；改由 POL-SPECKIT-001 R5 規範、`analyze` 檢查 |
| G-NUM | 上游 `create-new-feature` 編號只掃 `specs/`；`speckit-hub-context` 提供 `nextChange`（含 `archive/changes/`），但要代理以 `-Number` 傳入 | 編號不重用**依賴代理照做**；只有 context 的計算有自動化測試 |
| G-MA | 上游 extension 一次只安裝給一個代理；以 `install.mjs` 依序安裝並還原預設 | **升級 Spec Kit 後必須重跑** `install.mjs` |
| G-AGENT-ADOPT | adopt / archive 沒有代理端到端驗收 | 見上方「證據等級」 |

## Docs Consistency (R6a)
- Documents checked：`docs/developer-guide/speckit-workflow.md`（指令現況、呼叫方式、已知限制、代理驗收表）、`AGENTS.md`、`tooling/speckit/README.md`、ADR-0001（實現與進度）、`docs/migration-status.md`。
- Deviations from approved design：
  - 指令全名 `speckit.hub.*`，不是快照的 `speckit.context` 等簡寫（上游命名規則要求）。屬命名細節，不改架構與決策；記在 plan 的偏離紀錄與 ADR 的實現與進度。
  - 設計 §13.6 的「`sync-speckit.mjs` 與三種格式」不採用，已由 ADR-0001 決策 9 取代（非本工作包的偏離）。

## Final Status
- **Not Done**（2026-10-06，Codex 審閱 R10–R15 退回）
- 退回原因：腳本有已重現的缺陷（Delta 套用會刪除非 requirement 章節、多段 ID 被靜默忽略、capability 路徑可越界；archive 重試與回復不完整），以及本工作包自己 spec 寫明的 FR-008（Policy Check）與編號不重用尚未達成。修正中，見下方「R10–R15 修正紀錄」。

### 以下為退回前的紀錄（保留，不作為完成依據）
- （原）Done（階段 1 的驗收 1–5、5a）
- Notes：
  - 驗收 2、3：兩種代理都實際執行，並以 `check.mjs` 客觀判定 PASS。範圍限制見上：**不含**上游 `create-new-feature.ps1`、編號、branch、hooks 的全流程。
  - 驗收 4、5、5a：以腳本的自動化測試（含變異測試）驗證；**沒有**代理端到端的 adopt / archive 驗收（G-AGENT-ADOPT）。
  - 不在本工作包範圍、仍未完成：G-PC、G-NUM、§11.6 治理內化、§14.3 遷出演練（驗收 11）、驗收 6–12（階段 2 以後）。
