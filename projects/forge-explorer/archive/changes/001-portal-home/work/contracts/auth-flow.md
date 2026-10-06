# Authentication Flow: Portal Home

**Feature**: Portal Home  
**Plan**: [../plan.md](../plan.md)  
**Date**: 2026-02-08

## Purpose

本文件說明 Portal Home 如何與 Microsoft Identity Platform (Azure AD) 整合，實現 OIDC 驗證流程。

---

## 1. Architecture Overview

```
┌─────────────┐          ┌───────────────────────┐          ┌──────────────────┐
│   Browser   │          │   Blazor Server       │          │  Microsoft       │
│             │          │   (ASP.NET Core)      │          │  Identity        │
│             │          │                       │          │  Platform        │
└─────────────┘          └───────────────────────┘          └──────────────────┘
      │                             │                                 │
      │  1. GET /                   │                                 │
      │────────────────────────────>│                                 │
      │                             │                                 │
      │  2. Redirect to Login       │                                 │
      │<────────────────────────────│                                 │
      │                             │                                 │
      │  3. Authenticate            │                                 │
      │──────────────────────────────────────────────────────────────>│
      │                             │                                 │
      │  4. Authorization Code      │                                 │
      │<──────────────────────────────────────────────────────────────│
      │                             │                                 │
      │  5. POST /signin-oidc       │                                 │
      │────────────────────────────>│                                 │
      │                             │  6. Exchange Code for Token     │
      │                             │────────────────────────────────>│
      │                             │                                 │
      │                             │  7. Access Token + ID Token     │
      │                             │<────────────────────────────────│
      │                             │                                 │
      │  8. Set Auth Cookie         │                                 │
      │<────────────────────────────│                                 │
      │                             │                                 │
      │  9. Render Portal Home      │                                 │
      │────────────────────────────>│                                 │
      │                             │                                 │
      │  10. SignalR Hub (Blazor)   │                                 │
      │<═══════════════════════════>│                                 │
      │    (Long-lived connection)  │                                 │
```

---

## 2. Flow Steps

### Step 1: Initial Request

**User Action**: 用戶訪問 `https://localhost:5001/`

**Server Response**:
- 檢查 `HttpContext.User.Identity.IsAuthenticated`
- 若為 `false`（未登入），ASP.NET Core 自動 Redirect 至 Microsoft Identity Login

### Step 2-4: Microsoft Identity Authentication

**Microsoft Identity Login Page**:
- 用戶輸入 Microsoft 帳號密碼（或使用 SSO）
- Microsoft Identity 驗證成功後，回傳 **Authorization Code** 至 `/signin-oidc`

### Step 5-7: Token Exchange

**Callback Endpoint**: `/signin-oidc` (Microsoft.Identity.Web 自動處理)

**Server Action**:
1. 接收 Authorization Code
2. 向 Microsoft Identity 交換 **Access Token** 與 **ID Token**
3. 驗證 Token 簽章與有效期限

**Token 內容** (ID Token Claims):
```json
{
  "oid": "00000000-0000-0000-0000-000000000001",
  "name": "張三",
  "preferred_username": "zhangsan@example.com",
  "iss": "https://login.microsoftonline.com/{tenant-id}/v2.0",
  "aud": "{client-id}",
  "exp": 1707390000,
  "iat": 1707386400
}
```

### Step 8: Set Authentication Cookie

**Server Action**:
- Microsoft.Identity.Web 自動建立 **Authentication Cookie**
- Cookie 包含 Claims (oid, name, email)
- Cookie 設定為 `HttpOnly, Secure, SameSite=Lax`

**Cookie Example**:
```
Set-Cookie: .AspNetCore.Cookies=CfDJ8ABC...XYZ; path=/; secure; httponly; samesite=lax
```

### Step 9-10: Blazor Server Long-Lived Connection

**Server Action**:
1. Render Portal Home 頁面（伺服器端渲染）
2. 建立 SignalR WebSocket 連線
3. SignalR 連線自動攜帶 Authentication Cookie

**Client-Server Interaction**:
- 用戶操作（如點擊卡片）透過 SignalR 傳送至伺服器
- 伺服器回傳 UI 更新指令
- 連線維持期間，驗證狀態持續有效

