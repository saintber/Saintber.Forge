# Service Contracts: Lyrics Guess Game

**Feature**: 002-lyrics-guess-game  
**Date**: 2026-02-11  
**Purpose**: 定義 Lyrics Guess Game 的服務契約介面

---

## Overview

本功能採用 **Blazor Server** 架構，服務互動透過 C# 介面契約進行，而非 REST API。

**架構設計原則**:
- 符合 Constitution Principle 5（契約介面）與 Principle 6（可替換性）
- 所有 AI 互動透過 `IAIServiceProvider` 抽象層
- 業務邏輯封裝於 `ILyricsGuessGameService`
- 服務實作可替換（in-process → 微服務 → FaaS）

---

## 1. IAIServiceProvider（AI 服務提供者契約）

**用途**: 抽象化 AI 服務呼叫，支援多種實作（Copilot SDK、Azure OpenAI、本地模型等）

**優先實作**: `CopilotAIServiceProvider`（基於 GitHub Copilot SDK）

### 1.1 ParseStructuredDataAsync（解析結構化資料）

**用途**: 使用 AI 從非結構化文字中萃取結構化資料

```csharp
/// <summary>
/// 使用 AI 解析非結構化文字，萃取結構化資料
/// </summary>
/// <typeparam name="T">目標資料型別（如 List<Song>）</typeparam>
/// <param name="prompt">系統提示詞（指導 AI 如何解析）</param>
/// <param name="userInput">使用者輸入文字</param>
/// <param name="modelId">AI 模型識別碼（如 "gpt-4-turbo"、"claude-3-sonnet"）</param>
/// <param name="timeout">逾時設定（預設 10 秒）</param>
/// <param name="cancellationToken">取消標記</param>
/// <returns>解析後的結構化資料</returns>
/// <exception cref="AIServiceException">AI 呼叫失敗</exception>
/// <exception cref="TimeoutException">逾時</exception>
/// <exception cref="JsonException">JSON 解析失敗</exception>
Task<T> ParseStructuredDataAsync<T>(
    string prompt, 
    string userInput, 
    string modelId, 
    TimeSpan? timeout = null,
    CancellationToken cancellationToken = default);
```

**使用場景**:
- 解析歌單文字 → `List<Song>`（僅 Title/Artist，不含 Lyrics）

**範例呼叫**:
```csharp
var prompt = @"解析以下歌單文字，萃取歌名與演唱者。
回傳 JSON 格式: [{""title"":""歌名"",""artist"":""演唱者""}]
不要包含歌詞，僅返回歌名和演唱者。";

var songs = await _aiService.ParseStructuredDataAsync<List<Song>>(
    prompt,
    "晴天 周杰倫\n七里香\n稻香 周杰倫",
    "gpt-4-turbo",
    TimeSpan.FromSeconds(10));
```

---

### 1.2 GenerateTextAsync（生成文字內容）

**用途**: 使用 AI 生成文字內容（如歌詞、說明）

```csharp
/// <summary>
/// 使用 AI 取得文字內容（如歌詞）
/// </summary>
/// <param name="prompt">提示詞</param>
/// <param name="modelId">AI 模型識別碼</param>
/// <param name="timeout">逾時設定（預設 10 秒）</param>
/// <param name="cancellationToken">取消標記</param>
/// <returns>AI 回應文字</returns>
/// <exception cref="AIServiceException">AI 呼叫失敗</exception>
/// <exception cref="TimeoutException">逾時</exception>
Task<string> GenerateTextAsync(
    string prompt, 
    string modelId, 
    TimeSpan? timeout = null,
    CancellationToken cancellationToken = default);
```

**使用場景**:
- 取得歌曲歌詞片段（出題時即時節錄）

**範例呼叫**:
```csharp
var prompt = $"請提供歌曲「晴天」（演唱者：周杰倫）的歌詞片段（完整句子，10 字以上）。";

var snippet = await _aiService.GenerateTextAsync(
    prompt,
    "gpt-4-turbo",
    TimeSpan.FromSeconds(5));
```

---

### 1.3 領域邏輯說明（答案判定）

**說明**: IAIServiceProvider 僅提供共通 AI 能力，答案判定屬於 Lyrics Guess Game 領域邏輯，應由 `ILyricsGuessGameService` 組合提示詞並解析回應。

