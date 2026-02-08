# Research: Portal Home

**Feature**: Portal Home  
**Plan**: [plan.md](plan.md)  
**Date**: 2026-02-08

## Purpose

本文件記錄 Portal Home 功能在實作前需要研究與明確的技術決策點。所有研究結果皆已解決，無 NEEDS CLARIFICATION 遺留。

---

## R1. Microsoft Identity / OIDC 整合策略

### Decision

採用 **Microsoft.Identity.Web** 套件整合 Microsoft Identity Platform (Azure AD) 與 Blazor Server。

### Rationale

- Microsoft 官方支援，文件完整
- 與 ASP.NET Core 8.0 深度整合
- 自動處理 Token 刷新與過期
- 符合 `security-baseline.md` 第 2 節要求（OIDC支援）

### Implementation Approach

#### 1. NuGet 套件

```xml
<PackageReference Include="Microsoft.Identity.Web" Version="2.16.0" />
<PackageReference Include="Microsoft.Identity.Web.UI" Version="2.16.0" />
```

#### 2. Program.cs 設定

```csharp
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.UI;

var builder = WebApplication.CreateBuilder(args);

// 加入 Microsoft Identity 支援
builder.Services.AddMicrosoftIdentityWebAppAuthentication(
    builder.Configuration, "AzureAd");

builder.Services.AddAuthorization(options =>
{
    // 定義 Policy（可選，Portal Home 主要依賴 IsAuthenticated）
    options.AddPolicy("Authenticated", policy => policy.RequireAuthenticatedUser());
});

builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor()
    .AddMicrosoftIdentityConsentHandler();

builder.Services.AddControllersWithViews()
    .AddMicrosoftIdentityUI();

var app = builder.Application();
app.UseAuthentication();
app.UseAuthorization();
```

#### 3. appsettings.json 設定

```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "{TENANT_ID}",
    "ClientId": "{CLIENT_ID}",
    "ClientSecret": "{CLIENT_SECRET}",
    "CallbackPath": "/signin-oidc"
  }
}
```

**Note**: `{TENANT_ID}`, `{CLIENT_ID}`, `{CLIENT_SECRET}` 需在 Azure Portal 取得。

#### 4. Blazor 元件中使用身份資訊

```csharp
@using Microsoft.AspNetCore.Components.Authorization
@inject AuthenticationStateProvider AuthenticationStateProvider

@code {
    private bool isAuthenticated = false;
    private string? displayName;

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        isAuthenticated = user.Identity?.IsAuthenticated ?? false;
        if (isAuthenticated)
        {
            displayName = user.Identity?.Name;
        }
    }
}
```

### Token 管理策略

**Question**: Blazor Server 長連線下 Token 過期如何處理？

**Answer**: 
- Microsoft.Identity.Web 自動處理 Access Token 刷新（透過 Refresh Token）
- Token 完全過期時，`AuthenticationStateProvider` 回傳未驗證狀態
- Portal Home 檢測到 `isAuthenticated = false` 自動降級顯示公開 Tool（符合 spec Edge Case）

**降級策略**:
```csharp
// Index.razor
@code {
    private List<ToolRegistration> visibleTools = new();

    protected override async Task OnInitializedAsync()
    {
        var authState = await AuthenticationStateProvider.GetAuthenticationStateAsync();
        bool isAuthenticated = authState.User.Identity?.IsAuthenticated ?? false;

        // 依登入狀態篩選 Tool
        if (isAuthenticated)
        {
            visibleTools = await ToolService.GetAllToolsAsync();
        }
        else
        {
            visibleTools = await ToolService.GetPublicToolsAsync();
        }
    }
}
```

### References

- [Microsoft.Identity.Web Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/microsoft-identity-web)
- [Blazor Server Authentication](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/server)

---

## R2. Blazor Server RWD 最佳實踐

### Decision

採用 **CSS Grid + Media Queries** 實作 RWD 卡片佈局，定義三種斷點。

### Rationale

- Blazor 原生支援 CSS Isolation
- Grid 佈局靈活，易於維護
- Media Query 為標準 RWD 實踐（符合 `tech-baseline.md` 第 3 節）

