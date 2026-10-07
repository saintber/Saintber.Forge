# Herdr grid 舊資料匯入紀錄

- 原 change ID：`herdr-grid-layout`；原封存日期：2026-10-02（依 `.openspec.yaml`）。
- 本次匯入日期：2026-10-07。
- 狀態：外部已封存 OpenSpec 歷史匯入；**不是本次 Hub adopt／archive 的結果**，也不是 Hub 有效規格。
- 歸檔前基線：`ca75b24`；原始資料由使用者放在未追蹤的根目錄 `herdr/`，不屬於該 commit。
- 授權與範圍：使用者要求判斷工具性質、依現有目錄架構歸檔，且禁止建立獨立 Herdr project。沒有新增產品功能或重新核准原規格。

## 位置對照

| 匯入來源（原根目錄下） | 現在位置 |
|---|---|
| `herdr/herdr/grid.cjs` | [`tooling/herdr/grid.cjs`](../../../tooling/herdr/grid.cjs) |
| `herdr/herdr/grid-simulate.cjs` | [`tooling/herdr/grid-simulate.cjs`](../../../tooling/herdr/grid-simulate.cjs) |
| `herdr/herdr/README.md` | [`inputs/herdr-README.md`](inputs/herdr-README.md)，原文保留；現行入口在 [`tooling/herdr/README.md`](../../../tooling/herdr/README.md) |
| `herdr/grid.md` | [`inputs/grid.md`](inputs/grid.md)，原文保留；更新路徑後的使用手冊在 [`docs/developer-guide/herdr-grid.md`](../../../docs/developer-guide/herdr-grid.md) |
| `herdr/2026-10-02-herdr-grid-layout/` | [`work/`](work/)，五份原始 OpenSpec 檔案完整保留 |

原始資料的 SHA-256 見 [`inputs/source-manifest.json`](inputs/source-manifest.json)。目錄加上 `legacy-` 前綴以辨識外部歷史，日期不當作 Spec Kit 工作包編號。`work/verification.md` 是匯入時新增的歸檔驗證紀錄，其他 `work/` 內容與 `inputs/` 原文不改寫。

2026-10-07 更正：原匯入名稱 `2026-10-02-herdr-grid-layout` 會被既有 context 編號掃描當作第 2026 號 change，因此更名為 `legacy-herdr-grid-layout-2026-10-02` 並更新導覽。搬移時十份檔案的 SHA-256 全部一致；沒有修改上游或 Hub 擴充程式。更正後 context 回報下一號為 `002`，原始 `work/` 與 `inputs/` 內容仍保留。

### Verification Record — legacy-name-correction-2026-10-07

- Scope：修正外部歷史名稱造成的編號誤判；基線 `1e3094c`。
- Environment：本機 Windows／PowerShell，Node.js v24.19.0。
- Gate A：無新增相依或程式變更，不需還原／建置；搬移前後十份檔案 SHA-256 核對一致。執行 `node .specify/extensions/hub/scripts/context.mjs --json --project hub`，exit 0，`nextChange` 從 `2027` 回到 `002`；目前唯一編號工作包仍為 `001-stage1-speckit-extension`。更新的三份導覽與本紀錄相對連結均存在，`git diff --check` 通過。
- Gate B：本次沒有 Herdr 互動變更，不需重新操作 pane；原手冊與原工作包保留原文。
- Docs Consistency：archive 索引、Herdr 手冊與 tooling/herdr README 指向新名稱；不改變能力或治理，也不手改有效規格。
- Final Status：Done，限名稱與引用更正。

## 判定與規格狀態

程式只負責開發用終端版面，故歸入 `tooling/herdr/`。它不負責安裝 saintber，不是 CI／release 腳本，沒有產品安裝入口，也不依賴 AI 工具集內部。

[`work/specs/herdr-grid/spec.md`](work/specs/herdr-grid/spec.md) 是舊 OpenSpec delta；原任務記載曾由使用者人工驗證及封存，但本次沒有重新執行真實 Herdr 流程。因此不直接複製成 `docs/specifications/` 的有效規格，也不把它搬進活動中的 Hub `specs/`。需要正式補建有效規格或變更功能時，再核對原規格、程式與驗證證據。

本次驗證見 [`work/verification.md`](work/verification.md)。歷史檔案中的 `tools/`、`openspec/`、`spectra` 與 commit 名稱保留原貌，是舊環境的追溯資訊；現行操作以新的使用手冊為準。
