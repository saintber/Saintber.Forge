# Intent — <Intent Name>

> **本檔是正式 Intent 管理擴充的候選範本與示例，不是真實事件，尚待採納。** 下方 Version Index 與現行範圍中的版本、日期、原因、依據都是格式示意，不是已批准的事實；複製後請改成真實內容，沒有真實依據就標 `pending`，不要虛構使用者指示或 commit。
>
> Scope  
> 本 Intent 描述某一項工具、能力或問題域「為什麼存在」，  
> 作為後續 Decision、Policy 與 Plan 的背景與前提。
>
> 管理規則（版本、修訂、現行邊界、快照、多份 Intent 的關係）以 Hub 的 `docs/developer-guide/intent-workflow.md` 為正本（遷出後改為本地快照或有版本的網址）。Intent 不是正式行為規格，也不預先選實作方案。

---

## Intent Version Index

> 示例列，不是真實事件。版本代表需求語意的重要修訂；錯字等非語意修正不增版本。

| Version | Date | Reason | Summary | Evidence |
|---|---|---|---|---|
| 1（示例） | YYYY-MM-DD（示例） | 初始需求（示例） | 初次記錄問題與範圍（示例） | pending（未提交） |

## Current Effective Intent

目前生效版本：1（示例）。只有下面「現行範圍開始」與「現行範圍結束」之間的內容是現行需求；邊界外的內容（相關文件、歷史補充）**不是**需求。

<!-- 現行範圍開始 -->

## 1. Problem Statement

清楚描述目前要解決的問題：

- 現況是什麼
- 哪裡出了問題或不足
- 問題對誰造成影響

本節不討論解法，只定義問題本身。

---

## 2. Motivation

說明為什麼這個問題值得被解決：

- 若不解決，會帶來什麼風險或成本
- 解決後能帶來什麼價值
- 是否有時間性或階段性壓力

---

## 3. Target Audience / Stakeholders

描述此 Intent 的主要對象：

- 使用者
- 系統角色
- 相關利害關係人

可簡要說明各自關注的重點。

---

## 4. Desired Outcome

描述「成功時的樣子」，著重於結果而非實作方式：

- 使用者能做到什麼
- 系統行為有何改善
- 可被觀察或驗證的結果（Outcome）

避免描述具體技術或架構。

---

## 5. Assumptions & Constraints

列出目前已知的前提與限制條件，例如：

- 組織或流程限制
- 外部環境假設
- 不可控制的因素

本節僅記錄事實，不做決策。

---

## 6. Out of Scope

明確指出本 Intent **不打算處理的範圍**：

- 不解決的問題
- 不涵蓋的使用情境
- 明確排除的需求

用於避免後續誤解與範圍膨脹。

---

## 7. Acceptance Direction

描述驗收方向（不是完整驗收條件）：如何判斷需求已被滿足。

---

## 8. Open Questions

尚未決定的事項；未裁決的矛盾來源也列在這裡，不合併。

<!-- 現行範圍結束 -->

---

## Related Documents

（選填；邊界外，不是需求）

列出與本 Intent 相關的文件：

- `decision.md`（若存在）
- 對應的 Policy 文件
- 相關的 Plan 或 Verification Record
- 其他 Intent 的關係（延伸／拆分／承接／取代；明示整份或部分，指向實際存在的路徑）
- 里程碑快照（若有）：`history/intent-<id>.md`，唯讀，不是第二份活動 Intent；`<id>` 唯一，不覆寫

---

> Notes  
> Intent 文件可隨專案理解深化而調整；實質改變記入 Version Index（含真實依據），
> 預設只保存一份現行完整內容，已提交的舊文靠 Git 回看。
