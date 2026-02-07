# Decision — Saintber.Forge

本目錄用於存放 **Decision 文件**。

Decision 文件用來記錄在特定時間點、特定範圍內，  
因需求、限制或評估結果而做出的**具體實作決策或約束條件**。

---

## Decision 的定位

Decision 文件關注的是：

- 在既有 Intent 前提下，必須採取的實作方式
- 來自設計審查（如 SD view）、外部系統限制或階段性需求的決策
- 不具通用性的技術或流程約束

Decision **不描述**：

- 為什麼要做這件事（由 Intent 負責）
- 全專案通用的規則或政策（由 Policy 負責）
- 工作拆解或執行時程（由 Plan 負責）

---

## 與其他文件的關係

Decision 與其他文件類型的責任邊界如下：

- **Intent**
  - 提供問題背景與動機
  - Decision 以 Intent 為前提，不得推翻其核心目的

- **Policy**
  - 定義長期且通用的規範
  - Decision 不得隱性修改或取代 Policy

- **Plan**
  - 描述執行方式與工作項目
  - Plan 可引用 Decision 作為前提條件

Decision 僅在其適用範圍內有效，  
不自動影響其他工具或專案。

---

## 目錄使用方式

- 每一份 Decision 建議以「一個主題 / 工具 / 專案」為單位
- 檔名應清楚表達其適用對象與主題
- Decision 可隨時間新增、更新或標記為不再適用

範例：

```text
docs/decision/
├─ tool-a-auth-flow.md
├─ outerapi-rate-limit.md
└─ blazor-hosting-model.md
