# 設計提案（proposals）

本目錄放 Hub 的**設計提案**：需求分析、方案探索、候選方案、待決事項、直接開發的設計與驗證紀錄，以及尚未成立的 Tool 的方向草稿。

位置依 [ADR-0005](../architecture/decisions/0005-proposals-location-and-development-process.md)：所有一般開發提案放在所屬專案的 `docs/proposals/`（原位置是 `docs/architecture/proposals/`，見該 ADR 的遷移映射）；`docs/architecture/` 只放現行架構、ADR 與已採納的設計附件。

> 文件放在這裡或寫成草稿，**本身不等於批准**；它沒有現況（描述性架構）、Policy 或有效規格的效力，也**不代表**功能已實作。在既有授權內經審閱確認的本次設計，可以作為本次實作的基準。探索階段的主稿稱為**設計稿／草案**；同一份主稿可以在不同章節補上直接開發的技術方案，驗證紀錄則是技術設計階段的證據。文件**不會因為放在 `proposals/` 就都算探索**（用詞見 [開發流程 §10](../developer-guide/development-workflows.md#10-工作階段與溝通用詞)）。流程與用法見 [開發流程：三種顆粒度](../developer-guide/development-workflows.md)；決策出處見 [ADR-0003](../architecture/decisions/0003-development-workflow-granularity.md)、[ADR-0005](../architecture/decisions/0005-proposals-location-and-development-process.md)。

## 怎麼放

| 情況 | 檔案 |
|---|---|
| 一般情況 | `<topic>.md`（單檔小稿可以合併需求分析與方案探索） |
| 內容多 | `<topic>/intent.md`（選用，需求分析）、`<topic>/design.md`（選用，方案探索），以及選用的 `research.md`、`discussions.md`、`verification.md` |
| Tool 的整體方向 | 該 Tool 的 `docs/proposals/product-direction/`（`design.md`、選用 `roadmap.md`） |
| Tool 尚未成立、owner 未確定 | 暫放本目錄，開頭標明**預計 owner**；Tool 成立後移入其 `docs/` 並修正連結，只保留一份正本 |

既有 Tool 的提案放在該 Tool 自己的 `docs/proposals/`，不放在這裡。

**同一角色一份主稿**：`intent.md`（需求分析）與 `design.md`（方案探索）是不同責任，不是互相競爭的主稿；一個 topic 的同一角色只有一份。早期 `intent.md` 不是正式 change 的 Intent（`docs/intent/<NNN-name>/`，選用）。

需求（Intent）的重要修訂才記錄（日期、改了什麼、為什麼、真實依據；來源不明標 pending），不用 v1／v2 副本；需要保留全文時可選用 `docs/proposals/<topic>/history/intent-<id>.md`（`<id>` 唯一，不覆寫） 唯讀快照。詳見 [Intent 管理](../developer-guide/intent-workflow.md)。

## 每份提案開頭要寫

```markdown
- 狀態：草稿 / 審閱中 / 已確認（本次實作基準）/ 實作中 / 已實作（結案）/ 已轉為 change <NNN-name> / 已撤回
- 預計 owner：（只在暫放 Hub 時需要）
- 目前決策：已確定的取捨與核准來源；沒有就寫「尚無」
- 本次範圍：
- 尚未實作：
```

轉為 change 時，在主稿末尾的「轉換紀錄」表追加一列（範圍、change 與目前位置、來源 commit、日期）；格式與代理的判斷順序見 [開發流程 §11](../developer-guide/development-workflows.md#11-探索稿的轉換紀錄)。紀錄空白或矛盾不等於沒有轉換。建立或更新設計稿可以使用 `saintber-design` 技能（[開發流程 §12](../developer-guide/development-workflows.md#12-流程配套工具saintber-design-與-spec-kit-指令)）。

- 草稿與尚未實作的設計可以修改；Tool 的方向文件可以持續演進。
- **結案的**提案（已實作、已轉為 change、已撤回）留在原處作為歷史：設計、驗證與採納紀錄不改寫，只更新導覽、連結、狀態等必要 metadata；後續變更開新的 topic 或 change。
- 已採納的設計版本（例如 ADR 附件中的設計快照）與已採納 ADR 放在 `decisions/`，是唯讀快照，不放在這裡。

## 目前的提案

| 文件 | 狀態 | 備註 |
|---|---|---|
| [`speckit-extension-design.md`](speckit-extension-design.md) | 待使用者確認 | Spec Kit 擴充的完整構想、目前實作與未完成部分 |
| [`task-team-design.md`](task-team-design.md) | 待釐清，尚未實作 | 按任務啟動 AI 團隊；目錄歸屬待決，設定草稿見 [`task-team-config.example.json`](task-team-config.example.json) |
| [`intent-management/design.md`](intent-management/design.md) | 草案（管理規則待採納） | 文件交付與校閱已完成，見 [驗證紀錄](intent-management/verification.md)；`saintber-intent` 技能已另行實作（見該設計稿「現況」），規則仍待採納 |
| [`saintber-intent-delivery/verification.md`](saintber-intent-delivery/verification.md) | 已完成（結案） | 需求分析技能的三代理入口、隔離行為驗證、文件校閱及實際驗證範圍 |
| [`development-workflow-granularity/verification.md`](development-workflow-granularity/verification.md) | 已完成（結案） | 本次流程文件更新的驗證紀錄；設計見 ADR-0003 |
| [`development-phase-terminology/verification.md`](development-phase-terminology/verification.md) | 已完成（結案） | 四個工作階段與溝通用詞的整合紀錄 |
| [`exploration-conversion-tracking/verification.md`](exploration-conversion-tracking/verification.md) | 已完成（結案） | 轉換追蹤流程與 Claude 隔離代理驗證；決策見 ADR-0004 |
| [`forge-design-delivery/verification.md`](forge-design-delivery/verification.md) | 已完成（結案） | 指令、部署、獨立校閱及實際驗證範圍 |
