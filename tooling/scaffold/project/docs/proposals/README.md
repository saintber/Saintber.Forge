# <project-id> 設計提案

本工具的設計提案：需求分析、方案探索、候選方案、待決事項、直接開發的設計與驗證紀錄，以及整體方向（`product-direction/`）。位置依 Hub ADR-0005：`docs/proposals/`，不在 `docs/architecture/` 底下。放在這裡本身不等於批准，也沒有現況、Policy 或有效規格的效力；在既有授權內經審閱確認的本次設計，可以作為本次實作的基準。結案的提案留在原處，不改寫內容。

流程與目錄見 Hub 的 `docs/developer-guide/development-workflows.md`（遷出後改為本地快照或有版本的網址）。

| 情況 | 檔案 |
|---|---|
| 一般情況 | `<topic>.md`（可合併需求分析與方案探索） |
| 內容多 | `<topic>/intent.md`（選用，需求分析）、`<topic>/design.md`（選用，方案探索），以及選用的 `research.md`、`discussions.md`、`verification.md` |
| 本工具的整體方向 | `product-direction/design.md`，選用 `roadmap.md`；內容少時用單一 `product-direction.md` |

同一角色一份主稿：需求分析與方案探索是不同責任，不是互相競爭的主稿。早期 `intent.md` 不是正式 change 的 Intent。

每份提案開頭寫：狀態、目前決策、本次範圍、尚未實作。範本見 [`_template.md`](_template.md)。

目前沒有提案。
