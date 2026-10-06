# AGENTS.md

- All conversations MUST be conducted in Traditional Chinese (zh-TW)
- Spec Kit 的 slash command 是**技能形式**，用連字號呼叫，例如 `/speckit-specify`、`/speckit-plan`（不是舊版的 `/speckit.specify`）。
  - Claude Code：`.claude/skills/speckit-*`
  - Codex：`.agents/skills/speckit-*`
  - 這些由 Spec Kit v1.1.0 的 CLI 產生，**不要手動編輯**；要升級請用 `specify integration upgrade`。

## 專案結構

這個 repo 是 **Hub**（`saintber` 工具集入口），各工具在 `projects/<id>/` 底下，各自有自己的 `.specify/`、文件與憲章。

- 設計與遷移計畫：[`design.md`](design.md)（已採納，遷移進行中，分支 `hub/000-restructure`）
- 文件導覽：[`docs/README.md`](docs/README.md)
- Spec Kit 與 SDD 文件的使用方式：[`docs/developer-guide/speckit-workflow.md`](docs/developer-guide/speckit-workflow.md)

## 處理 `projects/<id>/` 的工作時

- 以該目錄內的 `.specify/`、憲章與 `docs/governance/policy/` 為準，**不要**把工作包建立在 Hub 的 `specs/`。
- Spec Kit v1.1.0 會往上找最近的 `.specify/`，所以**在該專案目錄內執行**指令即可。要從別處指定專案，設環境變數 `SPECIFY_INIT_DIR` 指向專案目錄；路徑無效時它會報錯，不會退回 Hub。
- 目前各專案的憲章與 Policy：
  - Hub：憲章**尚未撰寫**（目前是空白模板）；Policy 在 `docs/governance/policy/`。
  - forge-explorer：憲章 `projects/forge-explorer/.specify/memory/constitution.md`；Policy 在其 `docs/governance/policy/`。

## 尚未實作的指令

`design.md` §13.4 規劃的 `context`、`adopt`、`archive` 指令**還不存在**。在它們完成之前，完成並驗證一個工作包後，依 `design.md` §12.5、§12.6 手動合併有效規格並封存；不要自動 stage 或 commit。
