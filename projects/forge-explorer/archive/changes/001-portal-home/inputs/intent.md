# Portal Home — Intent Record

> Purpose  
> Preserve original stakeholder intent and its evolution over time.  
> This document records **human intent and understanding**, not final decisions or specifications.

> Audience  
> PM / SA / SD / Future maintainers

> Scope  
> This document does **not** define implementation details, technical decisions, or delivery scope.

---

## Intent Version Index

> The following table records **intent evolution milestones**.  
> Versions represent changes in understanding or scope recognition,  
> not implementation or release versions.

| Version | Date       | Trigger                    | Summary                                      |
|--------:|------------|----------------------------|----------------------------------------------|
| v1.0    | 2026-02-08 | Initial portal requirement | 定義專案首頁作為各 Tool 的入口與展示介面        |

---

## Current Effective Intent

> **Effective Version:** v1.0  
>  
> The sections below describe the **current effective intent** only.  
> Historical intent details are preserved in the versioned records above.

---

## 1. Problem Statement (Effective)

目前專案中缺乏一個統一的入口頁面，用以：

- 向使用者呈現目前可用的各項 Tool
- 提供一致的進入點與導覽體驗
- 區分登入與未登入狀態下可使用的功能範圍

導致使用者需依賴零散網址或個別入口才能使用功能，  
不利於整體產品理解與後續擴充。

---

## 2. Motivation

建立專案首頁的目的在於：

- 提供清楚、可理解的產品入口
- 降低使用者進入各 Tool 的學習成本
- 作為後續新增 Tool 或功能時的自然擴充點
- 支援同時存在「登入使用」與「不登入即可使用」的情境

---

## 3. Stakeholders & Users

- **一般使用者**
  - 可能未登入，僅瀏覽或使用部分公開功能
- **已登入使用者**
  - 可使用額外受權限控制的 Tool 或功能
- **產品與維運人員**
  - 需透過首頁快速確認目前提供的功能集合

---

## 4. Desired Outcome (Effective)

在目前理解下，專案首頁完成後應達成以下結果：

- 使用者進入首頁即可看到以卡片形式呈現的功能項目
- 每張卡片代表一個 Tool 的 Presentation 入口
- 使用者是否登入，會影響部分卡片是否顯示
- 每一個 Tool 皆有對應且穩定的網址
  - 直接貼上網址存取
  - 或由首頁點擊卡片進入
  - 兩者呈現結果一致

---

## 5. Assumptions & Known Constraints

- 專案未來將持續增加新的 Tool
- 首頁需能承載不同數量的卡片而不影響使用體驗
- 使用者可能直接以書籤或外部連結存取特定 Tool

---

## 6. Out of Scope (Effective)

在目前版本的 Intent 中，明確不包含：

- 卡片的進階互動（如收藏、排序、統計資訊）
- Tool 內部功能的設計或實作細節
- 權限模型與授權規則的具體定義

---

## 7. Related Documents

- `decision.md`
- 後續產生之 spec / release / verification 文件（若有）

---

## Appendix A — Intent Change Notes (Optional)

（目前無）
