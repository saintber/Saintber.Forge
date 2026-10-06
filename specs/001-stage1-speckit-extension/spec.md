# Feature Specification: 第一階段 Spec Kit 擴充（context、adopt、archive、Policy Check）

**Status**: pending（工作包提案；**不是**有效規格）
**Created**: 2026-10-06
**Owner**: hub
**Baseline**: `f0d3b89`（`docs/migration-status.md` 的撰寫時點）
**Sources**: 採納設計（[快照](../../docs/architecture/decisions/0001-attachments/design-2026-10-adopted.md)）§11.3、§12、§13.4、§13.5、§15.5（驗收 1–5a）、§16（階段 1）；ADR-0001 決策 9；POL-SPEC-001、POL-SPECKIT-001

> **範圍界線**：只做**階段 1**（治理與結構）完成所必需的部分。**不包含**階段 2 以後的 saintber CLI、bootstrap、installer、其他工具（驗收 6–12）。

## 為什麼必須做

階段 1 的完成條件是**驗收 1–5（含 5a）**（設計 §16）。其中：
- 驗收 4（adopt 後）、5（基線檢查）、5a（adopt 失敗回復）**直接依賴 adopt 與 archive 的行為**。
- 設計 §13.4 把 `context`、`adopt`、`archive` 與 Policy Check 定為**新增指令**，而上游 Spec Kit v1.1.0 **沒有**它們。
- 所以這些**不能只標「尚未實作」就宣告階段 1 完成**：它們是階段 1 完成的**必要條件**。

## User Scenarios & Testing

### User Story 1 — 上下文載入與專案選擇（Priority: P1）
作為開發者，我在 Hub 或某個專案目錄執行 Spec Kit 階段時，希望指令自動讀取該專案的憲章、Policy 索引與有效規格索引，並**明確回報目標專案**，而不是靠我手動列出。

**Independent Test**：在隔離副本中，從 Hub 根目錄指定某專案執行 `context`，檢查回報的目標專案、模式與讀取清單。

**Acceptance Scenarios**
1. **Given** 專案登錄在 `workspace.json`，**When** 執行 `context`，**Then** 以 workspace 模式回報：專案 ID、專案根目錄、讀取的憲章、Hub 與專案的 Policy 索引。
2. **Given** 指定的專案**不存在**，**When** 執行 `context`，**Then** 報錯，**不在 Hub 或其他位置建立任何檔案**（驗收 3）。
3. **Given** 工具目錄**沒有父 repo**（沒有 `workspace.json`），**When** 執行 `context`，**Then** 以 standalone 模式運作，**不讀取任何父路徑**。
4. **Given** 明確指定的 workspace 或專案無效，**When** 執行，**Then** 報錯，**不降級**成 standalone。

### User Story 2 — 採納（adopt）已驗證的變更（Priority: P1）
作為開發者，我希望驗證完成的工作包能被**安全地**合併進有效規格，並留下可追溯的紀錄。

**Acceptance Scenarios**
1. **Given** `verification.md` 結論為通過、基線檢查無衝突，**When** 執行 `adopt`，**Then** Delta 合併進該 capability 的有效規格、Change Log 新增一列並指向封存位置，requirement ID 無重複、無被刪除後重用（驗收 4）。
2. **Given** `verification.md` 未通過，**When** 執行 `adopt`，**Then** 拒絕並說明原因，**不修改**任何有效規格。
3. **Given** 工作包已 `cancelled` 或 `superseded`，**When** 執行 `adopt`，**Then** 拒絕（這類只 archive，不 adopt）。

### User Story 3 — 基線檢查，攔下並行與未提交的衝突（Priority: P1）
**Acceptance Scenarios**
1. **Given** 另一個工作包已 adopt 同一 capability，**When** 後完成的工作包 adopt，**Then** 基線檢查**失敗並停止**，要求重新比對（驗收 5）。
2. **Given** 目標規格檔有 **staged** 或**未提交**的變更（或有新建的有效規格檔），**When** adopt，**Then** 攔下，**不覆蓋任何變更**（驗收 5）。
3. **Given** 工作目錄有與目標 capability **無關**的使用者變更，**When** adopt，**Then** 那些變更**不受影響，也不被清理**。
4. **Given** 在暫存區驗證完、套用之前，目標規格又被修改，**When** 套用前再檢查，**Then** 攔下。

