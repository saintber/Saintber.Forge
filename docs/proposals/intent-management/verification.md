# 驗證紀錄：Intent 管理策略文件化

- 狀態：草案文件撰寫與 Codex／Sonnet 獨立校閱完成；Final Status 見文末
- 流程：A 直接開發（只改文件與範本；不使用 Spec Kit，不改程式、技能、入口）
- 使用者核准：使用者詢問 Intent 技能與保存、版本、多份需求策略，Codex 說明建議組合後，使用者回覆可交由 Claude 寫文件、再由 Codex 審閱；決策記錄在 [ADR-0006](../../architecture/decisions/0006-intent-management-strategy.md)。設計見 [`design.md`](design.md)。
- baseline-commit：`7cae618`；開始時 `git status` 乾淨（依委託說明，代理未自行執行 git）。
- 受影響的 capability：不影響有效規格

## 範圍

- 新增：`docs/developer-guide/intent-workflow.md`（手冊正本）、`docs/proposals/intent-management/design.md`、本檔、`docs/architecture/decisions/0006-intent-management-strategy.md`。
- 修改：流程手冊與導覽加入提案引用；Spec Kit 手冊的既有 §2 維持原規則，另列管理擴充提案；POL-DOC-001 R1 加導航、P1 列提案，R5 維持原規則；Intent 候選範本與 proposal 範本補充示例與修訂記錄。另依使用者本輪明確指示更新 AGENTS.md 的 Herdr 協作規則（pane 標題、完成回報與收尾關閉）。
- **不在範圍**：`saintber-intent` 技能的實作、`.agents`／`.claude`／`.gemini`／`tooling/skills/saintber-intent`、`saintber-design` 的任何檔案、程式碼與 `archive.mjs`、憲章、ADR-0001～0005 正文、有效規格、封存、已結案歷史。

## 實際檢查（代理只能讀寫檔案，無法執行指令）

- 以 Grep 搜尋殘留的舊說法（「同一版本號不得…」「單一來源」「history/intent-<revision>」「每次修訂產生」）：現行文件中已對齊；`development-workflows.md` 與 `speckit-workflow.md` 的「單一來源」已改為「每個被承接的範圍指定來源」。保留的「全域唯一來源」字樣皆是「不硬選全域唯一來源」的否定用法。
- 人工比對手冊、ADR-0006、設計稿三者的結論一致：現行權威與多來源、版本語意（實質改變才換版、非語意修正可同號）、快照路徑與唯一識別、continue-change 不要求有正式 Intent、修訂後先判斷受影響的 spec／plan／驗收、承接 metadata 僅在使用者明確要求且證據確認後補記。
- 手冊 §1–§13 與 Mermaid 流程圖（含 `continue-change` 與「有無正式 Intent」分支）由代理人工閱讀語法，**未經 renderer 或解析器**。

## 限制（未執行）

- **沒有**執行任何 CLI、腳本、Markdown／Mermaid render、連結與錨點檢查、fence 檢查、`git diff`；這些由 Codex 執行。
- **沒有**代理端到端驗收；`saintber-intent` 尚未實作，因此無任何技能行為可驗收。
- 沒有核對 git 狀態；未 stage、commit、push。
- 語意核對是代理（Claude）比對文字，不是獨立校閱。

## Docs Consistency（POL-DOD-001 R6a）

- 偏離已核准設計：無。ADR-0006 改為 Proposed；本輪交付管理擴充設計，不啟用新治理規則，也不重寫 ADR-0004、ADR-0005。原稿曾誤把委託撰寫視為正式採納，已在校閱後更正。
- `saintber-design` 既有技能、入口與程序未改；新規則與其 `reuse／new／continue-change／needs-clarification` 判斷相容。
- 範例與範本皆標明「示例，不是真實事件」；沒有建立虛構檔案。
- 已知需 Codex 檢查：新增檔案的相對連結（`intent-workflow.md`、ADR-0006、design.md）、`development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令` 等既有錨點、新 §12.5 標題。

## Codex 客觀檢查與獨立校閱

- 執行環境：本機 Windows、PowerShell、Node v24.19.0；baseline `7cae618`，開始時工作目錄與 index 乾淨。
- Gate A：`node <本輪暫存目錄>/check-docs.mjs` 檢查 14 份變更 Markdown 的本地連結目標、GitHub 形式的章節錨點與 fence；全部通過。`git diff --check` 通過。沒有產品程式或技能變更，不執行不相關的建置／測試。
- 禁止範圍檢查：程式、技能與代理入口、`.specify/`、工作包、封存與產品有效規格均沒有本次變更；index 在校閱前未動。
- Sonnet（獨立唯讀 session）首輪提出七項問題，複審逐項核對修正後 **PASS，限草案文件交付**。已修正已結案早期稿的分流、對照表位置與效力、合併稿歷史附件、先保存再修訂、舊格式相容、多來源權威，以及未採納規則的效力。
- 完整審閱證據保存於 `%TEMP%/saintber-intent-docs-82c1747e6a7849d7991d6ba770aec8bc/` 的 `sonnet-review.md`、`sonnet-review-round2.md`；主要結論已記錄在此，不依賴暫存檔才能理解交付。
- 正式採納時的來源模板整合、ADR／Policy／手冊引用同步已列入設計稿後續事項，沒有阻止本輪文件交付的使用者決策。
- Gate B：未執行 renderer 或完整工作流程；沒有 `saintber-intent` 實作可做代理驗收。文字及代理校閱不代表使用者人工驗收。
- 提交由 Codex 依使用者既有授權另行處理；提交草案不等於採納新增治理規則。

## Final Status

- **Done，限 Intent 管理草案、技能設計說明、範本與導覽，以及已記錄的文件校閱。** ADR-0006 與新增規範仍待正式採納；`saintber-intent` 尚未實作，不宣稱 CLI、renderer 或代理端到端驗收通過。
