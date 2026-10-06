# ADR-0001：Hub 與 Project 分層

| 項目 | 內容 |
|---|---|
| 狀態 | **Accepted**（2026-10-05 採納） |
| 決策者 | 使用者（saintber） |
| 起草與審閱 | Claude 撰寫；Codex 審閱（兩輪）；使用者採納 |
| 完整設計 | [`0001-attachments/design-2026-10-adopted.md`](0001-attachments/design-2026-10-adopted.md)（採納時的原始設計，**唯讀快照，不再更新**） |

## 背景

這個 repo 原本是 `Saintber.Forge` 命名空間下的 .NET 探索性小工具集合。目標改為：建立一個**工具集的入口專案**，負責發現、安裝、設定、啟動各種工具；各工具的初期開發也在這裡進行，規模變大後遷到獨立 repo，但仍可透過入口安裝。

預計的工具：原本的探索性工具集（改名 forge-explorer）、AI 助理、AI 佇列、AI 技能、PowerShell 工具、Node.js 工具。

## 決策

1. **Hub / Tool / Shared 三層。** Hub 只負責路由與入口取得；工具自己持有安裝、設定、執行、狀態與安裝範圍；Shared 是有 owner 與版本契約的共用程式碼，有實際需求才建立。
2. **目錄**：`projects/<id>/` 放工具；Hub 的 CLI 在根目錄 `src/`；`workspace.json`（在哪裡開發）與 `catalog/index.json`（命令指向哪個入口包）分開。
3. **巢狀 CLI**：`saintber <前綴> <操作> [參數...]`。Hub 把參數原樣轉交給工具；工具也可被直接呼叫，兩者走同一套實作。
4. **Hub 不持有工具的安裝狀態**，狀態以工具公開的 `status` 為準，查不到就是 `unknown`。
5. **規格三層**：有效規格（`docs/specifications/`，以 capability 劃分）、工作包（`specs/`）、封存（`archive/changes/`）。
6. **Policy 有自己的位置**：`docs/governance/policy/`，用 frontmatter 的 `scope` 與 `applies-to` 接進 Spec Kit 各階段；例外必須由 owner 核准。
7. **套件**：各 Node 工具可以有自己的 `private: true` 的 `package.json` 與 lockfile；不啟用 workspaces；只有 Hub 發佈 npm 套件。
8. **Hub 的 Node 最低版本 24**，以明確的 major 清單與平台測試矩陣管理；工具的 runtime 由工具自己定義。
9. **Spec Kit 直接使用固定的上游版本**，不維護客製化副本。
10. **發佈**用 `scripts/release/`（只在 tag 觸發、需要憑證），與唯讀的 `scripts/ci/` 分開；Hub **不部署**工具，所以沒有 `cd/`。

## 為什麼

最主要的取捨：

- **工具自主，而非 Hub 集中管理**：最初的設計讓 Hub 負責依賴排序、參數合併、PATH 與安裝狀態。這會讓 Hub 必須理解每個工具的內部，也讓工具無法獨立運作。改為 Hub 只轉交，工具才能被直接呼叫、被遷出、以不同技術實作。
- **`package.json`**：使用者最初要求育成期整個 repo 只有一個。但工具的 CLI 要能單獨執行，就必須自己解析依賴；拆出時也需要另外產生檔案。最後選擇**允許 private 的 `package.json`**，仍保留「只有 Hub 發佈 npm」。
- **Policy 不放進憲章**：`/speckit.constitution` 常把具體規範判定為不屬於憲章。憲章只放一條引用原則，規範放 Policy，並靠模板、上下文載入與驗收共同保護，不依賴單一機制。
- **Hub 的 Node 版本**：原本寫「現行 Active LTS 是 22」，查證後是 24；改用明確的 major 清單，而不是沒有上限的 `>=`。

## 後果

- 工具要自己實作 install / configure / run，成本由工具承擔。
- Hub 無法回答「裝了哪些工具」，只能逐一詢問工具的 `status`。
- 遷出需要處理的項目要明確列出，不能假設純 `git subtree split` 就夠。
- 設計稿本身不再是權威：**現況由 `docs/architecture/` 與 Policy 負責**（憲章原則 VI）。

## 被取代紀錄

> 記錄附件設計稿中哪些章節已被後來的決策或實作取代。**附件本身不改**；這裡標示現況在哪裡。

| 章節 | 狀態 | 現況在哪裡 |
|---|---|---|
| §15.2 最後一列（設計稿採納後移到 `archive/governance/design/`） | **已修正** | 改為本 ADR 的附件，不放 `archive/`：`archive/` 的語意是「預設不被讀作需求」，但設計稿是需要被追溯的決策來源 |
| §15.3 步驟 10（封存設計稿）、§1 表頭的「原稿」 | **已實現**：設計稿 `design.md` 已從根目錄移除，內容完整保留在附件快照；兩份比較用的原稿（Claude、Codex 各一）依使用者決定**不保留** | 附件快照 |
| §13（Spec Kit：本地舊版 vs 上游） | **已實現，採路線 1** | 升級到上游 v1.1.0，捨棄客製化；見 [`tooling/speckit/README.md`](../../../tooling/speckit/README.md) |

之後每當一個章節被實作或推翻，在此表新增一列。

## 設計稿拆分的進度

設計稿的內容依性質逐步拆到各自的正本（憲章原則 VI）。**尚未拆出的部分，在拆出之前仍以附件為準**，但要注意附件不會再更新。

| 內容 | 目標位置 | 狀態 |
|---|---|---|
| 規範：目錄、依賴方向、遷出 | Policy `POL-STRUCT` | 尚未撰寫 |
| 規範：文件類別、唯一 owner | Policy `POL-DOC` | 尚未撰寫 |
| 規範：規格生命週期 | Policy `POL-SPEC` | 尚未撰寫 |
| 規範：Spec Kit 使用 | Policy `POL-SPECKIT` | 尚未撰寫 |
| 規範：呼叫契約 | Policy `POL-INVOKE` | 尚未撰寫 |
| 規範：安全、測試、完成條件 | `POL-SEC-001`、`POL-TEST-001`、`POL-DOD-001` | **已撰寫**（部分，見各檔） |
| 現況：Hub / Tool / Shared 結構、CLI 路由、資料流 | `docs/architecture/` | 尚未撰寫（CLI 尚未實作，沒有「現況」可寫） |
| 使用手冊 | `docs/user-guide/` | 尚未撰寫 |