### Implementation Approach

#### 1. CSS 斷點定義（`wwwroot/css/app.css`）

```css
/* 預設（手機） < 768px */
.tool-grid {
    display: grid;
    grid-template-columns: 1fr; /* 單欄 */
    gap: 1rem;
    padding: 1rem;
}

/* 平板 768px - 1199px */
@media (min-width: 768px) and (max-width: 1199px) {
    .tool-grid {
        grid-template-columns: repeat(2, 1fr); /* 2 欄 */
    }
}

/* 桌機 ≥ 1200px */
@media (min-width: 1200px) {
    .tool-grid {
        grid-template-columns: repeat(4, 1fr); /* 3-4 欄，此處使用 4 欄 */
    }
}
```

#### 2. Blazor 元件結構（`Pages/Index.razor`）

```razor
@page "/"
@using Saintber.Forge.BlazorServer.Services

<PageTitle>Portal Home</PageTitle>

<div class="tool-grid">
    @foreach (var tool in visibleTools)
    {
        <ToolCard Tool="@tool" />
    }
</div>

@if (visibleTools.Count == 0)
{
    <p class="no-tools-message">目前無可用功能</p>
}

@code {
    // ...（參見 R1 的程式碼）
}
```

#### 3. ToolCard 元件（`Components/ToolCard.razor`）

```razor
<div class="tool-card">
    <h3>@Tool.ToolName</h3>
    <p>@Tool.Description</p>
    <a href="@Tool.Url" class="tool-link">進入</a>
</div>

@code {
    [Parameter]
    public required ToolRegistration Tool { get; set; }
}
```

#### 4. ToolCard CSS Isolation（`Components/ToolCard.razor.css`）

```css
.tool-card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.5rem;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.tool-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.tool-card h3 {
    margin-top: 0;
    font-size: 1.25rem;
    color: #333;
}

.tool-card p {
    color: #666;
    font-size: 0.9rem;
    line-height: 1.4;
}

.tool-link {
    display: inline-block;
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background-color: #0078d4;
    color: white;
    text-decoration: none;
    border-radius: 4px;
}
```

### Testing Strategy

**Unit Level** (bUnit):
- 測試 `ToolCard` 元件渲染正確的 HTML
- 測試卡片數量與傳入參數一致

**E2E Level** (Playwright - Gate B):
```csharp
[Test]
public async Task PortalHome_Desktop_ShowsMultiColumnLayout()
{
    await Page.SetViewportSizeAsync(1200, 800);
    await Page.GotoAsync("http://localhost:5000");
    
    var gridColumns = await Page.EvaluateAsync<int>(
        @"() => {
            const grid = document.querySelector('.tool-grid');
            return window.getComputedStyle(grid).gridTemplateColumns.split(' ').length;
        }"
    );
    
    Assert.That(gridColumns, Is.EqualTo(4)); // 4 欄
}
```

### References

