# Data Model: Portal Home

**Feature**: Portal Home  
**Plan**: [plan.md](plan.md)  
**Research**: [research.md](research.md)  
**Date**: 2026-02-08

## Purpose

本文件定義 Portal Home 功能所需的資料模型（Entities）、資料庫 Schema、索引設計與關聯關係。

---

## 1. Entity: ToolRegistration

### 描述

儲存工具（Tool）的註冊資訊，包含名稱、說明、URL、公開性與顯示順序。

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `ToolId` | `GUID` | PRIMARY KEY | Tool 唯一識別碼 |
| `ToolName` | `VARCHAR(100)` | NOT NULL | Tool 名稱（顯示於卡片） |
| `Description` | `VARCHAR(500)` | NULL | Tool 說明文字 |
| `Url` | `VARCHAR(2000)` | NOT NULL | Tool 進入 URL（相對或絕對路徑） |
| `IsPublic` | `BOOLEAN` | NOT NULL, DEFAULT TRUE | 是否為公開 Tool（未登入可見） |
| `DisplayOrder` | `INTEGER` | NOT NULL, DEFAULT 0 | 顯示順序（升冪排列） |
| `CreatedAt` | `TIMESTAMP` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 建立時間（UTC） |
| `UpdatedAt` | `TIMESTAMP` | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 最後更新時間（UTC） |

### Indexes

```sql
-- Primary Key
CREATE UNIQUE INDEX PK_ToolRegistrations ON ToolRegistrations (ToolId);

-- Query Optimization: 排序查詢
CREATE INDEX IX_ToolRegistrations_DisplayOrder ON ToolRegistrations (DisplayOrder);

-- Query Optimization: 公開性篩選
CREATE INDEX IX_ToolRegistrations_IsPublic ON ToolRegistrations (IsPublic);
```

### EF Core Entity

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

[Table("ToolRegistrations")]
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

    [Required]
    public bool IsPublic { get; set; } = true;

    [Required]
    public int DisplayOrder { get; set; } = 0;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

### Validation Rules

1. `ToolName`: 不可為空，最大 100 字元
2. `Description`: 可為空，最大 500 字元
3. `Url`: 不可為空，最大 2000 字元，需為有效 URL 格式（由 Business Logic 驗證）
4. `IsPublic`: 預設值為 `true`
5. `DisplayOrder`: 預設值為 0，數值越小越優先顯示

### Business Logic

#### 查詢所有 Tool（登入用戶）

```csharp
public async Task<List<ToolRegistration>> GetAllToolsAsync()
{
    return await _dbContext.ToolRegistrations
        .OrderBy(t => t.DisplayOrder)
        .ThenBy(t => t.ToolName)
        .ToListAsync();
}
```

#### 查詢公開 Tool（未登入用戶）

```csharp
public async Task<List<ToolRegistration>> GetPublicToolsAsync()
{
    return await _dbContext.ToolRegistrations
        .Where(t => t.IsPublic)
        .OrderBy(t => t.DisplayOrder)
        .ThenBy(t => t.ToolName)
        .ToListAsync();
}
```

### State Transitions

`ToolRegistration` 為靜態資料（Portal Home 僅讀取），無狀態轉換。

未來若實作 Admin API，可能狀態：
- `Draft` → `Published` → `Archived`（Out of Scope for MVP）

---

## 2. Entity: UserIdentity

### 描述

儲存用戶的基本身份資訊（來自 Microsoft Identity），用於追蹤登入歷史。

### Schema

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `UserId` | `VARCHAR(450)` | PRIMARY KEY | Microsoft Identity Object ID |
| `DisplayName` | `VARCHAR(200)` | NULL | 用戶顯示名稱 |
| `Email` | `VARCHAR(200)` | NULL | 用戶電子郵件 |
| `LastLoginAt` | `TIMESTAMP` | NULL | 最後登入時間（UTC） |

### Indexes

```sql
-- Primary Key
CREATE UNIQUE INDEX PK_UserIdentities ON UserIdentities (UserId);

-- Query Optimization: Email 查詢（未來可能需要）
CREATE INDEX IX_UserIdentities_Email ON UserIdentities (Email);
```

### EF Core Entity

```csharp
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

[Table("UserIdentities")]
public class UserIdentity
{
    [Key]
    [MaxLength(450)] // Microsoft Identity Object ID 長度
    public required string UserId { get; set; }

    [MaxLength(200)]
    public string? DisplayName { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    public DateTime? LastLoginAt { get; set; }
}
```

### Validation Rules

1. `UserId`: 不可為空，最大 450 字元（Microsoft Identity 標準長度）
2. `DisplayName`: 可為空，最大 200 字元
3. `Email`: 可為空，最大 200 字元，需符合 Email 格式（由 Business Logic 驗證）
4. `LastLoginAt`: 可為空（首次登入前為 NULL）

### Business Logic

#### 更新最後登入時間

```csharp
public async Task UpdateLastLoginAsync(string userId, string? displayName, string? email)
{
    var user = await _dbContext.UserIdentities
        .FirstOrDefaultAsync(u => u.UserId == userId);

    if (user == null)
    {
        // 首次登入，建立紀錄
        user = new UserIdentity
        {
            UserId = userId,
            DisplayName = displayName,
            Email = email,
            LastLoginAt = DateTime.UtcNow
        };
        _dbContext.UserIdentities.Add(user);
    }
    else
    {
        // 更新最後登入時間
        user.LastLoginAt = DateTime.UtcNow;
        user.DisplayName = displayName; // 更新可能變動的資訊
        user.Email = email;
    }

    await _dbContext.SaveChangesAsync();
}
```

