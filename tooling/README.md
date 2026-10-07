# Repo 開發工具

這裡放開發本 repo 使用的工具，不是供 saintber 安裝的產品工具。

- [`speckit/`](speckit/README.md)：上游版本、Hub 擴充原始碼、測試與安裝器。
- [`scaffold/`](scaffold/README.md)：靜態 Tool 目錄範本，不是自動產生器，也沒有自動設定治理。
- [`herdr/`](herdr/README.md)：開發時新增與整理終端 pane 的 Node.js 腳本；不是獨立 project，也不隨 saintber 發行。

供使用者安裝的 skill／工具放在其 `projects/<id>/`；只輔助 repo 開發的自製 skill 可在 `tooling/skills/<name>/` 維護來源。不要手改 Spec Kit CLI 管理的 `speckit-*` 技能；產品入口與安裝方式需各自討論。
