# forge-explorer 與 Hub 憲章的潛在衝突

> **這份文件只列出衝突與提案，不修改任何治理文件。** forge-explorer 的舊憲章與 Policy **原封不動**；要不要改、怎麼改，由 owner 裁決。
> 日期：2026-10-06。比對對象：Hub 憲章 v1.0.0（Active）與 `projects/forge-explorer/.specify/memory/constitution.md` v1.0.0、本目錄的 Policy。

## 為什麼會有衝突

forge-explorer 的憲章與 Policy 是為**舊的 Saintber.Forge（一個以 .NET 為主的工具集合平台）**寫的，預設「Tool」是同一個 .NET 方案內、以 BLL / DAL 分層的**程式庫**，並由 BlazorServer / BlazorWasm **集中呈現**。

Hub 憲章裡的「工具」是**以 CLI 為界面、自己持有安裝與狀態、可獨立遷出的可執行單位**。兩者用了同一個詞，但指的不是同一種東西。

**forge-explorer 在 Hub 之下的角色**：它是 Hub 的**一個專案（一個工具）**，內部是 .NET 的 Portal。舊憲章所說的「Tool」，在 Hub 的語彙中是 **forge-explorer 內部的模組**，不是 Hub 的工具。

下表的條款**沒有一條在現況中被違反**（forge-explorer 只有一個前端與一個資料層，沒有「Tool」模組）；它們是**語意重疊、將來可能造成誤判**的地方。

## 衝突清單

| # | forge-explorer 的條款 | Hub 的條款 | 性質 | 具體問題 |
|---|---|---|---|---|
| C1 | 憲章 Principle 3「每個 Tool 必須可被**獨立建置、驗證與移除**」；驗證方式「每個 Tool 擁有**獨立的 Solution**」 | 憲章 I、II；POL-STRUCT-001 R3（`.sln` 放在工具根目錄） | **用詞重疊** | 舊憲章的「Tool」= 方案內的模組；Hub 的「工具」= `projects/<id>/`。forge-explorer **整體**只有**一個** Solution（`Saintber.Forge.sln`），符合 Hub 的規則，但**不符合**舊憲章字面上「每個 Tool 一個 Solution」，因為它內部目前沒有 Tool 模組 |
| C2 | 憲章 Principle 4、5：跨 Tool 契約定義於 **`Saintber.Forge.Tools.Abstractions`**；互動「僅能透過 Abstractions 層」 | 憲章 III：合法互動只有**公開的 CLI / API 契約**與**有版本的 Shared 套件** | **機制不同** | 舊規則指定了**一種**契約機制（.NET 專案 Abstractions）；Hub 允許 CLI / API 與 Shared。兩者不矛盾（Abstractions 可視為一種 Shared），但舊文**沒有**說明 forge-explorer **對 Hub 與其他工具**的契約怎麼訂。目前 repo **沒有** `Tools.Abstractions` 專案 |
| C3 | 憲章 Principle 8：**Presentation 為集中治理責任**；Tool 不得包含 Razor 元件、Controllers 或 API Endpoints | 憲章 I：工具自己持有執行與界面；`saintber … run` 啟動工具自己的 UI | **範圍衝突** | 舊規則把「呈現」集中在 BlazorServer。Hub 之下，forge-explorer **本身**就是工具，它的 Portal UI 屬於工具自己，由工具的 `run` 啟動。舊規則只約束 forge-explorer **內部**的 Tool 模組，**不應**被讀成「Hub 之下所有工具都不得有 UI」 |
| C3a | 同上 | 同上 | **現況觀察** | 001 的實作把 `ToolCard.razor` 放在 **BlazorServer 的 `Components/`**，不在任何 Tool 內，所以**沒有違反** Principle 8 |
| C4 | `project-structure.md`：`tools/<ToolName>` 下各有自己的 Solution；`/tools/ToolA` 的目錄範例 | POL-STRUCT-001：`projects/<id>/` 是 Hub 的專案 | **路徑用詞重疊** | 舊文的 `tools/` 指 **forge-explorer 內部**的目錄；Hub 的 `projects/` 在外層。兩者層級不同，但**同名容易混淆**，且 `tools/` 與 Hub 曾經設計過的頂層目錄名（已改為 `projects/`）相同 |
| C5 | 憲章 Principle 6、7：不得假設 in-process；用 DI 取得實作 | （無對應） | **無衝突** | 這是 .NET 內部的設計要求，Hub 沒有規定，**不衝突** |
| C6 | 憲章 Principle 9、10：憲章優先；憲章不描述實作細節 | 憲章「憲章與其他文件的關係」 | **一致** | 相同的原則，無衝突 |
| C7 | 憲章「Amendment Authority: **Project Constitution Committee**」；「Compliance Review：每季度至少一次」 | 憲章「修訂程序」：owner 核准（`saintber`） | **權限用詞** | 舊憲章寫的修訂權限是「Project Constitution Committee」，這個委員會**不存在**；Hub 是由使用者（owner）核准。需要確認 forge-explorer 憲章的修訂**由誰核准** |
| C8 | `implementation-definition-of-done.md` 引用 `docs/plan/verification/` | POL-DOD-001 R7、已採納設計 §12.3 | **已處理** | 已依已採納設計調整路徑（已授權），見該檔的路徑修訂註記，不屬於待裁決 |

## 提案（供 owner 裁決，**尚未執行**）

> 下列都是**提案**。在 owner 裁決前，**舊憲章與 Policy 維持原樣，仍然有效**，不因本文件而失效。

### 提案 A：在 forge-explorer 憲章加一段「與 Hub 的關係」（解決 C1、C2、C3、C4）
**不改任何既有的原則**，只在憲章末尾（或 Policy README）新增一段**說明性**的條文：
> 本專案在 Hub（`Saintber.Forge`）之下是**一個專案（一個工具）**。本憲章中的「Tool」指**本專案內部的模組**，**不是** Hub 的工具。Hub 對本專案的要求（憲章 I – VII 與適用的 Policy）依 Hub 憲章；兩者衝突時，依 Hub 憲章「專案憲章可以加嚴、不得牴觸」處理。

- 優點：不動舊文原意，只消除用詞歧義；成本最低。
- 這屬於**修訂 forge-explorer 憲章**，依其修訂程序需 owner 核准。

### 提案 B：C7 的修訂權限
把「Project Constitution Committee」改為「owner（`saintber`）」，與 Hub 一致。
- 這是**事實更正**（委員會不存在），但仍屬憲章修訂，需 owner 核准。

### 提案 C：不處理
這些都沒有在現況中被違反；等 forge-explorer 真的新增「Tool 模組」或有 saintber 入口時，再處理。
- 風險：代理或新成員讀到「每個 Tool 一個 Solution」「Tool 不得有 Razor」時，可能誤套到 Hub 的工具。

## 需要 owner 裁決

| # | 問題 | 建議 |
|---|---|---|
| D1 | 要不要採納提案 A | 建議採納；它只加說明，不改原則 |
| D2 | 要不要採納提案 B | 建議採納；是事實更正 |
| D3 | 若不採納，是否接受 C1 – C4 的歧義風險 | — |
