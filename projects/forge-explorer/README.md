# forge-explorer

原 Saintber.Forge 的探索性工具集（.NET 8 / Blazor Server）。目前內容是 **Portal Home**（工具入口首頁，`001-portal-home`，已完成並封存）。

> **saintber 入口尚未實作。** 這個專案還沒有 `saintber.project.json` 與 install / configure / run，所以**不在** Hub 的 `catalog/index.json`，也不能用 `saintber` 呼叫。目前只能用下方的 `dotnet` 命令使用它。
> 命名空間 `Saintber.Forge.*` 與 `Saintber.Forge.sln` 的檔名沒有改變（遷移只改了路徑）。

## 結構

| 位置 | 內容 |
|---|---|
| `Saintber.Forge.sln` | 方案 |
| `src/Frontend/Saintber.Forge.BlazorServer/` | Blazor Server 前端 |
| `src/Persistence/Saintber.Forge.Persistence.EF.Postgres/` | EF Core / PostgreSQL |
| `tests/` | 單元測試、整合測試（Playwright E2E） |
| `docs/governance/policy/` | 本專案的 Policy（見其 `README.md`） |
| `.specify/memory/constitution.md` | 本專案的憲章 |
| `archive/changes/001-portal-home/` | 已完成工作包的封存（含輸入與驗證紀錄） |

## 建置與測試

在 `projects/forge-explorer/` 底下執行：

```text
dotnet build Saintber.Forge.sln
dotnet test tests/Saintber.Forge.BlazorServer.UnitTests
```

遷移後實測：建置 0 警告 0 錯誤；單元測試 1 個通過。

## 執行

`dotnet run` 預設**不會**載入 `appsettings.Development.json`（沒有設定環境時是 Production）。要使用開發設定，需明確指定環境：

```powershell
cd src/Frontend/Saintber.Forge.BlazorServer
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet run
```

（bash：`ASPNETCORE_ENVIRONMENT=Development dotnet run`）

需要先準備：
- **PostgreSQL**：連線字串 `ConnectionStrings:PortalDb`。`appsettings.json` 裡是**占位值**。真正的值請放在 **.NET User Secrets**（存於 repo 之外；專案已有 `UserSecretsId`），或**未納入版本控制的** `appsettings.Development.json`（被 `.gitignore` 排除）。**不要提交秘密。**
- Azure AD（`AzureAd` 區段）同樣是占位值，處理方式相同。
- 資料庫結構（EF Migration）**目前不在版本控制中**（repo 沒有 `Migrations/`），這是 `001-portal-home` 封存紀錄中記錄的已知缺口。
- 應用程式實際監聽的網址：repo **沒有** `launchSettings.json`，所以沒有預設值保證；需要時請自行指定（例如 `--urls`）。

## 整合測試（Playwright E2E）的限制

整合測試是瀏覽器端對端測試，**不是**單純的 `dotnet test`：
- 需要先安裝 Playwright 瀏覽器。
- 測試**固定要求**應用程式在 `https://localhost:7289`（`PortalHomeRwdTests.cs` 的 `BaseUrl`）。這是**測試的要求，不是應用程式目前的預設位址**：repo 沒有 `launchSettings.json`，一般的 `dotnet run` **不會**自動符合。
- 因此需要另外：讓應用程式監聽該網址、有可用的 **HTTPS 開發憑證**、以及可用的環境（PostgreSQL 與上述設定）。
- 遷移時**沒有執行**這些測試。

細節見 [`tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md`](tests/Saintber.Forge.BlazorServer.IntegrationTests/README.md)。

## 使用 Spec Kit 開發

**在這個目錄內**執行 slash command（例如 `/speckit-specify`），Spec Kit 會往上找最近的 `.specify/`，解析到本專案，而不是 Hub 根目錄。細節與限制見 Hub 的 [`docs/developer-guide/speckit-workflow.md`](../../docs/developer-guide/speckit-workflow.md)。

## 進一步

| 想知道 | 看這裡 |
|---|---|
| 給 AI 代理的指引 | [`AGENTS.md`](AGENTS.md) |
| 專案的 Policy | [`docs/governance/policy/README.md`](docs/governance/policy/README.md) |
| 001 的核對結果與已知缺口 | [`archive/changes/001-portal-home/archive.md`](archive/changes/001-portal-home/archive.md) |
| Hub 的遷移狀態 | [`../../docs/migration-status.md`](../../docs/migration-status.md) |