**範例呼叫**:
```csharp
var prompt = $@"請比較使用者答案與正確答案的相似度。請以 JSON 格式回應：
{{
  ""SimilarityType"": ""Exact|AlmostCorrect|SimilarButWrong|Wrong"",
  ""Feedback"": ""給使用者的回饋訊息（繁體中文）""
}}

正確答案：{correctAnswer}
使用者答案：{userAnswer}";

var result = await _aiService.ParseStructuredDataAsync<AnswerValidationResult>(
    prompt,
    string.Empty,
    modelId,
    TimeSpan.FromSeconds(5));
```

---

## 2. ILyricsGuessGameService（遊戲邏輯服務契約）

**用途**: 封裝遊戲邏輯，協調 AI 服務與資料管理

### 2.1 ParsePlaylistBasicInfoAsync（解析歌單基本資訊）

```csharp
/// <summary>
/// 解析歌單文字，僅萃取歌名與演唱者（第一階段，不含歌詞）
/// </summary>
/// <param name="playlistText">使用者輸入的歌單文字</param>
/// <param name="modelId">AI 模型識別碼</param>
/// <param name="cancellationToken">取消標記</param>
/// <returns>歌曲清單（僅 Title/Artist，CanGenerateQuestion 預設 true）</returns>
/// <exception cref="InvalidOperationException">無法解析歌單</exception>
Task<List<Song>> ParsePlaylistBasicInfoAsync(
    string playlistText, 
    string modelId, 
    CancellationToken cancellationToken = default);
```

---

### 2.2 GenerateLyricsSnippetAsync（即時節錄歌詞片段）

```csharp
/// <summary>
/// 出題時即時節錄歌曲歌詞片段（不保存完整歌詞）
/// </summary>
/// <param name="song">待節錄的歌曲</param>
/// <param name="modelId">AI 模型識別碼</param>
/// <param name="cancellationToken">取消標記</param>
/// <returns>歌詞片段（失敗則回傳 null）</returns>
Task<string?> GenerateLyricsSnippetAsync(
    Song song, 
    string modelId, 
    CancellationToken cancellationToken = default);
```

---

### 2.3 GenerateRandomQuestionAsync（生成隨機題目）

```csharp
/// <summary>
/// 從歌曲清單中隨機選擇一首歌曲，生成題目
/// </summary>
/// <param name="gameState">當前遊戲狀態</param>
/// <param name="modelId">AI 模型識別碼</param>
/// <param name="maxRetries">最大重試次數（當歌曲初始化失敗時）</param>
/// <returns>題目（若所有歌曲皆無法初始化則回傳 null）</returns>
Task<Question?> GenerateRandomQuestionAsync(
    GameState gameState, 
    string modelId, 
    int maxRetries = 3);
```

---

### 2.4 ValidateAnswerAsync（驗證使用者答案）

```csharp
/// <summary>
/// 驗證使用者輸入的答案是否正確
/// </summary>
/// <param name="userAnswer">使用者答案</param>
/// <param name="correctAnswer">正確答案（歌名）</param>
/// <param name="modelId">AI 模型識別碼</param>
/// <returns>驗證結果</returns>
Task<AnswerValidationResult> ValidateAnswerAsync(
    string userAnswer,
    string correctAnswer,
    string modelId);
```

---

### 2.5 GetAvailableModels（取得可用 AI 模型）

```csharp
/// <summary>
/// 取得所有已啟用的 AI 模型清單
/// </summary>
/// <returns>AI 模型設定清單</returns>
List<AIModelConfig> GetAvailableModels();
```

---

### 2.6 GetDefaultModelId（取得預設 AI 模型識別碼）

```csharp
/// <summary>
/// 取得預設 AI 模型識別碼
/// </summary>
/// <returns>預設模型 ID</returns>
/// <exception cref="InvalidOperationException">未設定預設模型</exception>
string GetDefaultModelId();
```

---

## 3. 錯誤處理契約

### 3.1 AIServiceException（AI 服務異常）

