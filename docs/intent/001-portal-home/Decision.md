# Portal Home — Decision

> Status  
> Active

> Scope  
> 本 Decision 僅適用於 **Portal Home** 這一 Intent，  
> 不具通用性，不自動影響其他 Tool 或系統模組。

---

## 1. Background

本 Decision 源自於專案首頁（Portal Home）在設計階段所識別的實作約束與一致性需求，  
其目的在於確保首頁在實作與後續擴充時，仍能維持可預期的行為與使用體驗。

---

## 2. Decision

### 2.1 存取與導覽一致性

- 每一個 Tool 必須對應一個穩定且可直接存取的 URL
- 使用者直接於瀏覽器貼上該 URL 存取，與由 Portal Home 卡片點擊進入，結果必須一致
- Portal Home 僅負責導覽與呈現，不負責轉譯或包裝 Tool 的行為

---

### 2.2 登入與未登入行為差異

- Portal Home 必須支援「未登入即可使用」的存取模式
- 使用者是否登入，僅影響：
  - Portal Home 上顯示的卡片項目
  - 可導向的 Tool 範圍
- 未登入使用者不可看到或導向需授權的 Tool

---

### 2.3 Presentation 與 Tool 的關係

- Portal Home 僅作為各 Tool 的 Presentation 入口
- 不得在 Portal Home 中實作任何 Tool 的業務邏輯
- 各 Tool 的實際行為、功能與授權邏輯，應由其自身負責

---

### 2.4 驗證與身份識別

- 使用者登入應採用 Microsoft 原生驗證機制（Microsoft Identity / OpenID Connect）
- 登入後系統需核發：
  - Access Token
  - ID Token
- 身份資料與相關狀態需能以 PostgreSQL 作為儲存來源

---

### 2.5 前端呈現原則

- Portal Home 採用 RWD（Responsive Web Design）設計
- 首頁以卡片（Card）形式呈現各 Tool
- 每張卡片僅包含：
  - Tool 標題
  - 簡要功能描述

---

## 3. Rationale

- 穩定 URL 與一致行為可確保 Tool 可被書籤、外部系統或文件直接引用
- 將授權差異限制於「顯示層級」，可降低 Portal Home 與 Tool 間的耦合度
- 採用既有身份驗證機制可降低實作與維運成本
- 簡化卡片內容有助於後續擴充與一致的視覺呈現

---

## 4. Constraints & Non-Goals

### Constraints

- Portal Home 不得承擔 Tool 的業務責任
- Tool 必須能在無 Portal Home 介入的情況下正常運作
- 登入狀態不可作為唯一導向依據，URL 行為需可獨立驗證

---

### Non-Goals

- 不在本 Decision 中定義具體 UI 樣式或設計稿
- 不規範 Tool 內部的技術架構
- 不定義授權資料模型或權限細節

---

## 5. Impact

- Portal Home 將作為系統中唯一的統一入口頁面
- 各 Tool 需配合提供穩定且可直接存取的入口 URL
- 驗證與授權流程需能支援首頁與 Tool 間的狀態一致性

---

## 6. Review & Evolution

### Review Trigger

- 新增需登入才能使用的 Tool
- 身份驗證或授權機制調整
- Portal Home 導覽或呈現方式需重大調整時

---

### Exit Strategy

- 若 Portal Home 不再作為主要入口，需重新檢視各 Tool 的導覽策略
- 若登入機制改為通用政策，相關內容應升級至 Policy 文件

---

## 7. References

- `intent.md`
- 相關的 spec / verification 文件（若有）
