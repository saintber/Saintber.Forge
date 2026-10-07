# <project-id>

新工具的目錄範本；複製後改成真實專案說明。列出目的、owner、目前實作、使用方法與文件入口；尚未實作的功能標為待討論。

程式在 `src/`，測試在 `tests/`，工具自己的腳本在 `scripts/`；文件見 [`docs/`](docs/README.md)。套件定義在工具根目錄，Node 專案設 `private: true` 並保存自己的 lockfile；不預先建立沒有實作的 saintber 入口。
