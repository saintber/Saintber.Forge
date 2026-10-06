---
id: POL-SPEC-001
title: Specification Lifecycle
status: active
scope: workspace
applies-to: [specify, clarify, plan, tasks, analyze, implement, adopt]
owner: saintber
supersedes: []
source: 採納時的設計 §12.1–§12.6；憲章原則 IV、VI
---

# Specification Lifecycle

> 目的：規範**有效規格、工作包與封存**的生命週期。
> 本文是對**已採納設計 §12** 與 **Hub 憲章原則 IV、VI** 的忠實展開，每條規則標示出處。出處不在設計或憲章內的條文，標為 **Proposed**，集中列在文末。

## 三層（§12.1）

| 層 | 位置 | 意義 | 狀態 |
|---|---|---|---|
| 人類輸入 | `docs/intent/<NNN-name>/intent.md`、`decision.md` | 這次為什麼做、限制、取捨 | 跟著工作包 |
| 工作包 | `specs/<NNN-name>/` | 這次的候選規格、研究、計畫、任務、驗證 | `draft` → `in-progress` → `verified`；或 `cancelled` / `superseded` |
| 有效規格 | `docs/specifications/<capability>/spec.md` | 已驗證並採納、代表**現在**的行為 | `active` |
| 封存 | `archive/changes/<NNN-name>/` | 歷史紀錄 | `adopted` / `cancelled` / `superseded`，唯讀 |

## 規則

### R1 規格唯一（§12.2；憲章原則 IV）
- 唯一的是**同一 capability 與 requirement ID 的有效定義**，不是整個 repo 只能有一個 `spec.md`。
- 有效規格以 **capability** 劃分，不以 feature 或 branch 劃分。
- 每個 capability 只有**一個 owner 專案**；每條 requirement 有**穩定 ID**（例如 `REQ-INV-003`），ID 不重用；刪除的 ID 在 Change Log 標示 removed。
- 工作包的 `spec.md` 是**提案（pending）**，不得被當成現況引用；封存內容預設不被讀作需求。
- 有效規格格式：frontmatter（`capability`、`owner`、`status`、`last-adopted`）、`Requirements`、`Change Log`（Date、Change、Requirements、Summary、Archive）。
- `docs/specifications/README.md` 是 capability 索引：capability ID、owner、一句話說明、最後一次採納的變更。

### R2 例行工作與核准（憲章原則 VI）
- 在**既有授權與已核准設計的範圍內**，工作包直接進行，**不另設逐案批准關卡**。
- 工作包的 spec 審查後可作為**實作基準**，但仍是 **pending**，不是現況。
- 只有變更**已採納的架構、放寬或變更規範、破壞公開契約**時，才須先取得相應 owner 的核准（憲章原則 VI）。
- **有效規格不會因為設計獲得批准就提前改成現況**；只在驗證後 adopt 時更新。

### R3 工作包內容（§12.3）
工作包至少依需要包含：`context.md`（目標專案、適用的 Policy、讀取的有效規格與 `baseline-commit`）、`spec.md`（提案：Affected Capabilities 與 Delta：ADDED / MODIFIED / REMOVED requirement IDs）、`plan.md`（含 Constitution & Policy Check）、`tasks.md`、`verification.md`，以及 research、data-model、contracts、quickstart、checklists。
- 修改既有 capability 時，候選 spec 對既有行為只用**引用**，集中描述差異與驗收。
- 新的 capability 第一次建立時，可以寫完整的候選規格；adopt 後才成為有效定義。
- 單檔多版本的 Intent：流程**只讀** Current Effective Intent。

### R4 流程與驗證關卡（§12.4）
讀取有效規格、Policy、架構 → `specify`（建立工作包，記錄 `baseline-commit`）→ clarify / plan / tasks / analyze → implement → **verify** → 檢查目標規格自基線後是否被改過 → **adopt** → **archive**。
- verify 失敗：回到工作包修正。
- 目標規格有變更：重新比對，必要時重新驗證。
- **取消或被取代**：直接 archive（`cancelled` / `superseded`），**不 adopt**。

### R5 adopt（§12.5）
- **前提**：`verification.md` 的結論是通過，**而且**基線檢查沒有衝突。
- 動作：把 Delta 合併進有效規格並更新 Change Log；檢查 requirement ID 有沒有重複、有沒有被刪除後又重用；必要時更新 `docs/architecture/` 與使用手冊；長期決策提示寫成 ADR 或更新 Policy。

### R6 archive（§12.5）
封存結構：`archive.md`（狀態、日期、change ID、來源路徑、`baseline-commit`、交付版本）、`inputs/`（原 intent / decision）、`work/`（原工作包完整內容）。
- `archive.md` **不記錄** adopt 所在的 commit hash（一個檔案無法記錄包含它自己的 commit）；需要時以 change ID 從 git history 查詢。
- 目標已存在時**拒絕覆蓋**：先比對內容，相同視為已完成，不同就報錯；重複執行是安全的（可重試）。
- 清除這個工作包的**活動上下文**；現行導覽改指向封存位置。
- `cancelled` / `superseded` 只封存，**不 adopt**。

### R7 套用方式與失敗處理（§12.5）
- 先在**暫存區**（例如 `.specify/tmp/<change-id>/`，不提交）產生完整的變更結果，並完成驗證：requirement ID、連結、目標是否存在、基線檢查。
- 驗證通過後，才套用到工作目錄。
- 套用中途失敗時，**只回復本次觸及的檔案**，不覆蓋使用者原有的修改，也不清理整個工作目錄。
- 成功後，變更留在工作目錄，**不自行 stage 或 commit**，交由既有的提交流程審查。
- adopt 與 archive 的結果建議放在**同一個可審查的 commit**；這是提交單位的建議，**不是**工作目錄的原子性保證。

### R8 編號（§12.5）
新工作包的編號要同時掃描 `specs/` 與 `archive/changes/`；**編號不重用**。

### R9 並行修改與基線檢查（§12.6）
- 兩個工作包修改同一個 capability 時，**先 adopt 的那個更新基線**；後完成的那個在 adopt 前的基線檢查失敗，必須重新比對新的有效規格、調整 Delta，必要時重新驗證。
- 檢查範圍**只針對本次指定的 capability 規格檔**：已 commit（`baseline-commit` 到 HEAD）、已 staged、未提交與新建的有效規格檔。
- 先辨識哪些變更是**本工作包準備的 Delta**，哪些是**其他來源**的修改。有衝突或來源不明時，停止並重新比對，**不覆蓋**。
- 在暫存區驗證完、真正套用之前，**再檢查一次**。
- 與目標 capability 無關的使用者變更不受影響，也不會被清理。

### R10 補建的有效規格（§15.4；憲章原則 VII）
遷移時補建有效規格，要以**規格、程式碼、驗證紀錄三方核對**的結果為準，**不得**把候選規格整份複製成現況；每條 requirement 標示證據等級，缺口如實列出。範例：`projects/forge-explorer/docs/specifications/`。

## 本文與 Spec Kit 指令的關係

`adopt`、`archive`、`context` 在採納設計中是**新增指令**（§13.4）。**它們是否已存在**，以 `docs/developer-guide/speckit-workflow.md` 的「指令現況」為準；在它們存在之前，R4 – R9 的動作**由人依本文手動執行**，規則不變。

## Proposed（超出已採納設計的條文，待 owner 裁決）

目前**沒有**。
