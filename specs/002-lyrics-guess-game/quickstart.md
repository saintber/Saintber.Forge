# Quick Start: Lyrics Guess Game

**Feature**: 002-lyrics-guess-game  
**Date**: 2026-02-11  
**Purpose**: 快速開始開發指南

---

## Overview

本指南協助開發者快速設定開發環境並啟動 Lyrics Guess Game 功能開發。

**預計完成時間**: 30 分鐘

---

## Prerequisites

### 必要條件

- ✅ .NET 8.0 SDK 或更高版本
- ✅ Visual Studio 2022 或 VS Code（含 C# 擴充）
- ✅ GitHub Copilot 存取權限（用於 AI 整合）
- ✅ PostgreSQL 資料庫（Portal Home 需求）
- ✅ Git 版本控制

### 選用工具

- Postman / REST Client（API 測試）
- Docker Desktop（容器化部署）

---

## Step 1: 取得 GitHub Token

### 1.1 產生 GitHub Personal Access Token

1. 前往 [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. 點擊 **Generate new token (classic)**
3. 設定權限：
   - `repo`（完整存取權限）
   - `copilot`（Copilot API 存取）
4. 點擊 **Generate token**
5. 複製生成的 token（僅顯示一次）

### 1.2 設定環境變數

**Windows (PowerShell)**:
```powershell
$env:GITHUB_TOKEN = "ghp_your_token_here"

# 永久設定（寫入使用者環境變數）
[System.Environment]::SetEnvironmentVariable("GITHUB_TOKEN", "ghp_your_token_here", "User")
```

**Linux / macOS**:
```bash
export GITHUB_TOKEN="ghp_your_token_here"

# 永久設定（加入 ~/.bashrc 或 ~/.zshrc）
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.bashrc
```

---

## Step 2: 專案設定

### 2.1 複製專案

```bash
git clone https://github.com/saintber/Saintber.Forge.git
cd Saintber.Forge
```

### 2.2 切換至功能分支

```bash
git checkout -b 002-lyrics-guess-game
```

### 2.3 還原 NuGet 套件

```bash
dotnet restore
```

---

## Step 3: 設定 AI 模型

### 3.1 編輯 appsettings.json

**檔案位置**: `src/Frontend/Saintber.Forge.BlazorServer/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=forge;Username=postgres;Password=your_password"
  },
  
  "Copilot": {
    "ApiKey": "${GITHUB_TOKEN}",
    "BaseUrl": "https://api.githubcopilot.com",
    "Timeout": 30
  },
  
  "LyricsGuessGame": {
    "AIModels": [
      {
        "ModelId": "gpt-4-turbo",
        "DisplayName": "GPT-4 Turbo（快速、準確）",
        "Provider": "OpenAI",
        "IsEnabled": true,
        "IsDefault": true
      },
      {
        "ModelId": "gpt-3.5-turbo",
        "DisplayName": "GPT-3.5 Turbo（經濟實惠）",
        "Provider": "OpenAI",
        "IsEnabled": true,
        "IsDefault": false
      },
            {
                "ModelId": "claude-3-5-sonnet",
                "DisplayName": "Claude 3.5 Sonnet（創意推理）",
                "Provider": "Anthropic",
                "IsEnabled": true,
                "IsDefault": false
            }
        ],
        "DefaultModelId": "gpt-4o",
        "ParsePlaylistTimeoutSeconds": 10,
        "GenerateLyricsSnippetTimeoutSeconds": 5,
        "ValidateAnswerTimeoutSeconds": 5,
        "MinSnippetLength": 10,
        "MaxSnippetLength": 50,
        "InitializationRetryCount": 3
  }
}
```

### 3.2 驗證設定

```bash
# 確認 GITHUB_TOKEN 環境變數已設定
echo $env:GITHUB_TOKEN  # Windows PowerShell
echo $GITHUB_TOKEN      # Linux / macOS
```

---

## Step 4: 建立專案結構

### 4.1 建立服務層專案（BLL）

```bash
# 在 src/ 目錄下建立 BLL 專案
cd src
dotnet new classlib -n Saintber.Forge.Tools.LyricsGuessGame.BLL
cd Saintber.Forge.Tools.LyricsGuessGame.BLL

# 加入必要套件
dotnet add package Microsoft.Extensions.Options
dotnet add package Microsoft.Extensions.Logging.Abstractions

# 加入專案參考至 Solution
cd ../..
dotnet sln add src/Saintber.Forge.Tools.LyricsGuessGame.BLL/Saintber.Forge.Tools.LyricsGuessGame.BLL.csproj
```

### 4.2 建立抽象層專案（Abstractions）

```bash
cd src
dotnet new classlib -n Saintber.Forge.Tools.LyricsGuessGame.Abstractions
cd Saintber.Forge.Tools.LyricsGuessGame.Abstractions

# 加入專案參考至 Solution
cd ../..
dotnet sln add src/Saintber.Forge.Tools.LyricsGuessGame.Abstractions/Saintber.Forge.Tools.LyricsGuessGame.Abstractions.csproj
```

---

## Step 5: 實作核心服務

### 5.1 定義服務契約介面

**檔案**: `src/Saintber.Forge.Tools.LyricsGuessGame.Abstractions/IAIServiceProvider.cs`

```csharp
namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions;

/// <summary>
/// AI 服務提供者抽象介面（符合 Constitution Principle 5）
/// </summary>
public interface IAIServiceProvider
{
    Task<T> ParseStructuredDataAsync<T>(
        string prompt, 
        string userInput, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default);

    Task<string> GenerateTextAsync(
        string prompt, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default);
}
```

### 5.2 實作 Copilot SDK 提供者

**檔案**: `src/Saintber.Forge.Tools.LyricsGuessGame.BLL/CopilotAIServiceProvider.cs`

```csharp
namespace Saintber.Forge.Tools.LyricsGuessGame.BLL;

public class CopilotAIServiceProvider : IAIServiceProvider
{
    private readonly ICopilotClient _copilotClient;
    private readonly ILogger<CopilotAIServiceProvider> _logger;

    public CopilotAIServiceProvider(
        ICopilotClient copilotClient,
        ILogger<CopilotAIServiceProvider> logger)
    {
        _copilotClient = copilotClient;
        _logger = logger;
    }

    // 實作介面方法...
}
```

### 5.3 註冊服務（Program.cs）

**檔案**: `src/Frontend/Saintber.Forge.BlazorServer/Program.cs`

```csharp
// 註冊 GitHub Copilot SDK 客戶端
builder.Services.AddCopilotClient(options =>
{
    options.ApiKey = builder.Configuration["Copilot:ApiKey"] ?? 
                     Environment.GetEnvironmentVariable("GITHUB_TOKEN");
});

// 註冊 AI Service Provider
builder.Services.AddScoped<IAIServiceProvider, CopilotAIServiceProvider>();

// 註冊遊戲服務
builder.Services.AddScoped<ILyricsGuessGameService, LyricsGuessGameService>();

// 註冊設定
builder.Services.Configure<LyricsGuessGameConfig>(
    builder.Configuration.GetSection("LyricsGuessGame"));
```

---

## Step 6: 建立 Blazor 頁面

### 6.1 建立遊戲頁面

**檔案**: `src/Frontend/Saintber.Forge.BlazorServer/Pages/LyricsGuessGame.razor`

```razor
@page "/tools/lyrics-guess-game"
@inject ILyricsGuessGameService GameService
@inject ILogger<LyricsGuessGame> Logger

<PageTitle>Lyrics Guess Game</PageTitle>

<div class="container">
    <h1>🎵 Lyrics Guess Game</h1>
    
    @if (!gameState.IsPlaylistParsed)
    {
        <!-- 歌單輸入區 -->
        <div class="playlist-input">
            <button @onclick="ShowPlaylistInput">輸入歌單</button>
        </div>
    }
    else
    {
        <!-- 遊戲進行區 -->
        <div class="game-area">
            <button @onclick="ShowPlaylistDialog">查看歌單 (@gameState.Songs.Count 首)</button>
            
            @if (gameState.CurrentQuestion != null)
            {
                <div class="question">
                    <p>請從歌詞猜猜看是什麼曲子？</p>
                    <pre>@gameState.CurrentQuestion.LyricsSnippet</pre>
                    
                    <input @bind="userAnswer" placeholder="輸入歌名或歌手名稱" />
                    <button @onclick="SubmitAnswer">提交答案</button>
                    <button @onclick="RevealAnswer">公佈答案</button>
                </div>
            }
        </div>
    }
</div>

@code {
    private GameState gameState = new();
    private string userAnswer = string.Empty;
    
    // 實作方法...
}
```

---

## Step 7: 執行與測試

### 7.1 啟動應用程式

```bash
cd src/Frontend/Saintber.Forge.BlazorServer
dotnet run
```

### 7.2 存取功能頁面

開啟瀏覽器前往: `https://localhost:5001/tools/lyrics-guess-game`

### 7.3 測試流程

1. **輸入歌單**:
   ```
   晴天 周杰倫
   七里香 周杰倫
   稻香 周杰倫
   ```

2. **點擊「開始遊戲」** → 等待 5-10 秒 AI 解析

3. **查看歌單** → 確認已解析的歌曲清單

4. **開始猜題** → 系統顯示隨機歌詞片段

5. **提交答案** → AI 判定正確性並顯示回饋

6. **公佈答案** → 直接進入下一題

---

## Step 8: 單元測試

### 8.1 建立測試專案

```bash
cd tests
dotnet new xunit -n Saintber.Forge.Tools.LyricsGuessGame.Tests
cd Saintber.Forge.Tools.LyricsGuessGame.Tests

# 加入測試套件
dotnet add package Moq
dotnet add package FluentAssertions

# 加入專案參考
dotnet add reference ../../src/Saintber.Forge.Tools.LyricsGuessGame.BLL/Saintber.Forge.Tools.LyricsGuessGame.BLL.csproj
```

### 8.2 建立測試類別

**檔案**: `tests/Saintber.Forge.Tools.LyricsGuessGame.Tests/LyricsGuessGameServiceTests.cs`

```csharp
public class LyricsGuessGameServiceTests
{
    [Fact]
    public async Task ParsePlaylistAsync_Should_Return_Songs_When_Input_Valid()
    {
        // Arrange
        var mockAIService = new Mock<IAIServiceProvider>();
        mockAIService
            .Setup(x => x.ParseStructuredDataAsync<List<Song>>(
                It.IsAny<string>(), 
                It.IsAny<string>(), 
                It.IsAny<string>(), 
                It.IsAny<TimeSpan?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Song>
            {
                new Song { Title = "晴天", Artist = "周杰倫" }
            });

        var service = new LyricsGuessGameService(mockAIService.Object, ...);

        // Act
        var result = await service.ParsePlaylistBasicInfoAsync("晴天 周杰倫", "gpt-4");

        // Assert
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("晴天");
    }
}
```

### 8.3 執行測試

```bash
dotnet test
```

---

## Troubleshooting

### 問題 1: GITHUB_TOKEN 未設定

**錯誤訊息**: `AIServiceException: 驗證失敗`

**解決方式**:
```bash
# 確認環境變數已設定
echo $env:GITHUB_TOKEN  # Windows
echo $GITHUB_TOKEN      # Linux/macOS

# 若未設定，依照 Step 1 重新設定
```

---

### 問題 2: AI 呼叫逾時

**錯誤訊息**: `TimeoutException: AI 處理時間過長`

**解決方式**:
1. 檢查網路連線
2. 調整 `appsettings.json` 中的 `Timeout` 設定值
3. 嘗試切換其他 AI 模型

---

### 問題 3: 歌單解析失敗

**錯誤訊息**: `無法解析歌單`

**解決方式**:
1. 確認歌單格式正確（每行一首歌）
2. 嘗試簡化歌單內容（移除額外說明）
3. 檢查 AI 模型是否啟用

---

## Next Steps

完成 Quick Start 後，建議閱讀以下文件：

1. **[data-model.md](data-model.md)** - 了解資料結構設計
2. **[contracts/service-contracts.md](contracts/service-contracts.md)** - 了解服務契約定義
3. **[spec.md](spec.md)** - 完整功能規格
4. **[research.md](research.md)** - 技術研究與決策

---

## Related Documents

- [spec.md](spec.md) - 功能規格
- [data-model.md](data-model.md) - 資料模型
- [contracts/](contracts/) - API 契約
- [Decision.md](../../docs/intent/002-lyrics-guess-game/Decision.md) - 設計決策

---

## Support

如遇到問題，請參考：
- [GitHub Issues](https://github.com/saintber/Saintber.Forge/issues)
- [Constitution](../../docs/constitution/constitution.md) - 治理原則
- [Research](research.md) - 技術研究文件

---

## Change History

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2026-02-11 | v1.0 | 初始版本，建立快速開始指南 |