```csharp
/// <summary>
/// AI 服務呼叫失敗時拋出的異常
/// </summary>
public class AIServiceException : Exception
{
    public AIServiceErrorCode ErrorCode { get; }
    
    public AIServiceException(
        string message, 
        AIServiceErrorCode errorCode, 
        Exception? innerException = null)
        : base(message, innerException)
    {
        ErrorCode = errorCode;
    }
}

public enum AIServiceErrorCode
{
    Timeout,           // 逾時
    QuotaExceeded,     // Quota 超限
    ModelUnavailable,  // 模型不可用
    ParseError,        // JSON 解析失敗
    AuthenticationError, // 驗證失敗
    NetworkError       // 網路錯誤
}
```

---

## 4. 服務流程圖

### 4.1 歌單解析流程（第一階段）

```
使用者輸入歌單文字
    ↓
ILyricsGuessGameService.ParsePlaylistBasicInfoAsync()
    ↓
IAIServiceProvider.ParseStructuredDataAsync<List<Song>>()
    ↓ (Copilot SDK 跨廠商呼叫)
OpenAI / Anthropic / 其他廠商
     ↓
回傳 List<Song> (僅 Title/Artist，CanGenerateQuestion = true)
    ↓
GameState.Songs = [...], IsPlaylistParsed = true
```

**預期時間**: 5-10 秒（50 首歌）

---

### 4.2 歌詞片段節錄流程（第二階段）

```
使用者觸發出題
    ↓
ILyricsGuessGameService.GenerateLyricsSnippetAsync(song, modelId)
    ↓
IAIServiceProvider.GenerateTextAsync(prompt, modelId)
    ↓ (Copilot SDK)
AI 回傳歌詞片段
    ↓
生成題目 (Question)
```

**預期時間**: 2-5 秒（單首歌）

---

### 4.3 答案驗證流程

```
使用者輸入答案
    ↓
ILyricsGuessGameService.ValidateAnswerAsync(answer, correctAnswer, modelId)
    ↓
IAIServiceProvider.ParseStructuredDataAsync<AnswerValidationResult>(...)
    ↓ (Copilot SDK)
AI 語意比對
    ↓
回傳 AnswerValidationResult
    ↓
顯示回饋 (答對了 / 只差一個字 / 不對喔)
```

**預期時間**: 2-3 秒

---

## 5. 實作替換性設計

**符合 Constitution Principle 6（可替換性）**

### 5.1 In-Process 實作（當前）

```csharp
builder.Services.AddScoped<ILyricsGuessGameService, LyricsGuessGameService>();
builder.Services.AddScoped<IAIServiceProvider, CopilotAIServiceProvider>();
```

### 5.2 微服務實作（未來）

```csharp
builder.Services.AddHttpClient<ILyricsGuessGameService, LyricsGuessGameHttpClient>()
    .ConfigureHttpClient(client => 
    {
        client.BaseAddress = new Uri("https://api.saintber.dev/lyrics-guess-game");
    });
```

### 5.3 FaaS 實作（未來）

```csharp
builder.Services.AddScoped<ILyricsGuessGameService, LyricsGuessGameFunctionClient>();
```

**關鍵設計**:
- 所有方法皆為 `async`（支援網路呼叫）
- 使用 `CancellationToken`（支援逾時與取消）
- 拋出明確異常型別（支援錯誤處理）

---

## 6. 相依性注入設定範例

```csharp
// Program.cs

// 註冊 AI Service Provider（Copilot SDK 優先）
builder.Services.AddCopilotClient(options =>
{
    options.ApiKey = builder.Configuration["Copilot:ApiKey"] ?? 
                     Environment.GetEnvironmentVariable("GITHUB_TOKEN");
});
builder.Services.AddScoped<IAIServiceProvider, CopilotAIServiceProvider>();

// 註冊遊戲服務
builder.Services.AddScoped<ILyricsGuessGameService, LyricsGuessGameService>();

// 註冊設定
builder.Services.Configure<LyricsGuessGameConfig>(
    builder.Configuration.GetSection("LyricsGuessGame"));

// 註冊日誌
builder.Services.AddLogging();
```

---

## Related Documents

- [data-model.md](../data-model.md) - 資料結構定義
- [spec.md](../spec.md) - 功能規格
- [research.md](../research.md) - 技術研究

---

## Change History

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2026-02-11 | v1.0 | 初始版本，定義服務契約介面 |
