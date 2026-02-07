# Decision — <Intent Name>

> Status  
> Draft / Active / Deprecated  
> （請擇一標示）

> Scope  
> 本 Decision **僅適用於本 Intent 目錄下的主題**，  
> 不具通用性，不自動影響其他工具或專案。

---

## 1. Background

說明本 Decision 產生的背景與來源，例如：

- 來自 SD view / 設計審查的要求
- 外部系統、法規或既有平台的限制
- 階段性目標或短期取捨

本節僅描述「為什麼現在需要這個決策」，  
不重述 Intent 的動機內容。

---

## 2. Decision

清楚列出本次被要求採取的**實作決策或約束條件**。

建議以條列方式描述，避免模糊語句。

範例：

- 必須透過 API 呼叫方式存取既有系統
- 不得直接存取資料庫
- 必須使用指定的授權流程
- 必須符合特定效能或部署限制

---

## 3. Rationale

說明為何選擇這些決策，而非其他可能方案：

- 為何此做法在目前情境下最可行
- 若有替代方案，為何未採用
- 是否存在已知妥協或風險

本節用於**保留決策脈絡**，  
避免日後重複討論相同問題。

---

## 4. Constraints & Non-Goals

### Constraints（約束）

列出因本 Decision 而產生的限制：

- 技術限制
- 流程限制
- 架構或部署限制

---

### Non-Goals（非目標）

明確指出本 Decision **沒有打算解決的事情**，例如：

- 不作為通用架構範本
- 不影響其他 Intent
- 不代表最終或永久做法

---

## 5. Impact

描述本 Decision 對目前專案的影響範圍：

- 影響哪些模組或工具
- 是否影響開發方式、測試方式或部署方式
- 是否需要額外文件或驗證流程配合

---

## 6. Review & Evolution

### Review Trigger（檢視時機）

說明在什麼情況下，應重新檢視本 Decision：

- 需求變更
- 技術限制解除
- 進入下一階段或正式產品化

---

### Exit Strategy（退場策略）

若本 Decision 不再適用：

- 是否可能升級為 Policy
- 是否可被移除而不影響 Intent
- 是否需要重構或回收既有實作

---

## 7. References

（選填）

- 相關的 SD view 討論
- 外部文件或規範連結
- 相關的 Plan 或 Verification Record

---

> Notes  
> 本 Decision 文件可隨時間更新或標示為 Deprecated。  
> 若 Decision 已失效但仍保留，必須明確標示其狀態。
