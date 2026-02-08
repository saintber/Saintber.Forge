# Portal Home RWD 測試執行指南

## 前置準備

### 1. 安裝 Playwright 瀏覽器

首次執行 Playwright 測試前，需要安裝測試用瀏覽器：

```powershell
# 切換到測試專案目錄
cd tests\Saintber.Forge.BlazorServer.IntegrationTests

# 建置專案以產生 playwright.ps1
dotnet build

# 安裝 Playwright 瀏覽器（Chromium, Firefox, WebKit）
pwsh bin/Debug/net8.0/playwright.ps1 install
```

### 2. 啟動應用程式

測試需要應用程式在背景執行：

```powershell
# 在新的 PowerShell 視窗中啟動 Blazor Server
cd src\Frontend\Saintber.Forge.BlazorServer
dotnet run

# 應用程式應在 https://localhost:7289 執行
```

## 執行測試

### 執行所有 RWD 測試

```powershell
cd tests\Saintber.Forge.BlazorServer.IntegrationTests
dotnet test --filter "Category=RWD"
```

### 執行特定測試

```powershell
# 僅測試桌機佈局
dotnet test --filter "FullyQualifiedName~Desktop_ShowsFourColumnLayout"

# 僅測試平板佈局
dotnet test --filter "FullyQualifiedName~Tablet_ShowsTwoColumnLayout"

# 僅測試手機佈局
dotnet test --filter "FullyQualifiedName~Mobile_ShowsSingleColumnLayout"

# 測試所有邊界條件
dotnet test --filter "FullyQualifiedName~Boundary"
```

### 執行所有 E2E 測試

```powershell
dotnet test --filter "Category=E2E"
```

### 詳細輸出模式

```powershell
dotnet test --filter "Category=RWD" --logger "console;verbosity=detailed"
```

## 測試涵蓋範圍

### 測試案例清單

| 測試案例 | 視窗寬度 | 預期佈局 | 描述 |
|---------|---------|---------|------|
| `Desktop_ShowsFourColumnLayout` | 1920px | 4 欄 | 桌機模式佈局 |
| `Tablet_ShowsTwoColumnLayout` | 800px | 2 欄 | 平板模式佈局 |
| `Mobile_ShowsSingleColumnLayout` | 375px | 1 欄 | 手機模式佈局 |
| `Mobile_NoHorizontalScrollbar` | 375px | 無捲軸 | 驗證無水平捲軸 |
| `AllViewports_ToolCardsVisibleAndClickable` | 375/800/1920px | 可見可點擊 | 跨裝置卡片互動性 |
| `Boundary_768px_ShowsTwoColumnLayout` | 768px | 2 欄 | 平板最小寬度邊界 |
| `Boundary_767px_ShowsSingleColumnLayout` | 767px | 1 欄 | 手機最大寬度邊界 |
| `Boundary_1200px_ShowsFourColumnLayout` | 1200px | 4 欄 | 桌機最小寬度邊界 |
| `Boundary_1199px_ShowsTwoColumnLayout` | 1199px | 2 欄 | 平板最大寬度邊界 |

### 測試驗證項目

✅ **佈局驗證**:
- 桌機模式（≥1200px）顯示 4 欄 Grid
- 平板模式（768px-1199px）顯示 2 欄 Grid
- 手機模式（<768px）顯示單欄 Grid

✅ **邊界條件測試**:
- 768px/767px 切換點正確
- 1200px/1199px 切換點正確

✅ **互動性驗證**:
- 所有視窗尺寸下卡片可見
- 卡片連結可點擊

✅ **視覺品質**:
- 手機模式無水平捲軸

## 疑難排解

### 問題：測試失敗 "Target page, context or browser has been closed"

**原因**: 應用程式未啟動或 URL 不正確

**解決方案**:
```powershell
# 確認應用程式正在執行
curl https://localhost:7289

# 檢查 PortalHomeRwdTests.cs 中的 BaseUrl 設定
# 應為 "https://localhost:7289"
```

### 問題：Playwright 瀏覽器未安裝

**原因**: 首次執行未安裝瀏覽器

**解決方案**:
```powershell
cd tests\Saintber.Forge.BlazorServer.IntegrationTests
pwsh bin/Debug/net8.0/playwright.ps1 install
```

### 問題：HTTPS 憑證錯誤

**原因**: 本地開發環境使用自簽憑證

**解決方案**: 測試程式碼已設定忽略憑證錯誤（僅限開發環境）

### 問題：測試偶爾失敗（timing issues）

**原因**: 網路延遲或元件渲染時間過長

**解決方案**: 測試已使用 `WaitUntilState.NetworkIdle` 確保頁面完全載入

## CI/CD 整合

### Azure DevOps Pipeline 範例

```yaml
- task: DotNetCoreCLI@2
  displayName: 'Install Playwright Browsers'
  inputs:
    command: 'custom'
    custom: 'build'
    projects: 'tests/Saintber.Forge.BlazorServer.IntegrationTests/Saintber.Forge.BlazorServer.IntegrationTests.csproj'

- script: |
    pwsh tests/Saintber.Forge.BlazorServer.IntegrationTests/bin/Debug/net8.0/playwright.ps1 install --with-deps
  displayName: 'Install Playwright'

- task: DotNetCoreCLI@2
  displayName: 'Run E2E Tests'
  inputs:
    command: 'test'
    projects: 'tests/Saintber.Forge.BlazorServer.IntegrationTests/Saintber.Forge.BlazorServer.IntegrationTests.csproj'
    arguments: '--filter "Category=E2E" --logger trx --results-directory $(Build.ArtifactStagingDirectory)/TestResults'
```

## 參考資料

- [Playwright for .NET 官方文件](https://playwright.dev/dotnet/)
- [NUnit 測試框架](https://nunit.org/)
- [CSS Grid Layout MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Grid_Layout)
