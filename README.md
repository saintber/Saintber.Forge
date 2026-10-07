# Saintber.Forge

一個**工具集的入口專案**：用 `saintber` 命令發現、安裝、設定、啟動各種工具。各工具的初期開發也在這個 repo 進行，規模變大後會遷到獨立專案，但仍然可以透過 `saintber` 取得。

> ## 目前狀態：主要遷移完成，`saintber` 尚未可用
>
> 舊 .NET 內容已搬到 forge-explorer，Hub 的基本目錄、治理與文件位置已建立（遷移分支 `backlogs/hub-restructure`）。後續可以開出 worktree 平行開發；交付證據與保留事項見 [遷移狀態](docs/migration-status.md)。
> **`saintber` CLI、安裝腳本、各工具的入口都還沒有實作。** 下方標示 ⏳ 的章節是待補的說明，不是遺漏。
>
> 現在能做的：使用既有的 forge-explorer（.NET），從遷移基準開 worktree 開發。需要完整需求流程時使用 Spec Kit；小粒度 skill 可直接開發與驗證。

## 工具

| 工具 | 說明 | 狀態 |
|---|---|---|
| [`forge-explorer`](projects/forge-explorer/) | 原 Saintber.Forge 探索性工具集（.NET / Blazor Server），繼續開發並改名 | 已搬遷；**尚無 `saintber` 入口**；`001-portal-home` 已完成並封存 |
| `ai-assistant` | AI 助理 | 規劃中 |
| `ai-queue` | AI 工作佇列 | 規劃中 |
| `ai-skills` | AI 技能（可安裝的資源與可執行的能力） | 規劃中 |
| `pwsh-tools` | PowerShell 工具 | 規劃中 |
| `node-tools` | Node.js 工具 | 規劃中 |

「規劃中」的工具**沒有目錄**，只是計畫。

## 並行開發的目錄基準

| 位置 | 責任 |
|---|---|
| `src/`、`tests/` | Hub 入口與測試，骨架已建立，尚無 CLI |
| `projects/<id>/` | 各工具自己的程式、文件、治理與測試 |
| `packages/` | 版本化 Shared 的位置，目前沒有套件 |
| `scripts/{bootstrap,dev,ci,release}/` | 使用者引導、開發、CI、入口發佈；已建立目錄，尚無腳本 |
| `tooling/speckit/`、`tooling/skills/`、`tooling/scaffold/`、[`tooling/herdr/`](tooling/herdr/README.md) | 開發工具、repo 自製 skill 正本、Tool 靜態範本與 Herdr pane 輔助腳本 |
| `docs/`、`specs/`、`archive/changes/` | Hub 文件、候選工作包與歷史；Tool 在自己目錄有相同邊界 |

操作見 [worktree 並行開發](docs/developer-guide/parallel-development.md)。總體設計快照提供方向；每次詳細需求重新討論，不把快照當成完整需求。完整 Spec Kit 擴充仍有未完事項，不阻擋其他開發。

## ⏳ 安裝

> **待補。** 一行安裝指令要等 `saintber` CLI 與 bootstrap 腳本（`scripts/bootstrap/install.ps1`、`install.sh`）實作後才能提供。
>
> 預計的內容（來自設計，尚不能使用）：
> - Windows 用 PowerShell、Linux / macOS 用 sh 的一行安裝指令。
> - 安裝時選擇 Hub 的家目錄、必要時安裝 Node 24。
> - 可選的短名稱（例如 `sai`）。

## ⏳ 快速開始與命令

> **待補。** 預計的命令形狀是 `saintber <前綴> <操作> [參數...]`，例如 `saintber ai queue install`。命令清單等 CLI 實作後再寫，**現在沒有任何命令可用**。

## ⏳ 使用手冊

> **目錄已建立，產品手冊待補。** 見 [`docs/user-guide/`](docs/user-guide/README.md)；待功能可用時新增實際操作說明。

## 現在可以做什麼

### 開發 forge-explorer（.NET）

```text
cd projects/forge-explorer
dotnet build Saintber.Forge.sln
dotnet test tests/Saintber.Forge.BlazorServer.UnitTests
```

整合測試是瀏覽器 E2E 測試，需要另外的環境，見 [`projects/forge-explorer/tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md`](projects/forge-explorer/tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md)。

### 使用 Spec Kit 開發

在**專案目錄內**執行技能，例如 Claude 的 `/speckit-specify`、Codex 的 `$speckit-specify`。小粒度 skill 可直接開發，不強迫建立工作包；適用治理與必要驗證仍須遵守。細節見 [`docs/developer-guide/speckit-workflow.md`](docs/developer-guide/speckit-workflow.md)。

## 文件

| 想知道 | 看這裡 |
|---|---|
| 文件總導覽 | [`docs/README.md`](docs/README.md) |
| 為什麼這樣設計 | [`ADR-0001`](docs/architecture/decisions/0001-hub-and-project-split.md) |
| 規範（Policy） | [`docs/governance/policy/`](docs/governance/policy/README.md) |
| 憲章（**Active v1.0.0**） | [`.specify/memory/constitution.md`](.specify/memory/constitution.md) |
| 給 AI 代理的指引 | [`AGENTS.md`](AGENTS.md) |

## 授權

**待補。** 授權類型尚未決定。
