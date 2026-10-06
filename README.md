# Saintber.Forge

一個**工具集的入口專案**：用 `saintber` 命令發現、安裝、設定、啟動各種工具。各工具的初期開發也在這個 repo 進行，規模變大後會遷到獨立專案，但仍然可以透過 `saintber` 取得。

> ## ⚠️ 目前狀態：遷移中，`saintber` 尚未可用
>
> 這個 repo 正在從「.NET 探索性小工具集合」改為上述的入口專案（分支 `hub/000-restructure`）。
> **`saintber` CLI、安裝腳本、各工具的入口都還沒有實作。** 下方標示 ⏳ 的章節是待補的說明，不是遺漏。
>
> 現在能做的：閱讀設計、使用既有的 forge-explorer（.NET）、依 Spec Kit 流程開發。

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

> **待補。** `docs/user-guide/` 尚未建立。

## 現在可以做什麼

### 開發 forge-explorer（.NET）

```text
cd projects/forge-explorer
dotnet build Saintber.Forge.sln
dotnet test tests/Saintber.Forge.BlazorServer.UnitTests
```

整合測試是瀏覽器 E2E 測試，需要另外的環境，見 [`projects/forge-explorer/tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md`](projects/forge-explorer/tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md)。

### 使用 Spec Kit 開發

在**專案目錄內**執行 slash command，例如在 `projects/forge-explorer/` 內執行 `/speckit-specify`。細節見 [`docs/developer-guide/speckit-workflow.md`](docs/developer-guide/speckit-workflow.md)。

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
