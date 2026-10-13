# ADR-0003：三種顆粒度的開發流程與設計文件位置

- 狀態：Accepted
- 日期：2026-10-13
- 核准者：`saintber`（使用者本次明確指示：「接受你的提案，請讓 claude 變更目前的專案設計與說明文件……說明文件請務必要包含這三種顆粒度大小的開發流程和使用的目錄的說明文件」；提案由 Codex 整理）
- 關聯：[ADR-0001](0001-hub-and-project-split.md)、[ADR-0002](0002-migration-delivery-scope.md)；流程正本 [開發流程：三種顆粒度](../../developer-guide/development-workflows.md)

## 背景

ADR-0002 允許小粒度工作直接開發，不強迫建立 Spec Kit 工作包，但沒有說明直接開發的設計、驗證與採納紀錄放在哪裡；也沒有區分「單次功能」與「完整 Tool 方向」的文件。現行 Policy 的驗證紀錄位置只寫了 `specs/<NNN-name>/verification.md`，容易被讀成所有工作都必須有工作包或 `.specify/`。

## 決策

### 1. 三種流程，依需求性質選擇

| 流程 | 適用 | 設計位置 |
|---|---|---|
| A. 直接開發（不用 Spec Kit） | 範圍清楚、不需多輪需求討論的工作 | 所屬專案 `docs/architecture/proposals/<topic>.md`；內容多時 `<topic>/design.md`、`research.md`、`discussions.md` |
| B. 單次功能（用 Spec Kit） | 需要討論需求、驗收、架構與任務的功能 | 探索在 `proposals/`；正式輸入 `docs/intent/<NNN-name>/`；工作包 `specs/<NNN-name>/` |
| C. 完整 Tool 方向 | 新 Tool 或大型能力的整體方向 | 該 Tool 的 `docs/architecture/proposals/product-direction/`（`design.md`、選用 `roadmap.md`，或單一文件） |

- 流程依需求性質選擇，不只看工具大小。
- 三種流程都遵守適用治理、設計先於實作、規格唯一。不用 Spec Kit 不等於免治理、免設計、免驗證或免採納。
- 問題、探索、方案、待決事項放在 `proposals/`；不新增 `docs/discovery/`、`docs/designs/`。

### 2. 直接開發的設計、驗證與採納

- 設計寫在 proposal，作為實作基準；實作中發現不足，先改 proposal 再改程式。已有適用設計的小修正可以引用既有設計，不必每次新寫完整設計；本次的 Verification Record 仍依 POL-DOD-001 R7 保存在 proposal（引用的設計已結案時，另存輕量的驗證紀錄），提交說明只作摘要。
- 開始時記錄 `baseline-commit` 與受影響的 capability；採納時沿用 POL-SPEC-001 R7 的暫存、套用前檢查、只回復自己變更的原則。
- 驗證紀錄（POL-DOD-001 的 Verification Record）寫在 proposal 的「驗證紀錄」一節或 `<topic>/verification.md`。
- 影響有效規格時，依 POL-SPEC-001 手動更新有效規格與 Change Log，Archive 欄指向該 proposal。Hub 擴充的 adopt／archive 不處理 proposal，不得宣稱已自動化。

### 3. 用 Spec Kit 的單次功能

- 未編號的探索主題先在 `proposals/`。
- 進入 specify 前，intent 只整理本次問題、情境、範圍與非目標、確立限制、未決事項、驗收方向與來源連結；取捨在 `decision.md`。不先寫完整的重複規格，也不把探索中的所有候選方案當成需求。
- spec 是候選規格，技術細節在 plan。

### 4. 完整 Tool 方向

- 方向文件寫方向、責任與介面、能力、風險、未決事項。
- 拆成多個可獨立驗收的能力或 change；不把設計章節或每個 task 各開一個工作包。
- 每次新的 intent／spec／plan／tasks 重新界定範圍；有效規格依 capability 採納並保持唯一。
- roadmap 的未來項目不是已批准的全面實作。

### 5. 文件歸屬與狀態

- owner 未確定且 Tool 尚未成立時，可暫放 Hub `proposals/` 並標明預計 owner；Tool 成立後移入其 `docs/` 並修正連結，只保留一份正本。已存在的 Tool 的文件不留在 Hub。
- 草稿可以修改；Tool 方向文件可以持續演進。結案的提案留在原處作為歷史，內容不改寫，只更新必要的導覽 metadata。已採納的設計版本與 ADR 附件保留為唯讀快照。變更已採納決策依憲章原則 VI 的既有程序；例行的已授權工作不新增逐次核准關卡。
- 提案放在 `proposals/` 本身不等於批准；在既有授權內經審閱確認的本次設計可以作為實作基準。
- 每份方案標明草稿或目前決策、本次範圍與尚未實作，不得把核准的方向寫成功能已交付。

### 6. `.specify/` 的初始化時機

- 不使用 Spec Kit 時，不需要為了目錄合規初始化 `.specify/`。
- 日後要使用時，先初始化該 Tool 自己的 `.specify/` 與整合；未初始化前不在該 Tool 執行 Spec Kit，避免向上誤用 Hub。
- 未初始化時，Hub 憲章、適用的 Hub Policy 與 Tool Policy 仍然適用；不偽造 Tool 憲章，也不把 Hub 憲章複製成第二份正本。

## 影響

- 新增流程正本 `docs/developer-guide/development-workflows.md`；導覽、Spec Kit 指引、並行開發指引、AGENTS 與 Tool 範本改為引用它。
- POL-DOD-001 R7 的 Verification Record 位置，補上直接開發的位置（決策 2）。這是依本次 owner 明確指示的展開，不改變 Gate、狀態或必填欄位。
- POL-SPEC-001、POL-SPECKIT-001、POL-DOC-001、POL-STRUCT-001 補上適用範圍與 `proposals/` 位置的說明，不放寬既有規則。
- **不修改**：Hub 憲章與 Tool 憲章（本決策不放寬任何原則：憲章原則 IV 要求有效規格經驗證後採納，沒有規定必須使用 Spec Kit）、ADR-0001、ADR-0002、設計快照、CLI 產生的 `speckit-*`、既有有效規格、`001-stage1-speckit-extension` 的狀態。
- 本決策不新增任何產品功能，也不代表 Hub 擴充能處理 proposal。
