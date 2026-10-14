# ADR-0006：Intent 保存、版本與多份需求的管理策略

- 狀態：Proposed（管理設計文件已受委託撰寫；新增治理規則尚待 owner 採納，技能尚未實作）
- 日期：2026-10-14
- 文件委託者（不是新增規則的採納紀錄）：`saintber`（使用者本輪詢問是否應有 intent 技能與 Intent 保存、版本、多份需求的策略；Codex 說明建議組合後，使用者回覆「那這部分還有我需要決定的嗎？如果沒有你可以交由 claude 去寫文件，你再去審閱」，指示經由 Codex 轉達；本輪沒有出現需要人類裁決的重大分歧）
- 關聯：[ADR-0005](0005-proposals-location-and-development-process.md)（同一角色一份主稿、正式 Intent 選用、凍結被承接的範圍）、[ADR-0004](0004-exploration-conversion-tracking.md)（轉換紀錄、`saintber-design`）。本 ADR **補充管理細節**，不重寫、不使上述 ADR 失效。操作手冊正本：[Intent 管理](../../developer-guide/intent-workflow.md)；設計與候選策略比較：[`intent-management/design.md`](../../proposals/intent-management/design.md)

## 背景

ADR-0005 確立了早期 `intent.md` 與正式 Intent 的區分，但沒有規定：需求修訂如何記錄、版本的意義、多份需求如何並存與承接、現行與歷史如何讀取，以及是否需要處理需求分析的技能。「唯一」常被誤解為整個 repo 只有一份文件，也有被誤解為必須強制版本號的風險。

## 提議決策

1. **「唯一」的意義**：指同一 owner、同一問題、同一範圍在當下的明確需求依據只有一份；不是整個 repo 只有一份。
2. **Intent 的內容**：問題、目的、期待結果、範圍、限制、未決事項、驗收方向；不是正式行為 spec，不預先選實作方案。有效規格才是已驗證的現況，Intent 不取代它。
3. **早期 Intent**：位置為 `docs/proposals/<topic>/intent.md`（選用）或單檔合併稿；同 topic 同角色唯一，合併與拆分擇一；未結案同稿迭代，不強制版本號；Git 只保留已提交的文字歷史。
4. **重要語意修訂才記錄**：日期、改了什麼、為什麼、真實依據；來源未記錄或未提交時明確 `pending`，不虛構使用者指示或 commit；錯字與措辭不列修訂。
5. **正式 Intent 仍選用**，保留既有的單檔、Intent Version Index、Current Effective Intent 契約，並補充：Index 記重要修訂；現行段落有明確開始與結束邊界；預設只存一份現行完整內容加修訂摘要，完整已提交舊文靠 Git；版本是需求語意的重要修訂，可用簡單序號，不強制 semver；實質改變才換新版本，非語意修正（錯字、措辭）可同號，因此同號代表同一需求語意，精確文字以 Git commit（僅已提交）或已保存快照定位；未提交版本不宣稱 Git 可還原。早期 Intent 不強制版本號，正式 Intent 保留既有索引。範本必須清楚標示示例不是真實事件。
6. **另開與關係**：新獨立問題或能力、已確定結案或封存後的新需求另開 topic 或 change，不當成同需求 v2；同問題的小幅範圍調整可同稿實質修訂，判斷看需求本身，不看字數或檔名。多份 Intent 以延伸、拆分、承接、取代記關係，明示部分或整份並指向實際存在的對象。
7. **多來源匯入 change**：不硬選全域唯一來源，指定承接範圍與來源對照。「唯一」指現行權威：每個範圍只有一份明確的整合現行依據，可引用多個相容的來源並保留範圍／來源／證據對照；同範圍來源矛盾先釐清，未裁決不合併。
8. **承接與演進**：正式輸入承接早期範圍後，只凍結該範圍並記轉換證據。範圍已被活動 change 承接時，不因為沒有正式 Intent 就另開 topic：回報實際 work package 位置（continue-change），早期稿凍結範圍不改，不自行建立正式輸入；只有確定已結案或已封存才另開。活動 change 的正式 Intent 可依版本規則演進，但修訂不自動等於 spec／plan／程式已更新：先判斷受影響的 spec、plan、驗收；有不一致先釐清並更新實作基準與必要驗證，基準未對齊前不續做受影響實作，也不以 Intent 代替 spec；工具不代做其他階段。
9. **里程碑全文快照（選用）**：`docs/proposals/<topic>/history/intent-<id>.md`（正式輸入為 `docs/intent/<NNN-name>/history/intent-<id>.md`），`<id>` 為唯一識別；唯讀，不覆寫既有快照，也不用同一路徑表示不同全文；現行正本明示引用，不是第二份活動 Intent；不強制每次保存，不自動建立、stage 或 commit；屬於 topic 或 change 輸入的局部，不另設全 repo 的需求倉庫；封存腳本按整目錄封存，不需改程式。
10. **技能 `saintber-intent`**：決定**設計**一個處理需求分析的技能（結果 `reuse`／`new`／`continue-change`／`needs-clarification`，識別規則沿用 `saintber-design`；不初始化 Spec Kit，不代為執行 specify、adopt、archive、stage、commit）。**本 ADR 只記錄設計方向，技能尚未實作**，沒有正本、安裝器、代理入口，也沒有可呼叫的指令。

## 影響

- 新增 [`docs/developer-guide/intent-workflow.md`](../../developer-guide/intent-workflow.md) 作為管理擴充草稿正本；`development-workflows.md`、`speckit-workflow.md` 的提案說明、POL-DOC-001 R1 的導航與 P1 及各導覽引用它。R5 與正式 Intent 的既有規則保持不變；採納後才同步規範引用。
- POL-DOC-001 P1 記錄本提案；R5 的現行規則保持不變，owner 採納前不列為已生效的 A 類條文。
- **不修改**：ADR-0001～0005 的正文、憲章、有效規格、封存與已結案歷史、`saintber-design` 的技能與入口、Spec Kit 擴充與腳本（包括 `archive.mjs`）。
- **尚未實作**：`saintber-intent` 技能；任何自動化的修訂記錄、快照或轉換。要實作時另走流程並先審閱設計。