**呼叫時機**: 
- Blazor Server 啟動時（`OnInitializedAsync`）檢查 `AuthenticationStateProvider`
- 若 `isAuthenticated = true`，呼叫 `UpdateLastLoginAsync`

### State Transitions

無明確狀態欄位，僅追蹤登入時間。

---

## 3. Relationships

目前兩個 Entity 之間**無關聯**（Portal Home 不需要追蹤「用戶使用了哪個 Tool」）。

### Future Extensions（Out of Scope）

若未來需要追蹤用戶操作：

```csharp
public class ToolUsageLog
{
    public Guid LogId { get; set; }
    public required string UserId { get; set; } // FK to UserIdentity
    public Guid ToolId { get; set; }            // FK to ToolRegistration
    public DateTime AccessedAt { get; set; }

    // Navigation Properties
    public UserIdentity? User { get; set; }
    public ToolRegistration? Tool { get; set; }
}
```

---

## 4. Database Migration Strategy

### Initial Migration

```bash
cd src/Persistence/Saintber.Forge.Persistence.EF.Postgres
dotnet ef migrations add InitialCreate --startup-project ../../Frontend/Saintber.Forge.BlazorServer
dotnet ef database update --startup-project ../../Frontend/Saintber.Forge.BlazorServer
```

### Migration 檔案結構

```
Migrations/
├── 20260208000000_InitialCreate.cs
├── 20260208000000_InitialCreate.Designer.cs
└── PortalDbContextModelSnapshot.cs
```

### Seed Data（包含於 Migration）

```csharp
// Migrations/20260208000000_InitialCreate.cs
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(
        name: "ToolRegistrations",
        columns: table => new
        {
            ToolId = table.Column<Guid>(nullable: false),
            ToolName = table.Column<string>(maxLength: 100, nullable: false),
            // ...其他欄位
        });

    // Seed Data
    migrationBuilder.InsertData(
        table: "ToolRegistrations",
        columns: new[] { "ToolId", "ToolName", "Description", "Url", "IsPublic", "DisplayOrder", "CreatedAt", "UpdatedAt" },
        values: new object[]
        {
            Guid.Parse("10000000-0000-0000-0000-000000000001"),
            "範例工具 A",
            "這是一個公開的範例工具",
            "/tools/example-a",
            true,
            1,
            DateTime.UtcNow,
            DateTime.UtcNow
        });

    migrationBuilder.InsertData(
        table: "ToolRegistrations",
        columns: new[] { "ToolId", "ToolName", "Description", "Url", "IsPublic", "DisplayOrder", "CreatedAt", "UpdatedAt" },
        values: new object[]
        {
            Guid.Parse("10000000-0000-0000-0000-000000000002"),
            "範例工具 B（需登入）",
            "這是一個需要登入的範例工具",
            "/tools/example-b",
            false,
            2,
            DateTime.UtcNow,
            DateTime.UtcNow
        });
}
```

---

## 5. Performance Considerations

### Query Patterns

Portal Home 主要查詢模式：

```sql
-- 登入用戶（所有 Tool）
SELECT * FROM ToolRegistrations
ORDER BY DisplayOrder, ToolName;

-- 未登入用戶（僅公開 Tool）
SELECT * FROM ToolRegistrations
WHERE IsPublic = true
ORDER BY DisplayOrder, ToolName;
```

### Index Coverage

- `IX_ToolRegistrations_DisplayOrder`: 加速排序查詢
- `IX_ToolRegistrations_IsPublic`: 加速公開性篩選

### Expected Data Volume

- ToolRegistrations: 5-50 筆（初期）
- UserIdentities: 10-1000 筆（取決於組織規模）

**效能影響**: 資料量小，查詢無需額外優化。

---

## 6. Compliance Check

### Against Constitution

| Principle | Compliance | Notes |
|-----------|------------|-------|
| Principle 3 (Tool 資料隔離) | ✅ | ToolRegistration 僅儲存 Tool 註冊資訊，不儲存 Tool 內部資料 |
| Principle 4 (DI 設計) | ✅ | DbContext 透過 DI 注入（`services.AddDbContext`） |
| Principle 8 (Config 管理) | ✅ | 連線字串由 `appsettings.json` 管理 |

### Against Policies

- **tech-baseline.md 第 4 節**（EF Core 使用原則）: ✅ 符合
- **security-baseline.md 第 3 節**（資料加密）: ⚠️ PostgreSQL 連線需啟用 SSL（由環境設定）

---

## Summary

| Entity | Tables | Indexes | Relationships |
|--------|--------|---------|---------------|
| ToolRegistration | 1 | 2 | None |
| UserIdentity | 1 | 1 | None |
| **Total** | **2** | **3** | **0** |

**Migration Status**: Ready for Initial Migration  
**Seed Data**: 2 sample ToolRegistrations

**Next Steps**: 參見 [plan.md](plan.md) Phase 1 - Contracts 定義。
