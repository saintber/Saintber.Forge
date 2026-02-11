# AI Integration Flow: Lyrics Guess Game

**Feature**: 002-lyrics-guess-game  
**Date**: 2026-02-11  
**Purpose**: 說明 AI 服務整合流程與 Copilot SDK 使用方式

---

## Overview

本功能透過 **GitHub Copilot SDK** 作為優先實作，支援跨廠商 AI 模型（OpenAI、Anthropic 等）的統一呼叫。

**架構優勢**:
- 單一 SDK 支援多廠商模型
- 切換模型僅需變更 `ModelId` 參數
- 符合 Constitution 治理原則（契約介面 + 可替換性）

---

## 1. Copilot SDK 跨廠商模型支援

### 1.1 支援的 AI 廠商

| 廠商 | 模型範例 | ModelId 格式 | 特性 |
|------|---------|-------------|------|
| OpenAI | GPT-4 Turbo, GPT-3.5 | `gpt-4-turbo`, `gpt-3.5-turbo` | 速度快、準確度高 |
| Anthropic | Claude 3 Sonnet, Opus | `claude-3-sonnet`, `claude-3-opus` | 精準理解、推理能力強 |

### 1.2 統一呼叫方式

```csharp
// 相同的程式碼可呼叫不同廠商的模型
var chatRequest = new CopilotChatRequest
{
    Model = modelId, // 僅此參數變更，其他完全相同
    Messages = new[]
    {
        new CopilotMessage { Role = "system", Content = systemPrompt },
        new CopilotMessage { Role = "user", Content = userInput }
    },
    Temperature = 0.3,
    ResponseFormat = CopilotResponseFormat.Json
};

var response = await _copilotClient.ChatAsync(chatRequest, cancellationToken);
```

---

## 2. AI 呼叫場景詳細說明

### 2.1 歌單解析（第一階段）

**目的**: 快速解析歌名與演唱者，不包含歌詞

**System Prompt**:
```
解析以下歌單文字，萃取歌名與演唱者。
回傳 JSON 格式: [{"title":"歌名","artist":"演唱者"}]
不要包含歌詞，僅返回歌名和演唱者。
若使用者僅提供歌名未提供演唱者，請自動推測並補全演唱者資訊。
```

**User Input 範例**:
```
晴天 周杰倫
七里香
稻香 周杰倫 這是一首很棒的歌
```

**Expected Response**:
```json
[
  {"title":"晴天","artist":"周杰倫"},
  {"title":"七里香","artist":"周杰倫"},
  {"title":"稻香","artist":"周杰倫"}
]
```

**Model 建議**: `gpt-4-turbo`（快速、準確）

**Timeout**: 10 秒

---

### 2.2 歌詞取得（第二階段）

**目的**: 取得選中歌曲的完整歌詞

**System Prompt**:
```
請提供歌曲「{song.Title}」（演唱者：{song.Artist}）的完整歌詞。
僅返回歌詞內容，不要包含其他說明文字。
若無法找到歌詞，請回應「無法取得歌詞」。
```

**Expected Response**:
```
故事的小黃花
從出生那年就飄著
童年的盪鞦韆
隨記憶一直晃到現在
...
```

**Error Handling**:
- 若回應包含「無法取得歌詞」→ 標記 `InitializationFailed = true`
- 若回應長度 < 50 字 → 視為無效，標記失敗

**Model 建議**: `gpt-3.5-turbo`（經濟實惠，歌詞知識庫足夠）

**Timeout**: 5 秒

---

### 2.3 答案驗證（語意比對）

**目的**: 判定使用者答案是否正確，容忍變體

**System Prompt**:
```
問題：以下歌詞片段來自哪首歌？
歌詞片段：{lyricsSnippet}

正確答案：{correctSongTitle} - {correctArtist}
使用者答案：{userAnswer}

請判定使用者答案是否正確，並回傳 JSON 格式：
{
  "isCorrect": true/false,
  "similarity": "exact" | "closeMatch" | "sameArtist" | "unrelated",
  "feedback": "回饋訊息"
}

判定規則：
- 繁簡體差異、英文/中文翻譯、歌曲別名視為正確 (exact)
- 僅差一個字視為接近 (closeMatch)，回饋「只差一個字」
- 同歌手其他歌曲視為 (sameArtist)，回饋「風格很像但不是」
- 完全無關視為 (unrelated)，回饋「不對喔！再猜一次」
```

