# Documentation — Saintber.Forge Hub

本目錄是 **Hub**（`saintber` 工具集入口）的文件。各專案在 `projects/<id>/docs/` 有自己的文件，結構相同。

本 README 只作為**導覽**，不定義治理規則，也不重述其他文件的內容。

> 狀態：主要遷移與基本目錄已完成；驗證與保留事項見 [`migration-status.md`](migration-status.md)。快照提供方向，不是後續詳細需求。
> 下方標示 ⏳ 的文件**尚未撰寫**，連結還不存在。

## 從哪裡開始

| 想知道 | 看這裡 |
|---|---|
| 整體設計、目錄、責任邊界、遷移計畫 | [`採納時的設計（快照）`](architecture/decisions/0001-attachments/design-2026-10-adopted.md) |
| 本次遷移交付範圍、設計快照與詳細需求的關係 | [`ADR-0002`](architecture/decisions/0002-migration-delivery-scope.md)；後續詳細需求以新的 Spec Kit change 討論 |
| **要開始一項工作：選哪種流程、文件放哪裡** | [`開發流程：三種顆粒度`](developer-guide/development-workflows.md)（直接開發、Spec Kit 單次功能、完整 Tool 方向） |
| 需求依據（Intent）怎麼保存、修訂、拆分與承接 | [`Intent 管理`](developer-guide/intent-workflow.md)（ADR-0006；`saintber-intent` 技能尚未實作） |
| 開 worktree、選目錄、新 Tool | [`並行開發指引`](developer-guide/parallel-development.md) |
| 在 Herdr 新增 pane、整理開發版面 | [`Herdr 網格使用說明`](developer-guide/herdr-grid.md) |
| 各專案在哪裡 | [`projects/`](../projects/) |
| 舊的 .NET 探索性工具集 | [`projects/forge-explorer/`](../projects/forge-explorer/) |

## 文件結構

```text
docs/
├─ README.md                  ← 你在這裡
├─ developer-guide/           開發者手冊
│  ├─ development-workflows.md 三種開發流程與目錄（正本）
│  ├─ intent-workflow.md      Intent 管理與操作手冊（正本）
│  └─ speckit-workflow.md     Spec Kit 與 SDD 文件的使用方式
├─ governance/
│  └─ policy/                 Hub Policy（長期規範）
├─ intent/                    Spec Kit 的人類輸入（進行中的變更）
├─ user-guide/                使用手冊入口已建立；產品操作內容待實作
├─ architecture/              現行架構概觀與 ADR（CLI 架構待實作後補）
├─ proposals/                 設計提案：需求分析與方案探索（草稿，不是現況或規格）
└─ specifications/            有效規格索引已建立；Hub 尚無已採納 capability
```

| 類別 | 回答的問題 | 位置 |
|---|---|---|
| 使用手冊 | 怎麼安裝、設定、執行？ | [`user-guide/`](user-guide/README.md)（產品內容待實作） |
| 開發者手冊 | 怎麼開發、發佈、遷出？ | [`developer-guide/`](developer-guide/) |
| 架構 | 系統**現在**怎麼運作？為什麼這樣選？ | [`architecture/`](architecture/README.md)（已有概觀與 ADR） |
| 設計提案 | 需求分析與方案探索：想怎麼做？還在討論什麼？ | [`proposals/`](proposals/README.md)（草稿；不是現況、Policy 或有效規格） |
| Policy | **必須**遵守什麼？ | [`governance/policy/`](governance/policy/README.md) |
| Intent | **為什麼**要做這次變更？ | `intent/` |
| 有效規格 | 系統**應該**有什麼行為（現行）？ | [`specifications/`](specifications/README.md)（Hub 目前沒有已採納條款） |

## 憲章

Hub 的憲章已批准：[`.specify/memory/constitution.md`](../.specify/memory/constitution.md)，狀態 **Active（v1.0.0，2026-10-06 由使用者批准）**。

舊的 Saintber.Forge 憲章是 .NET 探索性工具集的治理文件，已隨專案搬到 [`projects/forge-explorer/.specify/memory/constitution.md`](../projects/forge-explorer/.specify/memory/constitution.md)，並依 2026-10-07 的 A＋B 裁決修訂為 **Active v1.1.0**。它只適用 forge-explorer。

## 建議閱讀順序

1. [`採納時的設計（快照）`](architecture/decisions/0001-attachments/design-2026-10-adopted.md)：了解 Hub、Tool、Shared 的分工。
2. [`governance/policy/README.md`](governance/policy/README.md)：目前的共同規範。
3. [`developer-guide/development-workflows.md`](developer-guide/development-workflows.md)：開始新的變更之前，選擇流程與目錄。
4. [`developer-guide/speckit-workflow.md`](developer-guide/speckit-workflow.md)：要使用 Spec Kit 時。
5. 要看舊工具：`projects/forge-explorer/` 底下的 `docs/`。
