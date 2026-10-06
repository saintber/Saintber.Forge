# 架構

描述系統**現在**怎麼運作。ADR 描述**為什麼**這樣選；Policy 描述**必須**遵守什麼。三者互相連結，不重複寫同一條規則。

## 目前狀態

**現況文件尚未撰寫。** saintber CLI 還沒有實作，沒有「現在怎麼運作」可以描述；先寫出來只會變成另一份設計稿。

在此之前：

| 想知道 | 看這裡 |
|---|---|
| 整體設計與目錄 | [`decisions/0001-attachments/design-2026-10-adopted.md`](decisions/0001-attachments/design-2026-10-adopted.md)（採納時的設計，**唯讀快照**） |
| 為什麼這樣設計 | [`decisions/0001-hub-and-project-split.md`](decisions/0001-hub-and-project-split.md) |
| 已經被取代或實現的章節 | 同上 ADR 的「被取代紀錄」 |

## 規則（憲章原則 VI）

實作與設計不一致時，**更新文件使其符合事實**，依性質分流：

- 現在怎麼運作 → 這個目錄
- 必須遵守什麼 → Policy
- 現在的行為要求 → 有效規格（經採納流程）
- 為什麼這樣決定 → 新增 ADR，並將被推翻的標為 superseded

**不改寫**原始設計與已採納的 ADR。

## 預計的文件

隨 saintber CLI 的實作逐步建立，每份都寫**已經實作**的現況：

| 檔案 | 內容 |
|---|---|
| `overview.md` | 元件與責任 |
| `data-flow.md` | 資料流與依賴方向 |
| `deployment.md` | 部署與啟動模式 |
| `cli-routing.md` | Hub 專有：巢狀路由 |
| `tool-entrypoints.md` | Hub 專有：入口包的取得與呼叫 |