### User Story 4 — 套用失敗時只回復本次觸及的檔案（Priority: P1）
**Acceptance Scenarios**
1. **Given** adopt 套用到一半失敗，**When** 回復，**Then** **只**回復本次觸及的檔案；使用者原有的修改保留；**沒有**自動 stage 或 commit（驗收 5a）。
2. **Given** 重複執行同一個 archive，**When** 目標已存在且內容相同，**Then** 視為已完成（可重試）；內容不同則報錯，**不覆蓋**。

### User Story 5 — Policy Check 與編號（Priority: P2）
**Acceptance Scenarios**
1. **Given** 執行 `plan`，**When** 產出 plan，**Then** plan 包含 **Constitution & Policy Check**，逐條列出適用的 Policy ID 與結果（設計 §11.3）。
2. **Given** 新工作包，**When** 決定編號，**Then** 同時掃描 `specs/` 與 `archive/changes/`，**編號不重用**（POL-SPEC-001 R8）。

### User Story 6 — 代理驗收（Priority: P1）
**Acceptance Scenarios**
1. **Given** 隔離副本，**When** **Claude Code** 與 **Codex** 各自**實際執行**驗收 2、3，以及 standalone，**Then** 結果符合上述情境；**腳本層的解析測試不能代替**（設計 §13.5）。

## Edge Cases
- 目標專案已被封存或不存在 → 報錯。
- 有效規格檔不存在（新 capability 第一次 adopt）→ 建立，但仍要通過 requirement ID 檢查。
- 工作目錄沒有 git → 基線檢查無法執行，必須**明確報錯**，不得略過。
- 暫存區殘留（上次失敗）→ 偵測並要求處理，不得默默覆蓋。

## Requirements

### Functional Requirements
- **FR-001**：`context` 依 workspace / standalone 兩種模式載入上下文，並回報目標專案、模式、讀取清單（設計 §13.4）。
- **FR-002**：明確指定的目標無效時**報錯**，不退回 Hub，不降級（設計 §13.2、§13.4）。
- **FR-003**：`adopt` 的前提是 `verification.md` 通過且基線檢查無衝突（設計 §12.5）。
- **FR-004**：基線檢查涵蓋**已 commit、已 staged、未提交與新建**的目標規格檔，只針對本次 capability；套用前**再檢查一次**（設計 §12.6）。
- **FR-005**：先在暫存區產生並驗證，再套用；失敗只回復本次觸及的檔案；**不自行 stage 或 commit**（設計 §12.5）。
- **FR-006**：`archive` 目標已存在時拒絕覆蓋（相同視為已完成）；`cancelled` / `superseded` 只封存、不 adopt（設計 §12.5）。
- **FR-007**：`archive.md` **不記錄**自己所在的 commit（設計 §12.5）。
- **FR-008**：`plan` 含 Constitution & Policy Check（設計 §11.3）。
- **FR-009**：新工作包編號掃描 `specs/` 與 `archive/changes/`（設計 §12.5）。
- **FR-010**：**不直接修改** Spec Kit CLI 產生的檔案；以上游 **preset / extension** 承載，放在 `tooling/speckit/`，保留憲章與使用者的修改（ADR 決策 9；POL-SPECKIT-001 R6）。

### Key Entities
- **工作包**：`specs/<NNN-name>/`，狀態 `draft`/`in-progress`/`verified`/`cancelled`/`superseded`。
- **有效規格**：`docs/specifications/<capability>/spec.md`。
- **封存**：`archive/changes/<NNN-name>/`。
- **暫存區**：`.specify/tmp/<change-id>/`（不提交；已在 `.gitignore`）。

## Success Criteria

- **SC-001**：設計 §15.5 的**驗收 1–5 與 5a** 全部通過（階段 1 的完成條件，§16）。
- **SC-002**：Claude Code 與 Codex **各自實際執行**的代理驗收（驗收 2、3、standalone）通過。
- **SC-003**：上游 `specify integration status` 回報沒有被修改的受管理檔案（**沒有手改 CLI 產生的檔案**）。

## Assumptions
- 上游 Spec Kit **v1.1.0** 的 preset / extension 機制可承載這些指令（**待驗證**，見 research.md）。
- 驗收在**隔離副本**進行，不在本 repo 建測試 feature、不切換分支、不覆蓋未提交內容。
- 這個工作包**不實作** saintber CLI 或其他階段的內容。

## Out of Scope
- saintber CLI、bootstrap、installer、catalog 的程式碼（階段 2 以後）。
- 驗收 6–12。
- 其他工具（ai-assistant 等）。
- forge-explorer 的 `saintber.project.json` 入口。
