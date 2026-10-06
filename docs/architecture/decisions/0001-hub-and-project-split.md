# ADR-0001：Hub 與 Project 分層

| 項目 | 內容 |
|---|---|
| 狀態 | **Accepted**（2026-10-06 採納） |
| 決策者 | 使用者（saintber） |
| 起草與審閱 | Claude 撰寫；Codex 審閱（兩輪）；使用者採納 |
| 設計快照 | [`0001-attachments/design-2026-10-adopted.md`](0001-attachments/design-2026-10-adopted.md)（**唯讀快照**；來源見下方「快照來源」） |

> **ADR 是記錄，不是核准。** 本文只記錄使用者**已核准**的決策。尚未核准的提案列在「待裁決」，不在「決策」中。

## 背景

這個 repo 原本是 `Saintber.Forge` 命名空間下的 .NET 探索性小工具集合。目標改為：建立一個**工具集的入口專案**，負責發現、安裝、設定、啟動各種工具；各工具的初期開發也在這裡進行，規模變大後遷到獨立 repo，但仍可透過入口安裝。

預計的工具：原本的探索性工具集（改名 forge-explorer）、AI 助理、AI 佇列、AI 技能、PowerShell 工具、Node.js 工具。

## 決策（已核准）

1. **Hub / Tool / Shared 三層。** Hub 只負責路由與入口取得；工具自己持有安裝、設定、執行、狀態與安裝範圍；Shared 是有 owner 與版本契約的共用程式碼，有實際需求才建立。
2. **目錄**：`projects/<id>/` 放工具；Hub 的 CLI 在根目錄 `src/`；`workspace.json`（在哪裡開發）與 `catalog/index.json`（命令指向哪個入口包）分開。
3. **巢狀 CLI**：`saintber <前綴> <操作> [參數...]`。Hub 把參數原樣轉交給工具；工具也可被直接呼叫，兩者走同一套實作。
4. **Hub 不持有工具的安裝狀態**，狀態以工具公開的 `status` 為準，查不到就是 `unknown`。
5. **規格三層**：有效規格（`docs/specifications/`，以 capability 劃分）、工作包（`specs/`）、封存（`archive/changes/`）。
6. **Policy 有自己的位置**：`docs/governance/policy/`，用 frontmatter 的 `scope` 與 `applies-to` 接進 Spec Kit 各階段；例外必須由 owner 核准。
7. **套件**：各 Node 工具可以有自己的 `private: true` 的 `package.json` 與 lockfile；不啟用 workspaces；只有 Hub 發佈 npm 套件。（使用者 2026-10-05 裁決）
8. **Hub 的 Node 最低版本 24**，以明確的 major 清單與平台測試矩陣管理；工具的 runtime 由工具自己定義。（使用者 2026-10-05 裁決）
9. **Spec Kit 升級到上游 v1.1.0，捨棄舊版客製化，直接覆蓋；兩份比較用的原稿不保留。**（使用者 2026-10-06 明確核准）
10. **新增 `scripts/release/` 目錄，放發佈腳本，與 `scripts/ci/` 分開；Hub 不部署工具（沒有 `cd/`）。**（使用者 2026-10-06 明確核准）
    - **核准範圍僅限「目錄與責任分工」。**
    - **不包含**下列尚未決定的強制條件：一律僅由 tag 觸發、CI 檔案系統完全唯讀、pack 一律需要憑證。
    - CI 會建置、測試、產生暫存與 artifact；它應禁止的是對外發布、部署，以及使用發佈憑證。pack 與 verify 可以在 CI 本機驗證，不一定需要憑證。
    - 發佈的觸發策略尚待另行決定。
11. **設計快照保存在本 ADR 的附件，維持現址 `docs/architecture/decisions/0001-attachments/design-2026-10-adopted.md`。**（使用者 2026-10-06 明確同意：「同意放在現在位置就好」）
    - **核准範圍僅限「本次這份設計快照的保存位置」。**
    - **不是**新增 Policy：不代表未來所有設計稿都必須如此保存。
    - **不代表**憲章已正式批准、剩餘的遷移項目已完成，或附件中尚未核准的強制條件（僅 tag 觸發、CI 完全唯讀、pack 一律憑證）已獲批准。
    - 快照**沒有移動**，其正文與 git 歷史**沒有修改**，也沒有回復任何 commit。

## 待裁決（尚未核准，**不是**已採納的決策）

目前**沒有**待裁決的事項。

