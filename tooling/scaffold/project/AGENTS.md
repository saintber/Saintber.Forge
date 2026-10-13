# <project-id> 代理指引（範本）

- 使用繁體中文。複製到實際專案後先補 owner、目的與技術。
- 只操作本工具授權範圍；不載入其他工具或 Hub 的內部實作。
- workspace 開發時讀 Hub 憲章與適用 Policy，加上本工具自己的治理。
- 依需求性質選流程（Hub `docs/developer-guide/development-workflows.md`）：範圍清楚的工作直接開發，設計與驗證紀錄放 `docs/architecture/proposals/`；需要完整需求流程時才開 Spec Kit 工作包；整體方向放 `docs/architecture/proposals/product-direction/`。
- **未初始化自己的 `.specify/` 前，停止 Spec Kit 操作，不退回 Hub。** 不使用 Spec Kit 時不需要初始化。初始化請用固定上游 CLI，不手改產生檔案；Tool 工作包只能在本目錄 `specs/`。
- 未初始化時，Hub 憲章與適用 Policy 仍然適用；不偽造本工具的憲章，也不複製 Hub 憲章。
- 變更現行規格須經驗證與採納；候選工作包和封存歷史不當成現況。
