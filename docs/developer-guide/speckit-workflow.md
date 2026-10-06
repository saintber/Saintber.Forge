# Spec Kit 工作流程

> 狀態：遷移（`hub/000-restructure`）時，由舊的 `docs/intent/README.md` 併入並更新到新結構。
> 完整設計見 [`採納時的設計（快照）`](../architecture/decisions/0001-attachments/design-2026-10-adopted.md) §10–§13。
>
> **重要**：下方標示「⏳ 尚未實作」的指令與腳本，目前**還不存在**。在它們完成之前，請手動依本文的規則操作，不要假設可以呼叫。

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

Plan、Spec、Verification 屬於實作與交付層，**不是**需求定義文件。

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

| 指令 | 狀態 |
|---|---|
| `/speckit.constitution`、`specify`、`clarify`、`plan`、`tasks`、`analyze`、`implement`、`checklist`、`taskstoissues` | ✅ 既有（本地舊版，尚未依新設計客製化） |
| `speckit.context`（共同上下文載入） | ⏳ 尚未實作 |
| `speckit.adopt` | ⏳ 尚未實作 |
| `speckit.archive` | ⏳ 尚未實作 |

**尚未實作期間的手動做法**：完成並驗證後，由人依 [`採納時的設計（快照）`](../architecture/decisions/0001-attachments/design-2026-10-adopted.md) §12.5、§12.6 手動合併有效規格並封存；adopt 與 archive 都不要自動 stage 或 commit，交給一般的提交流程審查。

### 使用既有指令時的注意事項
本地舊版 Spec Kit **還不支援**多專案：
- 在 `projects/<id>/` 底下執行時，它仍會把根目錄當成專案根目錄，工作包會建立在 Hub 的 `specs/`。
- 分支編號掃描所有分支，且要求 `^[0-9]{3}-` 格式。

在 `hub/000-restructure` 的後續步驟完成客製化（採納時的設計（快照）§13）之前，請**不要**在 `projects/<id>/` 中直接執行 `/speckit.specify`。

## 5. 呼叫指令時要提供的上下文（手動）

在自動載入完成之前，呼叫 `/speckit.specify` 時，請在訊息中明確列出：

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
