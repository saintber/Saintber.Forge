# Repo 開發工具

這裡放開發本 repo 使用的工具，不是供 saintber 安裝的產品工具。

- [`speckit/`](speckit/README.md)：上游版本、Hub 擴充原始碼、測試與安裝器。
- [`scaffold/`](scaffold/README.md)：靜態 Tool 目錄範本，不是自動產生器，也沒有自動設定治理。
- [`herdr/`](herdr/README.md)：開發時新增與整理終端 pane 的 Node.js 腳本；不是獨立 project，也不隨 saintber 發行。
- [`team/`](team/README.md)：按任務啟動並協調 AI 團隊的執行程式（Node 24、零外部依賴）與測試；所有 pane 都經 `herdr/grid.cjs` 新增。協作規則的正本在下面的技能。有效規格見 [`task-team`](../docs/specifications/task-team/spec.md)。
- [`skills/task-team/`](skills/task-team/README.md)：上述團隊的技能正本與三入口安裝器；入口是含本機絕對路徑的本機產物，不提交。

供使用者安裝的 skill／工具放在其 `projects/<id>/`；只輔助 repo 開發的自製 skill 可在 `tooling/skills/<name>/` 維護來源。不要手改 Spec Kit CLI 管理的 `speckit-*` 技能；產品入口與安裝方式需各自討論。
