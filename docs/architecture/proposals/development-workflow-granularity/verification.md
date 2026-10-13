# 驗證紀錄：三種顆粒度開發流程的文件更新

- 狀態：文件更新與 Codex 校閱完成；提交由提交流程另行處理
- 流程：A 直接開發（只改文件與靜態目錄範本，不使用 Spec Kit）
- 引用的設計：[ADR-0003](../../decisions/0003-development-workflow-granularity.md)（使用者 2026-10-13 核准的方向）；流程正本 [開發流程：三種顆粒度](../../../developer-guide/development-workflows.md)。本紀錄不重寫設計內容。
- baseline-commit：`67f6ad5`（`backlogs/hub-restructure`，開始時工作目錄乾淨）
- 受影響的 capability：不影響有效規格

## 範圍

- 新增流程正本、ADR-0003、Hub 與範本的 `proposals/` 入口與提案範本。
- 補充 Hub Policy（POL-DOD R7 位置、POL-SPEC R9a、POL-SPECKIT 適用範圍、POL-DOC R1／R2／R9／R10、POL-STRUCT R3）與 Policy 索引；forge-explorer DOD 只加位置補充註記，原文保留。
- 同步根 README、AGENTS、docs 導覽、developer-guide、Tool 範本與 forge-explorer 的引用。
- 依 Codex 校閱修正（R1–R7、三項操作一致性、§5.3 擴充安裝的執行路徑）。

不在範圍：憲章、ADR-0001／0002、設計快照、CLI 產生的 `speckit-*`、有效規格、`001-stage1-speckit-extension`、程式碼。

## 環境

- 本機 Windows；Node v24.19.0（只用來執行唯讀的文件檢查腳本，腳本放在系統暫存目錄，不在 repo）。

## Gate A

純文件變更，沒有建置或測試單位。依 POL-DOD-001 R3 第 3 點，以**可重現的最小驗證**代替：

| 檢查 | 方法 | 結果 |
|---|---|---|
| 本機連結與章節錨點 | 對本次新增或修改的 27 份 Markdown（含本紀錄），逐一解析 Markdown 連結的相對路徑與章節錨點 | 132 個連結，**0 個缺檔或錨點不存在** |
| code fence | 每份檔案的三個反引號 fence 數量成對 | 0 個問題 |
| mermaid 標籤 | 3 個 mermaid 區塊中，含 `<br/>` 的節點是否加引號、有無殘留的字面 `\n` | 0 個疑慮 |
| 受保護路徑 | `git status` 檢查 `.specify/`、`.claude/`、`.agents/`、ADR-0001／0002、設計快照、兩邊的 `docs/specifications/`、`specs/`、`archive/`、`tooling/speckit/`、forge-explorer 的 `src/`、`tests/` | **無變更** |
| 變更類型 | 本次變更是否只有 Markdown | 是，沒有非 Markdown 檔案 |
| 矛盾字句 | 搜尋「一律需要」、「必須初始化 .specify」、「各自有自己的 .specify/」、「不產生約束力」、「verification.md 是唯一」，以及在 Tool 根目錄執行 `install.mjs --project-dir <Tool>` 的舊寫法（本紀錄除外） | 0 個 |
| 暫存檔 | repo 根目錄沒有 `.tmp-*` | 已清除 |

## 未執行的項目

- **沒有**在任何 Markdown／mermaid renderer 實際檢視版面；圖表只做了語法層面的檢查。
- **沒有**執行 `.NET` 建置或擴充的 88 項測試：本次沒有改程式；先前的測試結果不能作為本次文件內容的證據。
- **沒有**依新流程實際走一次 A／B／C 的示範；流程的可用性只經過文件審閱。
- 「矛盾字句」是關鍵字搜尋，不能保證找出所有語意上的矛盾；語意一致性依 Codex 校閱。

## Docs Consistency（POL-DOD-001 R6a）

- 檢查的文件：上述範圍內的導覽、指引、Policy、範本與 forge-explorer 引用。
- 偏離已核准設計：無。Codex 已確認 Policy 的補充屬於使用者本次明確批准方向的展開（Policy 索引的 A 類）；ADR-0003 的 Accepted 狀態依據是使用者的明確指示，不是代理自行核准。

## 使用者指定的 Codex 內容校閱

- 日期：2026-10-13；校閱者：Codex（代理校閱，非使用者人工操作或 renderer 驗收）。
- 步驟：逐項核對三種流程的適用情境、目錄樹、輸入、實作基準、驗證與收尾；比對 ADR、Policy、AGENTS、導覽、Tool 範本與 forge-explorer 引用。
- 預期：流程與目錄一致，不強迫直接開發使用 Spec Kit；初始化、編號、封存連結與基線處理可辨識；歷史與現況不混用。
- 結果：Pass。R1–R7、三項操作一致性與安裝工作目錄均已修正；沒有需要使用者另行裁決的事項。forge-explorer DOD 保留原標題，其位置補充已明確說明直接開發也適用驗證循環。
- 獨立自動檢查：Codex 使用另一支暫存 Node 腳本檢查 27 份變更 Markdown、132 個本地連結目標與 fence 配對，0 個錯誤；`git diff --check` 通過。此獨立檢查不含章節錨點與 Mermaid 渲染，後兩者不得因此宣稱已獨立驗證。
- 修改範圍：只有 Markdown；Git index 無變更；受保護的程式、CLI 產生檔、憲章、已採納歷史快照與有效規格均未修改。

## Final Status

- **Done（限本次文件更新與使用者指定的 Codex 校閱）**。本結論不代表產品功能、A／B／C 流程端到端演練或 renderer 驗收完成；未執行項目仍如上所列。