---

## 3. Token Lifecycle Management

### Token 有效期限

| Token Type | Default Lifetime | Refresh Strategy |
|------------|------------------|------------------|
| Access Token | 60-90 分鐘 | 自動刷新（透過 Refresh Token） |
| ID Token | 60 分鐘 | 僅用於驗證身份，不刷新 |
| Refresh Token | 14 天（可設定） | 用於取得新的 Access Token |
| Authentication Cookie | Session（瀏覽器關閉失效） | 依賴 Token 刷新 |

### Token 刷新流程

```
┌─────────────┐          ┌───────────────────────┐          ┌──────────────────┐
│   Browser   │          │   Blazor Server       │          │  Microsoft       │
│             │          │   (SignalR Hub)       │          │  Identity        │
└─────────────┘          └───────────────────────┘          └──────────────────┘
      │                             │                                 │
      │  1. User Action (60 min)    │                                 │
      │────────────────────────────>│                                 │
      │                             │  2. Access Token Expired?       │
      │                             │────────────────────────────────>│
      │                             │                                 │
      │                             │  3. Use Refresh Token           │
      │                             │────────────────────────────────>│
      │                             │                                 │
      │                             │  4. New Access Token            │
      │                             │<────────────────────────────────│
      │                             │                                 │
      │  5. Response (Authenticated)│                                 │
      │<────────────────────────────│                                 │
```

**Microsoft.Identity.Web 自動處理**:
- Access Token 過期時，自動使用 Refresh Token 取得新 Token
- 無需開發者手動實作

### Token 完全過期

**Scenario**: Refresh Token 過期（超過 14 天未使用）

**Server Behavior**:
- `AuthenticationStateProvider.GetAuthenticationStateAsync()` 回傳 `IsAuthenticated = false`
- Portal Home 自動降級顯示公開 Tool（符合 FR-003 Edge Case）

**User Experience**:
1. 用戶看到僅顯示公開 Tool 的畫面
2. 點擊「登入」按鈕 → 重新導向至 Microsoft Identity
3. 重新驗證後恢復完整功能

---

## 4. Security Considerations

### 4.1. Token Storage

| Token | Storage Location | Security Measure |
|-------|------------------|------------------|
| Access Token | Server Memory (In-Process Cache) | 不傳送至 Client |
| Refresh Token | Server Memory (In-Process Cache) | 不傳送至 Client |
| ID Token | Server Memory (Claims Principal) | 不傳送至 Client |
| Authentication Cookie | Client (Browser Cookie) | `HttpOnly, Secure, SameSite=Lax` |

**Important**: Blazor Server 架構下，Token 完全儲存於伺服器端，Client 端僅持有 Cookie。

### 4.2. HTTPS Requirement

**Mandatory**: 所有環境（Development, Staging, Production）必須啟用 HTTPS。

**Reason**:
- Microsoft Identity 要求 Callback URL 必須為 HTTPS
- Cookie 設定 `Secure` 屬性，僅透過 HTTPS 傳輸

**Development 設定**:
```bash
dotnet dev-certs https --trust
```

### 4.3. CSRF Protection

**ASP.NET Core 內建防護**:
- Blazor Server 使用 `AntiForgery` Token
- SignalR 連線建立時驗證 `Origin` Header

### 4.4. Token Validation

**Microsoft.Identity.Web 驗證項目**:
1. Token 簽章（使用 Microsoft Public Key）
2. `aud` (Audience) 必須符合 `ClientId`
3. `iss` (Issuer) 必須為 Microsoft Identity Platform
4. `exp` (Expiration) 未過期
5. `nbf` (Not Before) 已生效

---

## 5. Configuration

### 5.1. Azure AD App Registration

**Required Settings**:

| Setting | Value |
|---------|-------|
| Application Type | Web |
| Redirect URI | `https://localhost:5001/signin-oidc` |
| Front-channel logout URL | `https://localhost:5001/signout-oidc` |
| ID tokens | ✅ Enabled |
| Access tokens | ✅ Enabled |
| Supported account types | Single tenant（或依需求） |