**Expected Response**:
```json
{
  "isCorrect": true,
  "similarity": "exact",
  "feedback": "答對了！"
}
```

**Model 建議**: `claude-3-sonnet`（語意理解能力強）

**Timeout**: 5 秒

---

## 3. 錯誤處理矩陣

| 錯誤類型 | HTTP 狀態碼 | 處理策略 | 使用者訊息 |
|----------|-------------|----------|------------|
| 逾時 | - | 允許重試 | 「AI 處理時間過長，請重試或簡化歌單」 |
| Quota 超限 | 429 | 切換模型或稍後重試 | 「目前模型使用量已滿，請切換其他模型或稍後再試」 |
| 模型不可用 | 503 | 降級至預設模型 | 「所選模型暫時無法使用，已自動切換至預設模型」 |
| JSON 解析失敗 | - | 記錄並要求重試 | 「AI 回應格式錯誤，請重試」 |
| 驗證失敗 | 401 | 系統錯誤 | 「AI 服務設定錯誤，請聯絡管理員」 |

---

## 4. 效能優化建議

### 4.1 Temperature 設定

| 場景 | Temperature | 說明 |
|------|------------|------|
| 歌單解析 | 0.3 | 需要準確解析，低隨機性 |
| 歌詞取得 | 0.1 | 需要精確歌詞，最低隨機性 |
| 答案驗證 | 0.5 | 需要彈性語意理解，中等隨機性 |

### 4.2 Timeout 設定

| 場景 | Timeout | 理由 |
|------|---------|------|
| 歌單解析（50 首歌） | 10 秒 | 批次處理，允許較長時間 |
| 歌詞取得（單首歌） | 5 秒 | 單一請求，快速回應 |
| 答案驗證 | 5 秒 | 即時互動，需快速回饋 |

### 4.3 批次處理策略

**不建議**: 一次解析所有歌曲（含歌詞）
- 時間：50 首 × 5 秒 = 250 秒（不可接受）

**建議**: 兩階段處理 + 延遲初始化
- 第一階段：僅解析歌名/演唱者（5-10 秒）
- 第二階段：隨需載入歌詞（2-5 秒/首，分散至遊戲過程）

---

## 5. Copilot SDK 設定範例

### 5.1 appsettings.json

```json
{
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
        "ModelId": "claude-3-sonnet",
        "DisplayName": "Claude 3 Sonnet（精準理解）",
        "Provider": "Anthropic",
        "IsEnabled": true,
        "IsDefault": false
      }
    ]
  }
}
```

### 5.2 DI 註冊

```csharp
// Program.cs
builder.Services.AddCopilotClient(options =>
{
    var config = builder.Configuration.GetSection("Copilot");
    options.ApiKey = config["ApiKey"] ?? 
                     Environment.GetEnvironmentVariable("GITHUB_TOKEN");
    options.BaseUrl = config["BaseUrl"];
    options.Timeout = TimeSpan.FromSeconds(config.GetValue<int>("Timeout", 30));
});
```

---

## 6. 測試策略

### 6.1 單元測試（Mock AI Service）

```csharp
[Fact]
public async Task ParsePlaylistAsync_Should_Return_Songs_When_AI_Response_Valid()
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
    var result = await service.ParsePlaylistBasicInfoAsync("周杰倫的晴天", "gpt-4");

    // Assert
    Assert.Single(result);
    Assert.Equal("晴天", result[0].Title);
}
```

### 6.2 整合測試（實際 AI 呼叫）

```csharp
[Fact]
[Trait("Category", "Integration")]
public async Task CopilotAIService_Should_Support_Multiple_Vendors()
{
    // Arrange
    var copilotClient = serviceProvider.GetRequiredService<ICopilotClient>();
    var aiService = new CopilotAIServiceProvider(copilotClient, ...);

    // Act - OpenAI Model
    var result1 = await aiService.GenerateTextAsync(
        "Say 'Hello from OpenAI'", 
        "gpt-4-turbo");

    // Act - Anthropic Model
    var result2 = await aiService.GenerateTextAsync(
        "Say 'Hello from Anthropic'", 
        "claude-3-sonnet");

    // Assert
    Assert.Contains("OpenAI", result1);
    Assert.Contains("Anthropic", result2);
}
```

---

## Related Documents

- [service-contracts.md](service-contracts.md) - 服務契約定義
- [research.md](../research.md) - R1: Copilot SDK 使用模式研究

---

## Change History

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2026-02-11 | v1.0 | 初始版本，定義 AI 整合流程 |
