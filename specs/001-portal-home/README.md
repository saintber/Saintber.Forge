# Portal Home - Developer Quick Start

**Feature**: Portal Home  
**Last Updated**: 2026-02-08

## Quick Start (5 Minutes)

### 1. Prerequisites

- .NET SDK 8.0+
- PostgreSQL 15.x
- Azure AD App Registration（見 [quickstart.md](quickstart.md) 第 1.2 節）

### 2. Database Setup

```powershell
# 建立資料庫
psql -U postgres -c "CREATE DATABASE saintber_forge_dev;"

# 設定連線字串（User Secrets）
cd src/Frontend/Saintber.Forge.BlazorServer
dotnet user-secrets set "ConnectionStrings:PortalDb" "Host=localhost;Database=saintber_forge_dev;Username=postgres;Password=your_password"

# 設定 Azure AD 資訊（替換為實際值）
dotnet user-secrets set "AzureAd:TenantId" "YOUR_TENANT_ID"
dotnet user-secrets set "AzureAd:ClientId" "YOUR_CLIENT_ID"
dotnet user-secrets set "AzureAd:ClientSecret" "YOUR_CLIENT_SECRET"
```

### 3. Run Migrations

```powershell
# 回到專案根目錄
cd ../../..

# 套用 Migration
dotnet ef database update --project src/Persistence/Saintber.Forge.Persistence.EF.Postgres --startup-project src/Frontend/Saintber.Forge.BlazorServer
```

### 4. Run Application

```powershell
cd src/Frontend/Saintber.Forge.BlazorServer
dotnet run
```

開啟瀏覽器訪問 `https://localhost:5001`

- **未登入**: 顯示公開 Tool 卡片（範例工具 A）
- **登入**: 點擊「登入」按鈕，完成 Microsoft 登入後顯示所有 Tool 卡片（範例工具 A + B）

### 5. Run Tests

```powershell
# 單元測試
cd tests/Saintber.Forge.BlazorServer.UnitTests
dotnet test

# 整合測試（需啟動應用程式）
cd ../Saintber.Forge.BlazorServer.IntegrationTests
dotnet test
```

## Detailed Documentation

完整的開發環境設定、疑難排解與進階配置請參見：

- [quickstart.md](quickstart.md) - 詳細開發指南
- [plan.md](plan.md) - 技術架構與設計決策
- [spec.md](spec.md) - 功能需求規格
- [tasks.md](tasks.md) - 實作任務清單

## Troubleshooting

常見問題快速查詢：

| 問題 | 解決方案 |
|-----|---------|
| Migration 失敗 | 確認 PostgreSQL 服務已啟動，連線字串正確 |
| 登入後無顯示 Tool | 檢查 Azure AD 設定，確認 Redirect URI 正確 |
| 建置錯誤 | 執行 `dotnet restore` 重新還原套件 |

完整疑難排解請見 [quickstart.md](quickstart.md) 第 6 節。

## Next Steps

- 閱讀 [data-model.md](data-model.md) 了解資料結構
- 閱讀 [contracts/](contracts/) 了解服務合約
- 執行 RWD 測試（Chrome DevTools）驗證響應式佈局
