# 架構

描述系統**現在**怎麼運作。ADR 描述**為什麼**這樣選；Policy 描述**必須**遵守什麼。三者互相連結，不重複寫同一條規則。

## 目前狀態

| 文件 | 狀態 |
|---|---|
| [`overview.md`](overview.md) | **已撰寫**：目前 repo 的結構與已完成的搬遷。**只缺 CLI 章節**，因為 saintber CLI 尚未實作 |
| `data-flow.md`、`deployment.md`、`cli-routing.md`、`tool-entrypoints.md` | 尚未撰寫；隨 CLI 實作後建立，**只寫已經實作的現況** |

在這些文件完成之前，**尚未實作部分的設計**在採納時的設計快照中，**它不是現況**：

| 想知道 | 看這裡 |
|---|---|
| 採納時的設計 | [`decisions/0001-attachments/design-2026-10-adopted.md`](decisions/0001-attachments/design-2026-10-adopted.md)（**唯讀快照**） |
| 為什麼這樣設計、已核准的決策、待裁決事項 | [`decisions/0001-hub-and-project-split.md`](decisions/0001-hub-and-project-split.md) |

## 規則（憲章原則 VI）

**設計先於實作。** 實作必須依照已核准的設計；不得先偏離，再回頭改文件合理化。

- 本目錄的文件是**描述性**的：只描述**已完成**的實作，**不得描述尚未實作的能力**。
- 它們在變更**驗證並採納（adopt）後**更新。
- 發現實作偏離已核准的設計時，那是**缺陷**，要修正實作；要改設計，必須先依憲章原則 VI 取得相應 owner 的核准，**不得因為現有實作已經如此，就更新文件來配合它**。
- ADR 是記錄，不是核准。只有變更**已採納的架構或決策**才需要新 ADR；一般錯誤修正不需要。

## 預計的文件

| 檔案 | 內容 |
|---|---|
| `overview.md` | 元件與責任（**已有現況版本**，CLI 章節待補） |
| `data-flow.md` | 資料流與依賴方向 |
| `deployment.md` | 部署與啟動模式 |
| `cli-routing.md` | Hub 專有：巢狀路由 |
| `tool-entrypoints.md` | Hub 專有：入口包的取得與呼叫 |
