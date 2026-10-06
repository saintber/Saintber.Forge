# Spec Kit 工作流程

> 狀態：遷移（`hub/000-restructure`）時，由舊的 `docs/intent/README.md` 併入並更新到新結構。
> 完整設計見 [`採納時的設計（快照）`](../architecture/decisions/0001-attachments/design-2026-10-adopted.md) §10–§13。
>
> **重要**：下方標示「⏳」的項目目前**還不存在或尚未驗收**，不要假設可以使用。

本文說明 Hub 與各專案如何使用 Spec Kit 與 SDD（規格驅動開發）文件，不定義任何業務規則或技術決策。

## 1. 文件分類與責任

| 類別 | 位置 | 說明 |
|---|---|---|
| **Constitution** | `.specify/memory/constitution.md` | 不可退讓的治理原則。所有文件與實作都不得違反。正本只有這一份，不保留副本 |
| **Policy** | `docs/governance/policy/` | 長期且通用的規範。具約束力；違反需要 owner 核准的例外。見該目錄的 `README.md` |
| **Intent** | `docs/intent/<NNN-name>/intent.md` | 為什麼要做這次變更。保存人類對問題的理解及其演進，不描述實作方式 |
| **Decision** | `docs/intent/<NNN-name>/decision.md` | 在特定 Intent 前提下的實作約束或取捨。只適用該 Intent；若演變成長期通用規則，要升級為 Policy |
| **工作包** | `specs/<NNN-name>/` | 進行中的變更提案：spec、plan、tasks、驗證等。由 Spec Kit 依 Intent / Decision / Policy 產生 |
| **有效規格** | `docs/specifications/<capability>/spec.md` | 已驗證並採納、代表「現在」行為的規格。每個 capability 只有一份 |
| **封存** | `archive/changes/<NNN-name>/` | 已完成、取消或被取代的工作包與其輸入，唯讀歷史 |
| **架構** | `docs/architecture/` | 現在系統怎麼運作。ADR 在 `decisions/` |

**Intent** 是需求的來源（為什麼要做）。**工作包的 `spec.md`** 是可驗收的需求規格，但在驗證並採納（adopt）之前，它是**候選與實作基準，仍是 pending**，不是現況。**有效規格**才是「現在」的行為。Plan、Tasks、Verification 屬於實作與交付層。

## 2. Intent 的規則

### 定位
Intent 記錄：原始利害關係人需求、問題定義與動機、功能意圖的演進。

Intent **不是**規格書、實作說明或 Release Note。

### 單檔、多版本
- 每個 Intent 只有**一份** `intent.md`，用文件內的 **Intent Version Index** 記錄意圖的演進。
- 版本代表「人類理解與需求認知的演進」，**不是**實作版本或交付版本。
- 只有 **Current Effective Intent** 之後的內容是目前有效的意圖。歷史版本**不得**被推導成現行需求。

### 檔名
`intent.md`、`decision.md` 一律**小寫**，避免在 Linux 上找不到檔案。

### 大綱

```md
# <Feature Name> — Intent Record

## Intent Version Index
| Version | Date | Trigger | Summary |

## Current Effective Intent
（標示目前生效版本）

## Problem Statement
## Motivation
## Stakeholders & Users
## Desired Outcome
## Assumptions & Known Constraints
## Out of Scope
## Related Documents
```

### Decision 的規則
- 每個 Intent 最多一份 `decision.md`。
- 記錄該 Intent 下的實作約束與取捨，只適用於該 Intent。

## 3. 規格的唯一性

唯一的是**同一 capability 與 requirement ID 的有效定義**，不是整個 repo 只能有一個 `spec.md`。

- 有效規格以 **capability** 劃分，不以 feature 或 branch 劃分。
- 每個 capability 只有一個 owner 專案；每條 requirement 有穩定的 ID，ID 不重用。
- 工作包的 `spec.md` 是**提案（pending）**，不能被當成現況引用。
- 封存內容預設**不被讀作需求**，只有追溯歷史時才明確讀取。
- 手冊與程式註解用 ID 或連結引用 requirement，不另外宣告一套規格。

## 4. 變更的生命週期

```text
讀取有效規格、Policy、架構
  → specify（建立工作包，記錄 baseline-commit）
  → clarify / plan / tasks / analyze
  → implement
  → verify
  → 檢查目標規格自基線後是否被改過（committed、staged、未提交）
  → adopt（合併進有效規格、更新架構與手冊）
  → archive（移到 archive/changes/，狀態 adopted）

取消或被取代：直接 archive（cancelled / superseded），不 adopt
```

完整規則（驗證關卡、基線衝突、套用失敗的處理、不覆蓋與可重試）見 [`採納時的設計（快照）`](../architecture/decisions/0001-attachments/design-2026-10-adopted.md) §12。

