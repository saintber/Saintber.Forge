# Herdr 開發輔助工具

這裡維護開發時使用的 Herdr pane 版面腳本。它是 repo 開發工具，不是獨立 Tool project，也不是 AI 助理或 AI 佇列的實作。

判斷依據：腳本只透過 Herdr CLI 新增、排列與調整 pane，不啟動 agent、不派工；原設計也明確排除 npm 發行。使用 Node.js 是執行技術，不代表它必須屬於 Node.js 產品專案。

| 檔案 | 用途 |
|---|---|
| `grid.cjs` | 每次新增一個 pane，維持接近方形的網格，並提供查詢與平均分配 |
| `grid-simulate.cjs` | 離線驗證欄列成長序列，不呼叫 Herdr |

## 使用

需要 Node.js 與 Herdr CLI；實際操作版面時依原設計在 Herdr 環境內執行（`HERDR_ENV=1`）。沒有第三方 Node 相依，不需要 `npm install`。從 repo 根目錄執行：

```powershell
node tooling/herdr/grid.cjs split --workspace Personal --tab 2 --cwd "C:\path\to\worktree" --name reviewer
node tooling/herdr/grid-simulate.cjs
```

完整操作、限制與復原方法見 [Herdr 網格使用說明](../../docs/developer-guide/herdr-grid.md)。腳本本身不依賴 repo 工作目錄，也可使用腳本的絕對路徑執行。

## 維護與歷史

- 目前由 Hub 的開發工具目錄維護，適用 Hub 憲章與 Policy；不建立自己的 `.specify/`、project descriptor 或 workspace 登錄。
- [匯入紀錄與原始 OpenSpec 文件](../../archive/changes/2026-10-02-herdr-grid-layout/archive.md) 保留舊設計、規格、任務與人工驗證陳述。本次只驗證歸檔與離線序列，沒有重新驗證真實 Herdr 互動，也沒有採納為 Hub 有效規格。
- 本次沿用 `.cjs` 與兩支腳本的相鄰位置，保留 CommonJS 載入方式與既有功能。後續維護依工作大小選流程，不沿用原專案的開發指令。
- 若未來要提供使用者安裝，再於 Node.js 或 AI 工具集專案中討論產品歸屬、公開契約與安裝需求；依使用者指示，不把 Herdr 輔助腳本獨立成 project。
