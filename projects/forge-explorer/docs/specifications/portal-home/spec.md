---
capability: portal-home
owner: forge-explorer
status: active
last-adopted: 001-portal-home
evidence-note: 補建（遷移 hub/000-restructure）；無自動化行為測試，見 ../README.md 的「證據等級」
---

# Portal Home

Portal Home 是各工具的**導覽入口**，不實作任何工具的業務邏輯。

> 證據等級：**S** 靜態碼、**H** 歷史手動（本次未重跑）、**A** 自動化、**—** 未驗證或未達成。說明見 [`../README.md`](../README.md)。

## Requirements

### REQ-PH-001 以卡片呈現工具
首頁以卡片（Card）形式呈現可用的工具。

- 證據：**S**（`Pages/Index.razor` 迭代 `visibleTools`，每個渲染一個 `ToolCard`）
- 來源：原 FR-001

### REQ-PH-002 卡片內容
每張卡片包含工具標題與簡要功能描述。

- 證據：**S**（`Components/ToolCard.razor` 渲染 `ToolName`；`Description` 非空白時才渲染）
- 來源：原 FR-002

### REQ-PH-003 卡片導向工具 URL
每張卡片提供導向該工具 URL 的連結。

- 證據：**S**（`ToolCard.razor` 輸出 `<a href="@Tool.Url">`）
- **只能保證「連結存在」**。原規格要求「點擊成功率達 100%、無失效連結」（SC-003）**未達成**：種子資料的 URL（`/tools/example-a`、`/tools/example-b`）沒有對應實作，歷史驗證紀錄自己記載點擊會顯示 404。見「已知缺口」G1
- 來源：原 FR-003

### REQ-PH-004 未登入使用者只看到公開工具
未登入使用者可存取首頁，且只顯示公開工具。

- 證據：**S**（`Index.razor`：未通過驗證時呼叫 `GetPublicToolsAsync`，其以 `IsPublic` 篩選）；**H**（歷史紀錄自述 Gate B 通過）
- 來源：原 FR-004

### REQ-PH-005 已登入使用者看到所有工具
已登入使用者可存取首頁，且顯示所有工具（含需登入的）。

- 證據：**S**（`Index.razor`：通過驗證時呼叫 `GetAllToolsAsync`）；**H**（歷史紀錄**自述**：點擊登入、完成 Microsoft 登入後顯示所有卡片，皆標 PASS，並註明 Azure AD 由使用者手動設定）。本次**無法重現**：repo 的 `AzureAd` 設定是占位值，也沒有自動化證據
- 來源：原 FR-005

### REQ-PH-006 RWD 欄數
首頁卡片的欄數隨寬度調整：

| 寬度 | 欄數 |
|---|---|
| < 768px | 1 欄 |
| 768px – 1199px | 2 欄 |
| ≥ 1200px | 4 欄 |

- 證據：**S**（`wwwroot/css/site.css`：`.tool-grid` 預設 `1fr`；`@media (min-width: 768px) and (max-width: 1199px)` 為 2 欄；`@media (min-width: 1200px)` 為 4 欄）；**H**（歷史紀錄自述 375 / 800 / 1920px 手動通過）
- **動態驗證缺口**：這次沒有重新執行 RWD 驗證。Playwright 測試（`PortalHomeRwdTests`，含桌機 4 欄、平板 2 欄、手機 1 欄與無水平捲軸）存在，但**遷移時未執行**
- 與原提案的差異：原提案（US3）寫桌機「3–4 欄」，實作固定為 4 欄
- 來源：原 FR-008、SC-004

### REQ-PH-007 只做導覽
首頁不實作任何工具的業務邏輯。

- 證據：**S**（首頁只查詢工具清單並渲染卡片）
- 來源：原 FR-011

### REQ-PH-008 空清單時的訊息
沒有任何可顯示的工具時，顯示「目前無可用功能」。

- 證據：**S**（`Index.razor` 在 `visibleTools.Count == 0` 時渲染該訊息）。**H**：歷史紀錄把此情境標示 PASS，但備註「尚未移除 Seed Data 進行測試」，**實際沒有測試過這個情境**，因此**不採信**
- 狀態：行為由程式碼實現，**未經驗證**
- 來源：原邊界條件

### REQ-PH-009 工具 URL 直接存取與卡片導向一致
直接輸入工具 URL 與從卡片點擊進入，結果應一致。

- 證據：**—**（首頁只輸出 `href`；是否一致取決於工具本身，**這個專案裡沒有任何工具實作**）
- 來源：原 FR-010

## 與原提案的差異

- **FR-007（Access / ID Token）**：移到 `portal-authentication`，且**未達成**，見該規格。
- **FR-009、FR-012（工具部分）**：移到 `tool-registry`。
- 樣式檔名：原 `tasks.md`（T027、T038）寫 `wwwroot/css/app.css`，**實際樣式在 `wwwroot/css/site.css`**（`_Layout.cshtml` 也引用它）。這是檔名差異，對應的樣式存在；它**不**是遺失的檔案。
- **原規格 SC-001、SC-002、SC-006**（3 秒載入、90% 使用者能找到工具）：**沒有任何證據**，歷史驗證紀錄沒有量測載入時間或使用者行為，**不列為本規格的 requirement**，也不宣稱達成。

## 已知缺口

| # | 缺口 | 影響的 requirement |
|---|---|---|
| G1 | 種子資料的工具 URL 無對應實作，點擊顯示 404；SC-003「100% 成功」**未達成** | REQ-PH-003、REQ-PH-009 |
| G2 | 空清單情境從未被實際測試（備註「尚未移除 Seed Data」卻標 PASS） | REQ-PH-008 |
| G3 | 沒有任何自動化行為測試；唯一的單元測試是空方法 | 全部 |
| G4 | Playwright RWD 測試遷移時未執行（需 `https://localhost:7289`、PostgreSQL 與設定） | REQ-PH-006 |

來源與詳細核對：[`archive/changes/001-portal-home/archive.md`](../../../archive/changes/001-portal-home/archive.md)。

## Change Log

| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-10-06 | 001-portal-home（補建） | REQ-PH-001 – 009 | 依 §15.4 比對封存 spec、程式碼與驗證紀錄後補建；**不是**複製候選規格 | `archive/changes/001-portal-home` |
