# <project-id> 文件

- `user-guide/`：安裝、設定、執行及疑難排解。
- `developer-guide/`：本工具開發、建置、驗證與部署。
- `architecture/`：現況架構；其 `decisions/` 記錄 ADR，`proposals/` 放設計提案、直接開發的設計與驗證紀錄、整體方向（`proposals/product-direction/`）。
- `governance/policy/`：專屬 Policy 與 Hub 繼承基線。
- `intent/<NNN-name>/`：本次需求輸入。
- `specifications/<capability>/spec.md`：已驗證並採納的有效規格。

目前是空範本，沒有已批准的專屬規則或有效規格。使用 Spec Kit 的候選工作包放在專案 `specs/`，完成後的歷史放在 `archive/changes/`；不使用 Spec Kit 時這兩個目錄保留為空骨架，不建立工作包。流程選擇見 Hub 的 `docs/developer-guide/development-workflows.md`。