- [CSS Grid Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
- [Blazor CSS Isolation](https://learn.microsoft.com/en-us/aspnet/core/blazor/components/css-isolation)

---

## R3. PostgreSQL Schema 設計

### Decision

採用 **EF Core Code-First** 方式定義 Entity，使用 Migrations 管理 Schema 變更。

### Rationale

- 符合 `tech-baseline.md` 第 4 節（EF Core 使用原則）
- Code-First 提供版本控制與團隊協作友善性
- Migration 自動化 Schema 部署

### Implementation Approach

#### 1. Entity 定義（`Persistence/Entities/ToolRegistration.cs`）

```csharp
using System.ComponentModel.DataAnnotations;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

public class ToolRegistration
{
    [Key]
    public Guid ToolId { get; set; }

    [Required]
    [MaxLength(100)]
    public required string ToolName { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(2000)]
    public required string Url { get; set; }

    public bool IsPublic { get; set; } = true;

    public int DisplayOrder { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

#### 2. Entity 定義（`Persistence/Entities/UserIdentity.cs`）

```csharp
using System.ComponentModel.DataAnnotations;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

public class UserIdentity
{
    [Key]
    [MaxLength(450)] // Microsoft Identity Object ID
    public required string UserId { get; set; }

    [MaxLength(200)]
    public string? DisplayName { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    public DateTime? LastLoginAt { get; set; }
}
```

#### 3. DbContext（`Persistence/PortalDbContext.cs`）

```csharp
using Microsoft.EntityFrameworkCore;
using Saintber.Forge.Persistence.EF.Postgres.Entities;

namespace Saintber.Forge.Persistence.EF.Postgres;

public class PortalDbContext : DbContext
{
    public PortalDbContext(DbContextOptions<PortalDbContext> options)
        : base(options)
    {
    }

    public DbSet<ToolRegistration> ToolRegistrations => Set<ToolRegistration>();
    public DbSet<UserIdentity> UserIdentities => Set<UserIdentity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Index 設計
        modelBuilder.Entity<ToolRegistration>()
            .HasIndex(t => t.DisplayOrder)
            .HasDatabaseName("IX_ToolRegistrations_DisplayOrder");

        modelBuilder.Entity<ToolRegistration>()
            .HasIndex(t => t.IsPublic)
            .HasDatabaseName("IX_ToolRegistrations_IsPublic");
    }
}
```

#### 4. DI 註冊（`Program.cs`）

```csharp
builder.Services.AddDbContext<PortalDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("PortalDb")));
```

#### 5. Migration 建立

```bash
# 建立初始 Migration
dotnet ef migrations add InitialCreate --project src/Persistence/Saintber.Forge.Persistence.EF.Postgres

# 套用至資料庫
dotnet ef database update --project src/Persistence/Saintber.Forge.Persistence.EF.Postgres
```

### Seed Data Strategy

**Question**: 初期 Tool 資料如何維護？

**Answer**: 使用 EF Seeding 機制

```csharp
// PortalDbContext.cs
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<ToolRegistration>().HasData(
        new ToolRegistration
        {
            ToolId = Guid.Parse("00000000-0000-0000-0000-000000000001"),
            ToolName = "範例工具 A",
            Description = "這是一個公開的範例工具",
            Url = "/tools/example-a",
            IsPublic = true,
            DisplayOrder = 1
        },
        new ToolRegistration
        {
            ToolId = Guid.Parse("00000000-0000-0000-0000-000000000002"),
            ToolName = "範例工具 B（需登入）",
            Description = "這是一個需要登入的範例工具",
            Url = "/tools/example-b",
            IsPublic = false,
            DisplayOrder = 2
        }
    );
}
```

### Future Extension

未來可擴充為 Admin UI 或 API 進行 Tool CRUD（目前 Out of Scope）。

### References

- [EF Core Migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)
- [Npgsql EF Core Provider](https://www.npgsql.org/efcore/)

---

## R4. Tool Registration 資料來源

### Decision

初期採用 **Seed Data（EF Migrations）** 維護 Tool 資訊，未來可擴充為 Admin API。

### Rationale

- MVP 階段 Tool 數量少（5-20 個），手動 Seed Data 即可
- 符合 SC-005（資料驅動設計，無需修改程式碼）
- 保留未來擴充彈性（Admin UI / API）

### Implementation

參見 R3 的 Seed Data Strategy。

### Future Options

1. **Admin API** (Phase 2+):
   - POST /api/admin/tools
   - PUT /api/admin/tools/{id}
   - DELETE /api/admin/tools/{id}

2. **Admin UI** (Phase 3+):
   - 獨立管理介面（可能為另一個 Blazor Server 頁面或 SPA）
   - 需授權（管理員角色）

### Decision Log

不在 MVP 實作 Admin 功能，理由：
- 初期 Tool 變更頻率低
- Seed Data 已滿足需求
- 可降低實作複雜度

---

## R5. Gate B 測試策略（RWD 驗證）

### Decision

採用 **Playwright for .NET** 進行 E2E RWD 測試，Gate B 初期手動驗證，後續可自動化。

### Rationale

- Playwright 支援多瀏覽器（Chromium, Firefox, WebKit）
- 可程式化控制視窗寬度
- 可截圖比對或 CSS 屬性斷言
- 符合 `testing-governance.md` 整合測試原則

### Implementation Approach

#### 1. NuGet 套件

```xml
<PackageReference Include="Microsoft.Playwright" Version="1.40.0" />
<PackageReference Include="Microsoft.Playwright.NUnit" Version="1.40.0" />
```

#### 2. 測試範例（`Tests/IntegrationTests/E2E/PortalHomeRwdTests.cs`）

```csharp
using Microsoft.Playwright;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace Saintber.Forge.BlazorServer.IntegrationTests.E2E;

