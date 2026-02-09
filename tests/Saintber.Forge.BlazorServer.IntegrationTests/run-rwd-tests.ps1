# Portal Home RWD Playwright 測試快速執行腳本
# 使用方式：在 tests\Saintber.Forge.BlazorServer.IntegrationTests 目錄下執行
#   .\run-rwd-tests.ps1

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Portal Home RWD 自動化測試執行器" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 檢查 Playwright 瀏覽器是否已安裝
$playwrightScript = "bin\Debug\net8.0\playwright.ps1"

if (-not (Test-Path $playwrightScript)) {
    Write-Host "[1/3] 建置測試專案..." -ForegroundColor Yellow
    dotnet build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 建置失敗！" -ForegroundColor Red
        exit 1
    }
}

Write-Host "[2/3] 檢查 Playwright 瀏覽器..." -ForegroundColor Yellow
$browsersInstalled = Test-Path "$env:USERPROFILE\.cache\ms-playwright"

if (-not $browsersInstalled) {
    Write-Host "    ⚠️  首次執行需安裝瀏覽器（約 1-2 分鐘）" -ForegroundColor Yellow
    pwsh $playwrightScript install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Playwright 瀏覽器安裝失敗！" -ForegroundColor Red
        exit 1
    }
    Write-Host "    ✅ Playwright 瀏覽器安裝完成" -ForegroundColor Green
} else {
    Write-Host "    ✅ Playwright 瀏覽器已安裝" -ForegroundColor Green
}

Write-Host ""
Write-Host "[3/3] 執行 RWD 測試..." -ForegroundColor Yellow
Write-Host "    測試案例: 9 個（佈局驗證 + 邊界條件 + 互動性）" -ForegroundColor Gray
Write-Host ""

# 執行測試
dotnet test --filter "Category=RWD" --logger "console;verbosity=normal"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ 所有 RWD 測試通過！" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ 部分測試失敗，請檢查上方錯誤訊息" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host ""
    Write-Host "疑難排解提示：" -ForegroundColor Yellow
    Write-Host "  1. 確認應用程式正在執行: https://localhost:7289" -ForegroundColor Gray
    Write-Host "  2. 檢查防火牆設定是否阻擋 Playwright" -ForegroundColor Gray
    Write-Host "  3. 參考 README.md 取得更多資訊" -ForegroundColor Gray
}

exit $LASTEXITCODE
