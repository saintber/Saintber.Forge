# Tool 目錄範本

[`project/`](project/) 是靜態範本，實際開始新工具時複製到 `projects/<id>/`。目錄名稱與文件責任已確定；目前不是可用專案，沒有 package.json、入口 manifest 或 Spec Kit 設定。

複製後先改 README、AGENTS、Policy 索引中的 `<project-id>`，確認 owner 與技術；再把實際專案登錄到 `workspace.json`。需要 Spec Kit 時，以固定上游 CLI 在工具根目錄初始化自己的 `.specify/` 與兩種整合，制定自己的憲章，再從 Hub 執行擴充安裝器。

**不要把範本或新工具暫時當成 Hub 的 Spec Kit 專案。** 沒有自己的 `.specify/` 前不執行 Spec Kit，以免往上解析到 Hub。小型直接開發可先使用已複製的目錄與適用治理，不依賴 Spec Kit 初始化。

操作例子見 [並行開發指引](../../docs/developer-guide/parallel-development.md)。未開始的工具不預先建立空專案；本範本只固定其未來內容位置。