[Parallelizable(ParallelScope.Self)]
[TestFixture]
public class PortalHomeRwdTests : PageTest
{
    [Test]
    public async Task Desktop_ShowsMultiColumnLayout()
    {
        await Page.SetViewportSizeAsync(1200, 800);
        await Page.GotoAsync("http://localhost:5000");

        var grid = Page.Locator(".tool-grid");
        await Expect(grid).ToBeVisibleAsync();

        // 驗證 grid-template-columns 為 4 欄
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        Assert.That(columns.Split(' ').Length, Is.EqualTo(4));
    }

    [Test]
    public async Task Tablet_ShowsTwoColumnLayout()
    {
        await Page.SetViewportSizeAsync(800, 600);
        await Page.GotoAsync("http://localhost:5000");

        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        Assert.That(columns.Split(' ').Length, Is.EqualTo(2));
    }

    [Test]
    public async Task Mobile_ShowsSingleColumnLayout()
    {
        await Page.SetViewportSizeAsync(375, 667);
        await Page.GotoAsync("http://localhost:5000");

        var grid = Page.Locator(".tool-grid");
        var columns = await grid.EvaluateAsync<string>(
            "el => window.getComputedStyle(el).gridTemplateColumns"
        );
        Assert.That(columns.Split(' ').Length, Is.EqualTo(1));
    }

    [Test]
    public async Task NoHorizontalScrollbar_OnMobile()
    {
        await Page.SetViewportSizeAsync(375, 667);
        await Page.GotoAsync("http://localhost:5000");

        var bodyWidth = await Page.EvaluateAsync<int>("() => document.body.scrollWidth");
        var viewportWidth = await Page.EvaluateAsync<int>("() => window.innerWidth");

        Assert.That(bodyWidth, Is.LessThanOrEqualTo(viewportWidth));
    }
}
```

#### 3. 執行測試

```bash
# 首次執行需安裝瀏覽器
pwsh bin/Debug/net8.0/playwright.ps1 install

# 執行測試
dotnet test --filter "Category=E2E"
```

### Gate B Manual Verification

初期實作完成後，Gate B 手動驗證步驟：

1. 開啟 Portal Home（http://localhost:5000）
2. 使用 Chrome DevTools 調整視窗寬度：
   - 1920px (桌機): 驗證 4 欄佈局
   - 800px (平板): 驗證 2 欄佈局
   - 375px (手機): 驗證單欄佈局
3. 驗證無水平捲軸
4. 測試卡片點擊導覽功能
5. 記錄結果於 Verification Record

### References

- [Playwright for .NET](https://playwright.dev/dotnet/)
- [Responsive Design Testing](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)

---

## Summary

所有 Phase 0 研究項目已完成：

| Research Item | Status | Output |
|---------------|--------|--------|
| R1. Microsoft Identity 整合 | ✅ Resolved | 完整設定步驟與程式碼範例 |
| R2. Blazor Server RWD | ✅ Resolved | CSS 斷點定義與元件結構 |
| R3. PostgreSQL Schema 設計 | ✅ Resolved | Entity 定義與 Migration 指令 |
| R4. Tool Registration 資料來源 | ✅ Resolved | Seed Data 策略 |
| R5. Gate B 測試策略 | ✅ Resolved | Playwright 測試範例 |

**NEEDS CLARIFICATION Count**: 0

**Ready for Phase 1**: ✅ Yes
