# 設計提案（proposals）

本目錄放 Hub 的**設計提案**：問題與探索、候選方案、待決事項、直接開發的設計與驗證紀錄，以及尚未成立的 Tool 的方向草稿。

> 文件放在這裡或寫成草稿，**本身不等於批准**；它沒有現況（描述性架構）、Policy 或有效規格的效力，也**不代表**功能已實作。在既有授權內經審閱確認的本次設計，可以作為本次實作的基準。流程與用法見 [開發流程：三種顆粒度](../../developer-guide/development-workflows.md)；決策出處見 [ADR-0003](../decisions/0003-development-workflow-granularity.md)。

## 怎麼放

| 情況 | 檔案 |
|---|---|
| 一般情況 | `<topic>.md` |
| 內容多 | `<topic>/design.md`，選用 `research.md`、`discussions.md`、`verification.md` |
| Tool 的整體方向 | 該 Tool 的 `docs/architecture/proposals/product-direction/`（`design.md`、選用 `roadmap.md`） |
| Tool 尚未成立、owner 未確定 | 暫放本目錄，開頭標明**預計 owner**；Tool 成立後移入其 `docs/` 並修正連結，只保留一份正本 |

既有 Tool 的提案放在該 Tool 自己的 `docs/architecture/proposals/`，不放在這裡。

## 每份提案開頭要寫

```markdown
- 狀態：草稿 / 審閱中 / 已確認（本次實作基準）/ 實作中 / 已實作（結案）/ 已轉為 change <NNN-name> / 已撤回
- 預計 owner：（只在暫放 Hub 時需要）
- 目前決策：已確定的取捨與核准來源；沒有就寫「尚無」
- 本次範圍：
- 尚未實作：
```

- 草稿與尚未實作的設計可以修改；Tool 的方向文件可以持續演進。
- **結案的**提案（已實作、已轉為 change、已撤回）留在原處作為歷史：設計、驗證與採納紀錄不改寫，只更新導覽、連結、狀態等必要 metadata；後續變更開新的 topic 或 change。
- 已採納的設計版本（例如 ADR 附件中的設計快照）與已採納 ADR 放在 `decisions/`，是唯讀快照，不放在這裡。

## 目前的提案

| 文件 | 狀態 | 備註 |
|---|---|---|
| [`speckit-extension-design.md`](speckit-extension-design.md) | 待使用者確認 | Spec Kit 擴充的完整構想、目前實作與未完成部分 |
| [`task-team-design.md`](task-team-design.md) | 待釐清，尚未實作 | 按任務啟動 AI 團隊；目錄歸屬待決，設定草稿見 [`task-team-config.example.json`](task-team-config.example.json) |
| [`development-workflow-granularity/verification.md`](development-workflow-granularity/verification.md) | 待校閱 | 本次流程文件更新的驗證紀錄；設計見 ADR-0003 |
