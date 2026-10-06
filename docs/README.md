# Documentation — Saintber.Forge Hub

本目錄是 **Hub**（`saintber` 工具集入口）的文件。各專案在 `projects/<id>/docs/` 有自己的文件，結構相同。

本 README 只作為**導覽**，不定義治理規則，也不重述其他文件的內容。

> 狀態：專案正在依 [`採納時的設計（快照）`](architecture/decisions/0001-attachments/design-2026-10-adopted.md) 重整（分支 `hub/000-restructure`）。
> 下方標示 ⏳ 的文件**尚未撰寫**，連結還不存在。

## 從哪裡開始

| 想知道 | 看這裡 |
|---|---|
| 整體設計、目錄、責任邊界、遷移計畫 | [`採納時的設計（快照）`](architecture/decisions/0001-attachments/design-2026-10-adopted.md) |
| 各專案在哪裡 | [`projects/`](../projects/) |
| 舊的 .NET 探索性工具集 | [`projects/forge-explorer/`](../projects/forge-explorer/) |

## 文件結構

```text
docs/
├─ README.md                  ← 你在這裡
├─ developer-guide/           開發者手冊
│  └─ speckit-workflow.md     Spec Kit 與 SDD 文件的使用方式
├─ governance/
│  └─ policy/                 Hub Policy（長期規範）
├─ intent/                    Spec Kit 的人類輸入（進行中的變更）
├─ user-guide/                ⏳ 使用手冊
├─ architecture/              ⏳ 現行架構與 ADR
└─ specifications/            ⏳ 有效規格（capability）
```

| 類別 | 回答的問題 | 位置 |
|---|---|---|
| 使用手冊 | 怎麼安裝、設定、執行？ | ⏳ `user-guide/` |
| 開發者手冊 | 怎麼開發、發佈、遷出？ | [`developer-guide/`](developer-guide/) |
| 架構 | 系統**現在**怎麼運作？為什麼這樣選？ | ⏳ `architecture/` |
| Policy | **必須**遵守什麼？ | [`governance/policy/`](governance/policy/README.md) |
| Intent | **為什麼**要做這次變更？ | `intent/` |
| 有效規格 | 系統**應該**有什麼行為（現行）？ | ⏳ `specifications/` |

## 憲章

Hub 的憲章**尚未撰寫**（遷移步驟 9）。

舊的 Saintber.Forge 憲章是 .NET 探索性工具集的治理文件，已隨專案搬到 [`projects/forge-explorer/.specify/memory/constitution.md`](../projects/forge-explorer/.specify/memory/constitution.md)。它只適用 forge-explorer，不是整個 Hub 的憲章。

## 建議閱讀順序

1. [`採納時的設計（快照）`](architecture/decisions/0001-attachments/design-2026-10-adopted.md)：了解 Hub、Tool、Shared 的分工。
2. [`governance/policy/README.md`](governance/policy/README.md)：目前的共同規範。
3. [`developer-guide/speckit-workflow.md`](developer-guide/speckit-workflow.md)：開始新的變更之前。
4. 要看舊工具：`projects/forge-explorer/` 底下的 `docs/`。
