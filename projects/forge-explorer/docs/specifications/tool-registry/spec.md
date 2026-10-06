---
capability: tool-registry
owner: forge-explorer
status: active
last-adopted: 001-portal-home
evidence-note: 補建（遷移 hub/000-restructure）；無自動化行為測試，見 ../README.md 的「證據等級」
---

# Tool Registry

Portal 顯示哪些工具，由**資料庫中的註冊資料**決定，而不是硬編碼在首頁。

> 證據等級：**S** 靜態碼、**H** 歷史手動（本次未重跑）、**A** 自動化、**—** 未驗證或未達成。說明見 [`../README.md`](../README.md)。

## Requirements

### REQ-TR-001 工具註冊資料
每個工具以一筆 `ToolRegistration` 註冊，包含：`ToolId`、`ToolName`（必填，≤100）、`Description`（選填，≤500）、`Url`（必填，≤2000）、`IsPublic`（預設 true）、`DisplayOrder`（預設 0）、`CreatedAt`、`UpdatedAt`。

- 證據：**S**（`Entities/ToolRegistration.cs`）
- 來源：原 FR-009、FR-012

### REQ-TR-002 資料驅動
工具清單來自資料庫查詢，新增工具**不需要修改首頁程式碼**。

- 證據：**S**（`ToolRegistrationService` 查詢 `ToolRegistrations`；首頁只迭代結果）
- 原 SC-005（新增工具後自動顯示）：**未被實際驗證**
- 來源：原 FR-009、SC-005

### REQ-TR-003 查詢與排序
- 查詢全部工具，或只查 `IsPublic` 的工具。
- 排序：先依 `DisplayOrder`，再依 `ToolName`。

- 證據：**S**（`GetAllToolsAsync`、`GetPublicToolsAsync`；`OrderBy(DisplayOrder).ThenBy(ToolName)`；以 `AsNoTracking` 讀取）
- 來源：原 FR-004、FR-005

### REQ-TR-004 種子資料
資料庫初始含兩筆範例工具：一筆公開（`/tools/example-a`）、一筆需登入（`/tools/example-b`）。

- 證據：**S**（`PortalDbContext.OnModelCreating` 的 `HasData`）
- 這兩個 URL **沒有對應的工具實作**，點擊會顯示 404；歷史驗證紀錄也記載了這點。這是範例資料，**不代表**「每個工具都有穩定可存取的 URL」（原 FR-009）已達成
- 來源：原 FR-009

## 與原提案的差異

- 原 FR-009「每個 Tool MUST 對應一個穩定且可直接存取的 URL」：資料模型有 `Url` 欄位，但這個專案**沒有任何真實工具**，所以「穩定且可存取」**無法驗證，也不宣稱達成**。

## 已知缺口

| # | 缺口 | 影響的 requirement |
|---|---|---|
| G1 | EF Migration 不在版本控制中（repo 沒有 `Migrations/`）；資料表結構與種子資料的可重現性缺少證據 | REQ-TR-001、REQ-TR-004 |
| G2 | 種子 URL 沒有實作（404） | REQ-TR-004 |
| G3 | 沒有自動化測試涵蓋查詢與排序 | REQ-TR-002、REQ-TR-003 |

來源與詳細核對：[`archive/changes/001-portal-home/archive.md`](../../../archive/changes/001-portal-home/archive.md)。

## Change Log

| Date | Change | Requirements | Summary | Archive |
|---|---|---|---|---|
| 2026-10-06 | 001-portal-home（補建） | REQ-TR-001 – 004 | 依 §15.4 補建 | `archive/changes/001-portal-home` |