### 指令現況

**呼叫方式**：Claude Code 用 `/speckit-xxx`；Codex 用 `$speckit-xxx`（上游 v1.1.0 對 Codex 的技能呼叫格式）。

| 指令 | 狀態 |
|---|---|
| `speckit-constitution`、`specify`、`clarify`、`plan`、`tasks`、`analyze`、`implement`、`checklist`、`taskstoissues`、`converge` | ✅ 上游 Spec Kit v1.1.0（CLI 產生，不手改） |
| `speckit-hub-context` | ✅ 已安裝（hub 擴充）：解析目標專案、模式，並列出要讀的憲章與 Policy 索引；目標無效時報錯，**不建立任何檔案**、不退回 Hub |
| `speckit-hub-adopt` | ✅ 已安裝：已驗證的工作包合併進有效規格；基線檢查（committed / staged / 未提交 / 新建）、暫存區、套用前再檢查、失敗只回復觸及的檔案；**不 stage、不 commit** |
| `speckit-hub-archive` | ✅ 已安裝：adopted / cancelled / superseded；可重試、不覆蓋 |

- 指令名稱是 `speckit.hub.*`（技能名 `speckit-hub-*`），不是設計快照寫的 `speckit.context` 等簡寫：上游要求擴充指令必須是 `speckit.<擴充>.<指令>`。見 `specs/001-stage1-speckit-extension/plan.md` 的偏離紀錄。
- 邏輯在 `tooling/speckit/extension/scripts/`（Node），有 38 個自動化測試（`node tooling/speckit/extension/tests/run-all.mjs`）。
- **安裝或升級**：執行 `node tooling/speckit/install.mjs --project-dir <專案>`。上游 v1.1.0 的 `specify extension add` 一次只安裝給**一個**代理，這個腳本會依序裝給每個整合，並把預設整合還原。**升級 Spec Kit 後要重跑。**

### 已知限制（第一階段）

| 代號 | 限制 | 目前的處理 |
|---|---|---|
| G-PC | plan 的 **Constitution & Policy Check** 沒有自動機制保證。以 preset 包裝 `speckit.plan` 會**改寫 CLI 受管理的檔案**且只作用在一個代理（已在隔離副本驗證），所以**不採用** | 依 POL-SPECKIT-001 R5，由人或代理在 plan 中加入；`analyze` 時檢查 |
| G-NUM | 上游 `create-new-feature` 的編號**只掃 `specs/`**，不掃 `archive/changes/` | `speckit-hub-context` 會輸出 `nextChange`（兩者都掃）；specify 時以 `-Number <nextChange>` 傳入。**依賴代理照做** |

### 代理驗收（設計 §13.5）

在隔離副本以**實際的代理**執行（步驟見 `specs/001-stage1-speckit-extension/acceptance/run.md`），以 `check.mjs` 客觀判定（2026-10-06）：

| 情境 | Claude Code | Codex |
|---|---|---|
| S3 指定不存在的專案：報錯、不產生任何檔案 | ✅ PASS | ✅ PASS |
| S2 從 Hub 指定 `ai-queue` 執行 specify：產出只在該專案 | ✅ PASS | ✅ PASS |
| SA 沒有父 repo 的副本：standalone、不讀父路徑 | ✅ PASS | ✅ PASS |

**範圍**：S2 只證明產出被隔離在目標專案，**不含**上游 `create-new-feature.ps1`、編號、branch、hooks 的全流程；SA 只證明 standalone 解析，**不等於**治理內化或遷出演練。升級 Spec Kit 或代理後，請重跑這套驗收。

## 5. 呼叫指令時要提供的上下文（手動）

在自動載入完成之前，呼叫 `/speckit-specify` 時，請在訊息中明確列出下列上下文。**這是人工的輔助檢查，不是有效規格，也不會自動強制 Policy**；新產生的 spec 在驗證並採納之前仍是 pending：

```text
目標專案：<project-id>

Inputs:
- docs/intent/<NNN-name>/intent.md
- docs/intent/<NNN-name>/decision.md

Policies（依專案而定，位置見各專案的 docs/governance/policy/README.md）:
- .specify/memory/constitution.md
- Hub：docs/governance/policy/
- 專案：docs/governance/policy/

Instruction:
- 僅使用 Current Effective Intent 作為需求基準
- 不得從歷史 Intent Version 推導需求
- 先讀 docs/specifications/README.md，判斷影響哪些 capability
```

## 6. 維護原則
- Intent 可以隨理解演進補充版本紀錄。
- Decision 可以被更新、撤銷或升級為 Policy。
- 完成、取消或被取代的工作包與輸入，整體移到 `archive/changes/`，不留在 `specs/` 與 `docs/intent/`。
- 文件保持單一責任，避免跨類型混寫。