> 先前的 P1（設計快照的存放位置）已於 2026-10-06 由使用者裁決，記為決策 11。

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
- 設計稿是**採納時的歷史快照**，不是持續維護的文件。現況由 `docs/architecture/` 負責，規範由 Policy 負責（憲章原則 VI）。

## 快照來源

附件是**使用者採納設計之後**，保存在 repo 中的 `design.md` 版本（commit `8fb3bcf`；blob `c8ceddc6fd8a0576fed90c9ffd9664d13026a78c`）。

| 項目 | 內容 |
|---|---|
| 附件正文 | 與 `8fb3bcf:design.md` 相同（已驗證；僅行尾 CRLF/LF 不同）；附件前面另加了 3 行註解 |
| 使用者採納設計的時間 | 2026-10-06（本 ADR 的採納日期）。設計稿的內容日期是 2026-10-05 起草、2026-10-06 定稿 |
| 與 `8875efd:design.md` 的差異 | `8fb3bcf` 比 `8875efd`（blob `4ab3519d8786b925039163081b5ae6210e01635d`，搬移 .NET 之前）多 +18 / −3 行，內容是 `scripts/release/`、CI 與發佈的敘述。完整差異：`git diff 8875efd 8fb3bcf -- design.md` |
| 這些差異的狀態 | **目錄與責任分工已由使用者於 2026-10-06 明確核准**（決策 10）。差異中的「一律僅由 tag 觸發」「CI 檔案系統完全唯讀」「pack 一律需要憑證」等強制條件，**未包含在核准範圍內**，附件中這些字句不具約束力 |
| 保存方式 | 依使用者指示，**保留現有 git 歷史**，不回溯 commit、不重寫歷史、不從 `8875efd` 重做快照 |

注意：附件含有上述尚未核准的強制條件字句。**以決策 10 的範圍為準**，不以附件字句為準。

## 實現與進度（**不是**決策變更，也不是 superseded）

> 記錄快照中的規劃在實作上走到哪裡。**只有經核准的決策變更才會標為 superseded**；這裡的條目都不是。

| 快照章節 | 狀態 | 說明 |
|---|---|---|
| §13（Spec Kit） | 已依決策 9 實現；§13.4 新增指令已實作為擴充 | 上游 v1.1.0；擴充 `hub`：指令全名為 `speckit.hub.context / adopt / archive`（上游要求 `speckit.<擴充>.<指令>`，快照的簡寫無法載入；**命名細節，不改架構與決策**）。多代理安裝以 `tooling/speckit/install.mjs`。見 [`specs/001-stage1-speckit-extension`](../../../specs/001-stage1-speckit-extension/verification.md) |
| §4、§14.2（`scripts/release/` 目錄與責任） | 已核准（決策 10）；**目錄與腳本尚未建立** | 範圍限制見決策 10 |
| §15.3 步驟 3–4（搬移 .NET、重跑 build / 測試） | 已完成 | 證據見 [`docs/migration-status.md`](../../migration-status.md) |
| §15.3 步驟 5、6、9 | 已完成（待 U1/U2 的 owner 審閱內容） | 有效規格已補建（forge-explorer 三個 capability）；五份★Policy 已撰寫；見 `migration-status.md` |

## 設計稿拆分的進度

設計稿的內容依性質逐步拆到各自的正本（憲章原則 VI）。**尚未拆出的部分，在拆出之前仍以快照為準**，但快照不會再更新。

| 內容 | 目標位置 | 狀態 |
|---|---|---|
| 規範：目錄、依賴方向、遷出 | Policy `POL-STRUCT` | 尚未撰寫 |
| 規範：文件類別、唯一 owner | Policy `POL-DOC` | 尚未撰寫 |
| 規範：規格生命週期 | Policy `POL-SPEC` | 尚未撰寫 |
| 規範：Spec Kit 使用 | Policy `POL-SPECKIT` | 尚未撰寫 |
| 規範：呼叫契約 | Policy `POL-INVOKE` | 尚未撰寫 |
| 規範：安全、測試、完成條件 | `POL-SEC-001`、`POL-TEST-001`、`POL-DOD-001` | 已撰寫（通用部分提煉；內容待 owner 審閱） |
| 現況：結構、資料流 | `docs/architecture/overview.md` | 部分可寫（workspace 與工具搬移已完成）；CLI 章節要等 CLI 實作 |
| 使用手冊 | `docs/user-guide/` | 尚未撰寫 |
