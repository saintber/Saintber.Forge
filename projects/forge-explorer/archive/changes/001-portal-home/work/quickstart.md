# Quickstart: Portal Home

**Feature**: Portal Home  
**Plan**: [plan.md](plan.md)  
**Date**: 2026-02-08

## Purpose

本文件提供 Portal Home 功能的快速開發環境設定、第一次執行、測試與疑難排解指南。

---

## 1. Prerequisites

### 1.1. Development Tools

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| .NET SDK | 8.0.100 | 編譯與執行 Blazor Server |
| PostgreSQL | 15.x | 資料庫伺服器 |
| Visual Studio 2022 / VS Code | Latest | IDE（建議） |
| Git | 2.x | 版本控制 |
| Azure CLI | 2.50+ | Azure AD App Registration（可選） |

**Installation**:

```powershell
# 檢查 .NET SDK 版本
dotnet --version  # 應顯示 8.0.x

# 檢查 PostgreSQL 版本
psql --version    # 應顯示 15.x

# 安裝 EF Core Tools（用於 Migration）
dotnet tool install --global dotnet-ef
```

### 1.2. Azure AD App Registration

**Required for Authentication**:

1. 前往 [Azure Portal](https://portal.azure.com)
2. 搜尋「App registrations」→ 「New registration」
3. 設定：
   - **Name**: `Saintber.Forge.Portal.Dev`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: 
     - Platform: `Web`
     - URI: `https://localhost:7289/signin-oidc`
4. 建立後，記錄以下資訊：
   - **Application (client) ID**
   - **Directory (tenant) ID**
5. 前往「Certificates & secrets」→ 「New client secret」
   - 記錄 **Client Secret Value**（僅顯示一次）
6. 前往「API permissions」→ 「Add a permission」
   - Microsoft Graph → Delegated permissions → `User.Read`

---

## 2. Local Development Setup

### 2.1. Clone Repository

```powershell
git clone https://github.com/saintber/forge.git
cd forge
git checkout 001-portal-home
```

### 2.2. Database Setup

#### 建立 PostgreSQL 資料庫

```powershell
# 連線至 PostgreSQL
psql -U postgres

# 建立資料庫
CREATE DATABASE saintber_forge_dev;

# 建立用戶（可選）
CREATE USER forge_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE saintber_forge_dev TO forge_user;

# 離開
\q
```

#### 設定連線字串

**Option 1: User Secrets（建議）**

```powershell
cd src/Frontend/Saintber.Forge.BlazorServer

# 設定連線字串
dotnet user-secrets set "ConnectionStrings:PortalDb" "Host=localhost;Database=saintber_forge_dev;Username=postgres;Password=your_password"

# 設定 Azure AD 資訊
dotnet user-secrets set "AzureAd:TenantId" "YOUR_TENANT_ID"
dotnet user-secrets set "AzureAd:ClientId" "YOUR_CLIENT_ID"
dotnet user-secrets set "AzureAd:ClientSecret" "YOUR_CLIENT_SECRET"
```

**Option 2: appsettings.Development.json（不建議提交）**

```json
{
  "ConnectionStrings": {
    "PortalDb": "Host=localhost;Database=saintber_forge_dev;Username=postgres;Password=your_password"
  },
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "YOUR_TENANT_ID",
    "ClientId": "YOUR_CLIENT_ID",
    "ClientSecret": "YOUR_CLIENT_SECRET",
    "CallbackPath": "/signin-oidc"
  }
}
```

### 2.3. Install Dependencies

```powershell
# 從 Repository Root 執行
dotnet restore
```

### 2.4. Apply Database Migrations

```powershell
# 從 Persistence 專案目錄執行
cd src/Persistence/Saintber.Forge.Persistence.EF.Postgres

# 建立初始 Migration（若尚未建立）
dotnet ef migrations add InitialCreate --startup-project ../../Frontend/Saintber.Forge.BlazorServer

# 套用至資料庫
dotnet ef database update --startup-project ../../Frontend/Saintber.Forge.BlazorServer
```

**Expected Output**:

```
Build started...
Build succeeded.
Applying migration '20260208000000_InitialCreate'.
Done.
```

**Verify**:

```powershell
psql -U postgres -d saintber_forge_dev -c "\dt"

# 應顯示:
#  Schema |       Name        | Type  |  Owner   
# --------+-------------------+-------+----------
#  public | ToolRegistrations | table | postgres
#  public | UserIdentities    | table | postgres
```

### 2.5. Trust Development Certificate

```powershell
# 信任 HTTPS 憑證（僅需執行一次）
dotnet dev-certs https --trust
```

---

## 3. First Run

### 3.1. Start Blazor Server

```powershell
cd src/Frontend/Saintber.Forge.BlazorServer
dotnet run
```

**Expected Output**:

```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7289
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5114
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

### 3.2. Access Portal Home

1. 開啟瀏覽器，訪問 `https://localhost:7289`
2. 若未登入：
   - 應顯示公開 Tool 卡片（範例工具 A）
   - 導航列顯示「登入」按鈕
3. 點擊「登入」：
   - 自動重導向至 Microsoft Identity 登入頁
   - 輸入 Azure AD 帳號密碼
   - 登入成功後返回 Portal Home
4. 登入後：
   - 應顯示所有 Tool 卡片（範例工具 A 與 B）
   - 導航列顯示「{用戶名稱}」與「登出」按鈕

### 3.3. Verify Seed Data

```powershell
psql -U postgres -d saintber_forge_dev -c "SELECT * FROM \"ToolRegistrations\";"

# 應顯示:
#                toolid                |       toolname        |      description       |       url        | ispublic | displayorder
# -------------------------------------+-----------------------+------------------------+------------------+----------+--------------
#  10000000-0000-0000-0000-000000000001 | 範例工具 A            | 這是一個公開的範例工具 | /tools/example-a |    t     |      1
#  10000000-0000-0000-0000-000000000002 | 範例工具 B（需登入）  | 這是一個需要登入的... | /tools/example-b |    f     |      2
```

---

## 4. Running Tests

### 4.1. Unit Tests (xUnit + bUnit)

```powershell
cd tests/Saintber.Forge.BlazorServer.UnitTests
dotnet test
```

**Expected Output**:

```
Passed!  - Failed:     0, Passed:    15, Skipped:     0, Total:    15
```

### 4.2. E2E Tests (Playwright)

#### 首次執行需安裝瀏覽器

```powershell
cd tests/Saintber.Forge.BlazorServer.IntegrationTests

# 安裝 Playwright 瀏覽器
pwsh bin/Debug/net8.0/playwright.ps1 install
```

#### 執行測試

```powershell
# 確保 Blazor Server 正在執行（另開 Terminal）
cd src/Frontend/Saintber.Forge.BlazorServer
dotnet run

# 執行 E2E 測試
cd tests/Saintber.Forge.BlazorServer.IntegrationTests
dotnet test --filter "Category=E2E"
```

**Expected Output**:

```
Passed!  - Failed:     0, Passed:     4, Skipped:     0, Total:     4
```

### 4.3. Manual RWD Testing (Gate B)

參見 [plan.md](plan.md) Phase 2 - Gate B 驗證步驟。

---

## 5. Troubleshooting

### 5.1. Migration 失敗：「relation does not exist」

**Symptom**:

```
Npgsql.PostgresException: 42P01: relation "ToolRegistrations" does not exist
```

**Solution**:

```powershell
# 刪除資料庫（謹慎使用）
psql -U postgres -c "DROP DATABASE saintber_forge_dev;"
psql -U postgres -c "CREATE DATABASE saintber_forge_dev;"

# 重新套用 Migration
cd src/Persistence/Saintber.Forge.Persistence.EF.Postgres
dotnet ef database update --startup-project ../../Frontend/Saintber.Forge.BlazorServer
```

### 5.2. Microsoft Identity 驗證失敗

**Symptom**:

```
AADSTS700016: Application with identifier 'xxx' was not found in the directory
```

**Solution**:

1. 檢查 `appsettings.json` 或 User Secrets 中的 `ClientId` 是否正確
2. 檢查 Azure AD App Registration 是否存在
3. 確認 Redirect URI 為 `https://localhost:7289/signin-oidc`

### 5.3. HTTPS 憑證錯誤

**Symptom**:

```
The SSL connection could not be established
```

**Solution**:

```powershell
# 重新信任憑證
dotnet dev-certs https --clean
dotnet dev-certs https --trust
```

### 5.4. Blazor Server 連線失敗

**Symptom**:

瀏覽器 Console 顯示：`Failed to connect to the server. Error: WebSocket failed to connect.`

**Solution**:

1. 檢查防火牆是否封鎖 `localhost:7289`
2. 確認 `Program.cs` 有設定 `app.MapBlazorHub()`
3. 檢查瀏覽器是否支援 WebSocket（現代瀏覽器皆支援）

### 5.5. Tool 卡片未顯示

**Symptom**:

Portal Home 顯示「目前無可用功能」

**Solution**:

```powershell
# 檢查 Seed Data 是否正確寫入
psql -U postgres -d saintber_forge_dev -c "SELECT COUNT(*) FROM \"ToolRegistrations\";"

# 若為 0，重新套用 Migration
cd src/Persistence/Saintber.Forge.Persistence.EF.Postgres
dotnet ef migrations remove
dotnet ef migrations add InitialCreate --startup-project ../../Frontend/Saintber.Forge.BlazorServer
dotnet ef database update --startup-project ../../Frontend/Saintber.Forge.BlazorServer
```

---

## 6. Development Workflow

### 6.1. 新增 Tool 至 Seed Data

**步驟**:

1. 編輯 `src/Persistence/Saintber.Forge.Persistence.EF.Postgres/PortalDbContext.cs`
2. 在 `OnModelCreating` 中新增 `HasData` 項目：

```csharp
modelBuilder.Entity<ToolRegistration>().HasData(
    // ...existing tools
    new ToolRegistration
    {
        ToolId = Guid.Parse("10000000-0000-0000-0000-000000000003"),
        ToolName = "新工具 C",
        Description = "這是新增的工具",
        Url = "/tools/new-tool-c",
        IsPublic = true,
        DisplayOrder = 3
    }
);
```

3. 建立新 Migration：

```powershell
cd src/Persistence/Saintber.Forge.Persistence.EF.Postgres
dotnet ef migrations add AddToolC --startup-project ../../Frontend/Saintber.Forge.BlazorServer
dotnet ef database update --startup-project ../../Frontend/Saintber.Forge.BlazorServer
```

### 6.2. 修改 CSS 樣式

**步驟**:

1. 編輯 `src/Frontend/Saintber.Forge.BlazorServer/Components/ToolCard.razor.css`
2. 儲存後，Blazor Hot Reload 自動刷新（無需重啟）

**Note**: 若修改未生效，按 `Ctrl+F5` 強制重新載入

### 6.3. 除錯登入流程

**步驟**:

1. 在 `appsettings.Development.json` 啟用詳細日誌：

```json
{
  "Logging": {
    "LogLevel": {
      "Microsoft.Identity": "Debug",
      "Microsoft.AspNetCore.Authentication": "Debug"
    }
  }
}
```

2. 重新執行 `dotnet run`
3. 查看 Console 輸出的 Token Exchange 詳細資訊

---

## 7. Next Steps

完成 Quickstart 後，建議：

1. **執行完整測試**: `dotnet test` 確保所有單元測試通過
2. **手動 RWD 驗證**: 使用 Chrome DevTools 測試不同裝置尺寸
3. **閱讀 [plan.md](plan.md)**: 了解 Phase 2 實作任務
4. **查看 [data-model.md](data-model.md)**: 深入理解資料結構

---

## 8. References

- [.NET 8 Documentation](https://learn.microsoft.com/en-us/dotnet/core/whats-new/dotnet-8)
- [Blazor Server Tutorial](https://learn.microsoft.com/en-us/aspnet/core/blazor/tutorials/)
- [EF Core Migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [Microsoft.Identity.Web Setup](https://learn.microsoft.com/en-us/azure/active-directory/develop/microsoft-identity-web)

---

## Compliance

| Policy | Status | Notes |
|--------|--------|-------|
| tech-baseline.md 第 1 節（.NET 8 SDK） | ✅ | 使用 net8.0 Target Framework |
| security-baseline.md 第 4 節（Secret 管理） | ✅ | 使用 User Secrets |
| testing-governance.md 第 2 節（自動化測試） | ✅ | 包含 xUnit, bUnit, Playwright 測試 |

**Ready for Implementation**: ✅ Yes
