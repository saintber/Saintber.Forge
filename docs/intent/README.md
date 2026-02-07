# Intent — Saintber.Forge

本目錄用於存放 **Intent 文件**，  
並作為每一個工具、能力或問題域的**主題容器**。

Intent 目錄下可同時包含：

- intent（為什麼要做）
- decision（目前被要求怎麼做）

---

## Intent 的定位

Intent 文件用來描述某一項工具、能力或專案：

- 要解決什麼問題
- 為什麼值得解決
- 解決對象是誰
- 若成功，期望產生什麼結果（Outcome）

Intent **不描述**：

- 技術選型或實作細節
- 專案或程式碼結構
- 開發流程、完成條件或測試策略

上述內容分別由 Policy、Decision、Plan 等文件負責。

---

## Decision 與 Intent 的關係

在 Saintber.Forge 中，Decision 被視為 **Intent 的附屬文件**。

Decision 文件用於記錄：

- 在該 Intent 前提下
- 因設計審查（如 SD view）、外部限制或階段性需求
- 所做出的**具體實作決策或約束**

Decision 的特性為：

- 僅適用於該 Intent 主題
- 可能是暫時性的
- 不具通用性（因此不屬於 Policy）

---

## 建議目錄結構

每一個 Intent 建議建立為獨立子目錄，  
並在該目錄下放置對應的 decision 文件（若存在）：

```text
docs/intent/
├─ tool-a/
│  ├─ intent.md
│  └─ decision.md
└─ tool-b/
   ├─ intent.md
   └─ decision.md
```

* `intent.md`：說明該主題的動機與問題定義
* `decision.md`：記錄該主題目前被要求採取的實作方式

---

## 與其他文件的責任邊界

* **Constitution**

  * 定義不可退讓的治理原則
  * Intent 與 Decision 皆不得違反憲章

* **Policy**

  * 定義長期且通用的規範
  * Decision 不得隱性修改或取代 Policy

* **Plan**

  * 描述執行方式與工作拆解
  * Plan 可引用 intent 與 decision 作為前提

Intent 與 Decision 僅提供「背景與約束」，
不作為完成判定或品質保證的依據。

---

## Intent / Decision 的生命週期

* Intent 與其對應的 Decision 可隨專案演進調整
* 當某 Intent 不再適用時，其整個目錄應一併移除
* 不再有效的 Intent / Decision 不應作為後續決策依據

---

本 README 僅用於說明 Intent 與 Decision 文件的角色與使用方式。
不定義任何治理規則或實作要求。