**API Permissions**:
- `User.Read` (Microsoft Graph) - 取得用戶基本資訊

### 5.2. appsettings.json

```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "Domain": "example.onmicrosoft.com",
    "TenantId": "{TENANT_ID}",
    "ClientId": "{CLIENT_ID}",
    "ClientSecret": "{CLIENT_SECRET}",
    "CallbackPath": "/signin-oidc",
    "SignedOutCallbackPath": "/signout-callback-oidc"
  },
  "Logging": {
    "LogLevel": {
      "Microsoft.Identity": "Information"
    }
  }
}
```

**Secret Management**:
- Development: User Secrets (`dotnet user-secrets set "AzureAd:ClientSecret" "xxx"`)
- Production: Azure Key Vault（符合 `security-baseline.md`）

### 5.3. Program.cs Registration

```csharp
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

// 註冊 Microsoft Identity
builder.Services.AddMicrosoftIdentityWebAppAuthentication(
    builder.Configuration, "AzureAd");

// 註冊授權服務
builder.Services.AddAuthorization();

// Blazor Server 設定
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor()
    .AddMicrosoftIdentityConsentHandler(); // 處理 Incremental Consent

builder.Services.AddControllersWithViews()
    .AddMicrosoftIdentityUI(); // 加入登入/登出 UI

var app = builder.Build();

// Middleware 順序
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication(); // 必須在 UseAuthorization 之前
app.UseAuthorization();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
```

---

## 6. Testing Strategy

### 6.1. Unit Test（模擬 AuthenticationStateProvider）

```csharp
// Tests/PortalHomeTests.cs
[Test]
public async Task PortalHome_UnauthenticatedUser_ShowsPublicToolsOnly()
{
    // Arrange
    var authContext = new TestAuthenticationStateProvider(isAuthenticated: false);
    var toolService = new Mock<IToolService>();
    toolService.Setup(s => s.GetPublicToolsAsync())
        .ReturnsAsync(new List<ToolRegistration> { /* ... */ });

    // Act
    var cut = RenderComponent<Index>(parameters => parameters
        .Add(p => p.AuthenticationStateProvider, authContext));

    // Assert
    cut.Find(".tool-grid").Children.Should().HaveCount(2); // 僅公開 Tool
}
```

### 6.2. Integration Test（實際 Microsoft Identity）

**Prerequisites**:
- Test Azure AD Tenant
- Test User Accounts

**Test Flow**:
1. 啟動 Blazor Server（`dotnet run`）
2. 使用 Playwright 自動化登入流程
3. 驗證 Portal Home 顯示所有 Tool

---

## 7. Edge Cases

### 7.1. Network Failure during Token Exchange

**Symptom**: Microsoft Identity 回傳 Authorization Code，但 Token Exchange 失敗

**Handling**:
- ASP.NET Core 自動重試（預設 3 次）
- 若仍失敗，顯示錯誤頁面（`/Error`）

### 7.2. Token Revoked by Admin

**Symptom**: 管理員在 Azure Portal 撤銷用戶 Token

**Handling**:
- 下次 API 呼叫時，Microsoft Identity 回傳 `401 Unauthorized`
- `AuthenticationStateProvider` 偵測到錯誤，清除 Cookie
- 用戶自動登出，重新導向至登入頁

### 7.3. SignalR Connection Lost

**Symptom**: 用戶網路中斷 > 30 秒

**Handling**:
- Blazor Server 自動嘗試重新連線（預設 4 次）
- 若重新連線成功，驗證狀態由 Cookie 恢復
- 若失敗，顯示「連線中斷」訊息，要求用戶重新整理

---

## 8. References

- [Microsoft Identity Web Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/microsoft-identity-web)
- [OIDC Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [ASP.NET Core Authentication](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/)
- [Blazor Server Security](https://learn.microsoft.com/en-us/aspnet/core/blazor/security/server)

---

## Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| security-baseline.md 第 2 節（OIDC 支援） | ✅ | 使用 Microsoft.Identity.Web |
| security-baseline.md 第 4 節（Secret 管理） | ✅ | User Secrets / Azure Key Vault |
| Constitution Principle 8（Config 外部化） | ✅ | appsettings.json / Environment Variables |
