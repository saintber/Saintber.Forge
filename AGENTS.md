# AGENTS.md

- All conversations MUST be conducted in Traditional Chinese (zh-TW)
- Spec Kit 的指令是**技能形式**，用連字號（不是舊版的 `/speckit.specify`）：
  - Claude Code：`/speckit-specify` 等；技能在 `.claude/skills/speckit-*`
  - Codex：`$speckit-specify` 等；技能在 `.agents/skills/speckit-*`
  - 這些由 Spec Kit v1.1.0 的 CLI 產生，**不要手動編輯**；要升級請用 `specify integration upgrade`，升級後重跑 `node tooling/speckit/install.mjs --project-dir <專案>`。

## 專案結構

這個 repo 是 **Hub**（`saintber` 工具集入口），各工具在 `projects/<id>/` 底下，各自有自己的 `.specify/`、文件與憲章。

- 設計與遷移計畫：[`採納時的設計（快照）`](docs/architecture/decisions/0001-attachments/design-2026-10-adopted.md)（已採納）；目前進度見 [`遷移狀態`](docs/migration-status.md)。
- 快照提供方向，**不是後續開發的完整需求**；詳細需求以新的 Spec Kit change 討論並確立。本次遷移交付範圍依 [`ADR-0002`](docs/architecture/decisions/0002-migration-delivery-scope.md)，未完成功能列後續事項，不安排第二階段。
- 文件導覽：[`docs/README.md`](docs/README.md)
- Spec Kit 與 SDD 文件的使用方式：[`docs/developer-guide/speckit-workflow.md`](docs/developer-guide/speckit-workflow.md)
- 並行開發與目錄範本：[`worktree 開發指引`](docs/developer-guide/parallel-development.md)。小粒度 skill 可直接開發，不強迫建立 Spec Kit 工作包；適用治理與必要驗證仍須遵守（ADR-0002）。

## 處理 `projects/<id>/` 的工作時

- 以該目錄內的 `.specify/`、憲章與 `docs/governance/policy/` 為準，**不要**把工作包建立在 Hub 的 `specs/`。
- Spec Kit v1.1.0 會往上找最近的 `.specify/`，所以**在該專案目錄內執行**指令即可。要從別處指定專案，設環境變數 `SPECIFY_INIT_DIR` 指向專案目錄；路徑無效時它會報錯，不會退回 Hub。
- 目前各專案的憲章與 Policy：
  - Hub：憲章 `.specify/memory/constitution.md`，**Active（v1.0.0，2026-10-06 由使用者批准）**；Policy 在 `docs/governance/policy/`（八份已撰寫，適用範圍與後續項目見索引）。
  - forge-explorer：憲章 `projects/forge-explorer/.specify/memory/constitution.md`，**Active v1.1.0（2026-10-07 修訂）**；Policy 在其 `docs/governance/policy/`。

## Hub 擴充指令（context、adopt、archive）

- 使用 Spec Kit 流程時，先執行 `speckit-hub-context`（可帶專案 ID），確認目標專案與模式，並讀它列出的憲章與 Policy 索引。**它報錯時就停止**，不要改用別的專案或 Hub 根目錄。直接開發的小型工作自行確認同樣的目標與適用治理，不必為此啟動整套 Spec Kit。
- `speckit-hub-adopt`／`speckit-hub-archive` 已有實作，但完整設計與格式仍待確認，見 [`擴充設計稿`](docs/architecture/proposals/speckit-extension-design.md)。使用這些腳本時，被拒絕就照錯誤處理，**不要手動改有效規格來繞過**；小型工作不因此被強迫使用它們，仍須有驗證與相應規格採納紀錄。
- 這些指令都**不會自行** stage 或 commit；提交由另外取得使用者授權的提交流程處理。
- 已知限制（plan 的 Policy Check、編號掃描）見 `docs/developer-guide/speckit-workflow.md` 的「已知限制」。
