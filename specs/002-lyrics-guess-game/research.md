# Research: Lyrics Guess Game

**Date**: 2026-02-10  
**Feature**: 002-lyrics-guess-game  
**Purpose**: 解決 Technical Context 中的技術不確定性，產生 Phase 1 設計的技術基礎

---

## R1. copilot.sdk 使用模式研究

### Questions
- 歌單解析：能否讓 AI 從非結構化文字中萃取歌曲清單（JSON 格式）？
- 歌詞取得：能否讓 AI 依據歌名與歌手取得完整歌詞？
- 答案判定：能否讓 AI 進行語意比對（容忍錯字、簡繁體）？
- 模型切換：能否在執行期間動態切換 AI 模型？
- 錯誤處理：逾時、Quota 超限、模型不可用的處理方式？

### Research Findings

**Current State**: 專案中尚未整合 AI SDK，需要從頭建立 AI 整合層。

**Decision**: 建立自訂 AI 整合服務抽象層 `IAIServiceProvider`，優先實作使用 **GitHub Copilot SDK** 的實作類別

**Rationale**:
1. **抽象層設計**: 符合 Constitution Principle 5（契約介面）與 Principle 6（可替換性），避免工具直接耦合特定 AI 供應商
2. **Copilot SDK 優先**: GitHub Copilot SDK 支援多廠商模型（OpenAI、Anthropic 等），提供跨供應商的統一介面
3. **實作彈性**: 保留替換為其他實作的可能性（Azure OpenAI、本地模型、Semantic Kernel）
4. **錯誤控制**: 自訂逾時、重試、降級策略

### Alternatives Considered

| 方案 | 優點 | 缺點 | 決策 |
|------|------|------|------|
| 直接使用 OpenAI SDK | 官方支援、文件完整 | 耦合特定廠商，違反可替換性原則 | ❌ 拒絕 |
| GitHub Copilot SDK + IAIServiceProvider | 跨廠商支援、符合治理原則、統一介面 | 需自行處理錯誤與重試 | ✅ 採用（優先實作）|
| Azure OpenAI + IAIServiceProvider | Azure 生態整合、企業支援 | 僅支援 OpenAI 模型 | 🔶 備案（未來擴充）|
| Semantic Kernel | 微軟官方抽象層、功能完整 | 引入額外依賴、學習曲線 | 🔶 備案（未來擴充）|

### Implementation Approach

#### 1. 定義 AI 服務契約介面

```csharp
/// <summary>
/// AI 服務提供者抽象介面（符合 Constitution Principle 5）
/// </summary>
public interface IAIServiceProvider
{
    /// <summary>
    /// 使用 AI 解析非結構化文字，萃取結構化資料
    /// </summary>
    /// <typeparam name="T">目標資料型別（如 List<Song>）</typeparam>
    /// <param name="prompt">提示詞</param>
    /// <param name="userInput">使用者輸入文字</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeout">逾時設定（預設 10 秒）</param>
    /// <param name="cancellationToken">取消標記</param>
    /// <returns>解析後的結構化資料</returns>
    /// <exception cref="AIServiceException">AI 呼叫失敗</exception>
    /// <exception cref="TimeoutException">逾時</exception>
    Task<T> ParseStructuredDataAsync<T>(
        string prompt, 
        string userInput, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 使用 AI 取得文字內容（如歌詞）
    /// </summary>
    /// <param name="prompt">提示詞</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeout">逾時設定（預設 10 秒）</param>
    /// <param name="cancellationToken">取消標記</param>
    /// <returns>AI 回應文字</returns>
    Task<string> GenerateTextAsync(
        string prompt, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 使用 AI 進行語意判定（如答案正確性）
    /// </summary>
    /// <param name="question">問題描述</param>
    /// <param name="userAnswer">使用者答案</param>
    /// <param name="correctAnswer">正確答案</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeout">逾時設定（預設 5 秒）</param>
    /// <param name="cancellationToken">取消標記</param>
    /// <returns>true: 正確 / false: 錯誤</returns>
    Task<bool> ValidateAnswerAsync(
        string question,
        string userAnswer, 
        string correctAnswer, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default);
}
```

#### 2. Copilot SDK 實作範例（優先實作）

```csharp
public class CopilotAIServiceProvider : IAIServiceProvider
{
    private readonly ICopilotClient _copilotClient; // GitHub Copilot SDK 客戶端
    private readonly IConfiguration _configuration;
    private readonly ILogger<CopilotAIServiceProvider> _logger;

    public CopilotAIServiceProvider(
        ICopilotClient copilotClient, 
        IConfiguration configuration,
        ILogger<CopilotAIServiceProvider> logger)
    {
        _copilotClient = copilotClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<T> ParseStructuredDataAsync<T>(
        string prompt, 
        string userInput, 
        string modelId, 
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default)
    {
        var timeoutValue = timeout ?? TimeSpan.FromSeconds(10);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(timeoutValue);

        try
        {
            // GitHub Copilot SDK 支援跨廠商模型（OpenAI、Anthropic 等）
            // 僅需變更 modelId 參數即可切換不同廠商的模型
            var chatRequest = new CopilotChatRequest
            {
                Model = modelId, // 如 "gpt-4-turbo"、"claude-3-sonnet" 等
                Messages = new[]
                {
                    new CopilotMessage { Role = "system", Content = prompt },
                    new CopilotMessage { Role = "user", Content = userInput }
                },
                Temperature = 0.3,
                ResponseFormat = CopilotResponseFormat.Json // 強制 JSON 輸出
            };

            var response = await _copilotClient.ChatAsync(chatRequest, cts.Token);
            
            return JsonSerializer.Deserialize<T>(response.Content)!;
        }
        catch (OperationCanceledException) when (cts.Token.IsCancellationRequested)
        {
            _logger.LogWarning("AI request timeout after {Timeout}s", timeoutValue.TotalSeconds);
            throw new TimeoutException($"AI 呼叫逾時（{timeoutValue.TotalSeconds} 秒）");
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "AI service request failed");
            throw new AIServiceException("AI 服務暫時無法使用，請稍後再試", ex);
        }
    }

    // 其他方法實作...
}
```

#### 3. DI 註冊（Program.cs）

```csharp
// 註冊 GitHub Copilot SDK 客戶端（優先實作）
builder.Services.AddCopilotClient(options =>
{
    options.ApiKey = builder.Configuration["Copilot:ApiKey"] ?? 
                     Environment.GetEnvironmentVariable("GITHUB_TOKEN");
    // Copilot SDK 自動支援多廠商模型，無需額外設定
});

// 註冊 AI Service Provider（使用 Copilot 實作）
builder.Services.AddScoped<IAIServiceProvider, CopilotAIServiceProvider>();

// 未來可擴充其他實作：
// builder.Services.AddScoped<IAIServiceProvider, AzureOpenAIServiceProvider>();
// builder.Services.AddScoped<IAIServiceProvider, LocalModelServiceProvider>();
```

### Testing Strategy

```csharp
// 單元測試範例（使用 Mock）
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
            new Song { Title = "晴天", Artist = "周杰倫", Lyrics = "..." }
        });

    var service = new LyricsGuessGameService(mockAIService.Object);

    // Act
    var result = await service.ParsePlaylistAsync("周杰倫的晴天", "gpt-4");

    // Assert
    Assert.Single(result);
    Assert.Equal("晴天", result[0].Title);
}
```

### Error Handling Matrix

| 錯誤類型 | HTTP 狀態碼 | 處理策略 | 使用者訊息 |
|----------|-------------|----------|------------|
| 逾時 | - | 允許重試 | "AI 處理時間過長，請重試或簡化歌單" |
| Quota 超限 | 429 | 切換模型或稍後重試 | "目前模型使用量已滿，請切換其他模型或稍後再試" |
| 模型不可用 | 503 | 降級至預設模型 | "所選模型暫時無法使用，已自動切換至預設模型" |
| JSON 解析失敗 | - | 記錄錄並要求重試 | "AI 回應格式錯誤，請重試" |
| 驗證失敗 | 401 | 系統錯誤（不對外顯示 API Key） | "AI 服務設定錯誤，請聯絡管理員" |

---

## R2. AI 模型清單資料來源

### Questions
- 若使用 PostgreSQL：是否符合 Constitution（Tool 可獨立移除）？
- 若使用設定檔：如何實現多 Tool 共用模型清單？
- 模型清單是否需要即時更新（影響儲存方式選擇）？

### Research Findings

**Decision**: 使用 **appsettings.json 設定檔** 儲存 AI 模型清單

**Rationale**:
1. **治理原則符合**: 設定檔隨功能程式碼存在，Tool 移除時一併移除，符合 Principle 3（獨立性）
2. **簡化架構**: 無需額外資料庫表與遷移腳本，降低 Phase 1 實作複雜度
3. **動態更新非必要**: 模型清單屬於系統設定（非業務資料），變更頻率低，不需即時更新
4. **多 Tool 共用**: 可透過共用設定檔區段（如 `Shared:AIModels`）實現

### Alternatives Considered

| 方案 | 優點 | 缺點 | 決策 |
|------|------|------|------|
| PostgreSQL 資料表 | 支援動態 CRUD、多 Tool 共用 | 違反 Tool 獨立性、需遷移腳本 | ❌ 拒絕 |
| appsettings.json | 簡單、可版控、符合治理 | 變更需重啟應用程式 | ✅ 採用 |
| Azure App Configuration | 支援動態更新、環境隔離 | 引入外部依賴、過度設計 | 🔶 未來擴充 |

### Implementation Approach

#### 1. appsettings.json 結構（支援 Copilot SDK 跨廠商模型）

```json
{
  "ConnectionStrings": { ... },
  "AzureAd": { ... },
  
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
        "ModelId": "claude-3-sonnet",
        "DisplayName": "Claude 3 Sonnet（精準理解）",
        "Provider": "Anthropic",
        "IsEnabled": true,
        "IsDefault": false
      },
      {
        "ModelId": "claude-3-opus",
        "DisplayName": "Claude 3 Opus（最強推理）",
        "Provider": "Anthropic",
        "IsEnabled": false,
        "IsDefault": false
      }
    ],
    "Timeouts": {
      "ParsePlaylistSeconds": 10,
      "ValidateAnswerSeconds": 5
    }
  },
  "Copilot": {
    "ApiKey": "${GITHUB_TOKEN}"
  }
}

// 說明：
// - Copilot SDK 統一支援多廠商模型（OpenAI、Anthropic 等）
// - Provider 欄位標記模型原始來源，但實際呼叫統一透過 Copilot SDK
// - 切換模型時僅需變更 ModelId 參數，無需切換實作類別
// - IsEnabled 控制模型是否在下拉選單中顯示
```

#### 2. 設定模型類別

```csharp
public class AIModelConfig
{
    /// <summary>
    /// AI SDK 實際呼叫時使用的模型識別碼（如 "gpt-4-turbo"、"claude-3-sonnet"）
    /// </summary>
    public string ModelId { get; set; } = string.Empty;
    
    /// <summary>
    /// 對使用者友善的顯示名稱（如 "GPT-4 Turbo（快速、準確）"）
    /// </summary>
    public string DisplayName { get; set; } = string.Empty;
    
    /// <summary>
    /// AI 模型的原始供應商（如 "OpenAI"、"Anthropic"）
    /// 註：Copilot SDK 支援多廠商，此欄位用於標記來源，實際呼叫統一透過 Copilot SDK
    /// </summary>
    public string Provider { get; set; } = string.Empty;
    
    /// <summary>
    /// 模型是否在下拉選單中顯示
    /// </summary>
    public bool IsEnabled { get; set; }
    
    /// <summary>
    /// 是否為系統啟動時預設選用的模型
    /// </summary>
    public bool IsDefault { get; set; }
}

public class LyricsGuessGameConfig
{
    public List<AIModelConfig> AIModels { get; set; } = new();
    public TimeoutConfig Timeouts { get; set; } = new();
}

public class TimeoutConfig
{
    public int ParsePlaylistSeconds { get; set; } = 10;
    public int ValidateAnswerSeconds { get; set; } = 5;
}
```

#### 3. DI 註冊與注入（Program.cs）

```csharp
// 註冊設定物件
builder.Services.Configure<LyricsGuessGameConfig>(
    builder.Configuration.GetSection("LyricsGuessGame"));

// 服務中注入
public class LyricsGuessGameService : ILyricsGuessGameService
{
    private readonly IAIServiceProvider _aiService;
    private readonly IOptions<LyricsGuessGameConfig> _config;

    public LyricsGuessGameService(
        IAIServiceProvider aiService,
        IOptions<LyricsGuessGameConfig> config)
    {
        _aiService = aiService;
        _config = config;
    }

    public List<AIModelConfig> GetAvailableModels()
    {
        return _config.Value.AIModels
            .Where(m => m.IsEnabled)
            .ToList();
    }

    public string GetDefaultModelId()
    {
        return _config.Value.AIModels
            .FirstOrDefault(m => m.IsDefault)?.ModelId 
            ?? throw new InvalidOperationException("未設定預設 AI 模型");
    }
}
```

### Multi-Tool Sharing Strategy

若未來其他 Tool 需使用相同 AI 模型清單：

**Option 1: 共用設定區段**
```json
{
  "Shared": {
    "AIModels": [ ... ]  // 所有 Tool 共用
  },
  "LyricsGuessGame": {
    "Timeouts": { ... }  // Tool 特定設定
  }
}
```

**Option 2: 獨立設定檔（推薦）**
```plaintext
appsettings.json          # 全域設定
appsettings.AIModels.json # AI 模型共用設定（可獨立版控）
```

### Copilot SDK 跨廠商模型支援說明

**特性**:
- GitHub Copilot SDK 原生支援多種 AI 供應商（OpenAI、Anthropic 等）
- 同一個 `CopilotAIServiceProvider` 實作可切換不同廠商的模型
- 切換模型時僅需變更 `ModelId` 參數，無需變更實作類別或重新註冊服務

**設計優勢**:
1. **統一介面**: 使用者選擇 GPT-4 或 Claude 3，程式碼呼叫方式完全相同
2. **簡化配置**: 無需為每個廠商設定不同的 API Endpoint 或認證方式
3. **靈活擴充**: 新增其他廠商模型僅需更新 `appsettings.json`，無需修改程式碼

**實作範例**:
```csharp
// 切換模型時僅需變更 modelId 參數
await _aiService.ParseStructuredDataAsync<List<Song>>(
    prompt, 
    userInput, 
    "gpt-4-turbo",      // OpenAI 模型
    timeout);

await _aiService.ParseStructuredDataAsync<List<Song>>(
    prompt, 
    userInput, 
    "claude-3-sonnet",  // Anthropic 模型（相同實作類別）
    timeout);
```

---

## R3. 前端資料儲存策略

### Questions
- Blazor Server Component 狀態變數記憶體限制？
- 延遲初始化機制（Lazy Loading）如何設計？
- AI 解析分兩階段的效能影響（基本資訊 vs 完整歌詞）？

### Research Findings

**Decision**: 使用 **Blazor Component 狀態變數 + 延遲初始化機制**

**兩階段 AI 處理流程**:

| 階段 | 處理內容 | AI 回應時間 | 資料大小 | 觸發時機 |
|------|---------|------------|---------|---------|
| 第一階段 | 解析「歌名/演唱者」 | 1-3 秒/首 | ~100 bytes/首 | 歌單輸入後立即執行 |
| 第二階段 | 取得「完整歌詞」 | 2-5 秒/首 | 1-3 KB/首 | 隨機選中該歌曲時才執行 |

**時間對比分析**:
```
原方案（一次性解析所有歌曲完整資料）:
- 50 首歌 = 50 首 × 2-5 秒 = 100-250 秒等待時間（不可接受）

新方案（延遲初始化）:
- 第一階段: 50 首歌 × 1-3 秒 = 50-150 秒 → 分批處理可降至 5-10 秒
- 第二階段: 僅首次選中該歌曲時載入 2-5 秒（分散至遊戲過程）
- 使用者開始遊戲時間: 5-10 秒（vs 原 100-250 秒，提升 10-25 倍）
```

**資料結構設計**:
```csharp
public class Song {
    public string Title { get; set; }         // 第一階段取得
    public string Artist { get; set; }        // 第一階段取得
    public string? Lyrics { get; set; }       // 第二階段延遲載入（預設 null）
    public bool IsInitialized => Lyrics != null;  // 初始化狀態檢查
    public bool InitializationFailed { get; set; }  // 標記 AI 無法取得歌詞的歌曲
}

public class GameState {
    public List<Song> Songs { get; set; } = new();
    public HashSet<int> UsedSongIndices { get; set; } = new();  // 已出題歌曲索引
    public HashSet<int> FailedSongIndices { get; set; } = new();  // 初始化失敗歌曲索引
}
```

**UI 改進（防止洩漏答案）**:
- **原方案問題**: 唯讀文字方塊持續顯示歌單，玩家可從「正在載入歌詞...」提示判斷被選中哪首歌
- **新方案**: 「查看歌單」按鈕 + 彈窗顯示，彈窗僅顯示「歌名 - 演唱者」，**不顯示初始化狀態**
- **優勢**: 維持遊戲懸念，避免洩漏答案

### Alternatives Considered

| 特性 | SessionStorage | IndexedDB | Component 狀態（採用） |
|------|----------------|-----------|---------------------|
| 容量限制 | 5-10 MB | 50 MB - 1 GB | 無強制限制（伺服器記憶體） |
| API 複雜度 | JS Interop | JS Interop + 索引設計 | C# 原生物件 |
| 數據持久性 | Tab 關閉清除 | 永久儲存 | Page Refresh 清除 |
| 效能 | 同步 I/O | 非同步 I/O | 記憶體直接存取 |
| Blazor Server 適配 | 低（需 JS Interop） | 低（需 JS Interop） | 高（原生 C# 模型） |
| 延遲初始化支援 | 可行但需額外邏輯 | 可行但過度複雜 | 天然支援（nullable Lyrics） |

**為何選擇 Component 狀態**:
1. **原生 C# 支援**: 直接使用 List<Song>，無需 JS Interop
2. **延遲初始化友善**: Lyrics 屬性使用 nullable 類型，IsInitialized 檢查簡單
3. **記憶體效率**: 僅已出題歌曲才載入完整歌詞（如 100 首歌玩 20 輪，僅 20 首初始化 = 20-60 KB）
4. **符合 Blazor Server 模型**: Component 狀態變數是 Blazor Server 標準做法

### Implementation Approach

#### 1. 兩階段 AI 處理流程

**第一階段：解析歌名/演唱者（歌單輸入時）**
```csharp
public async Task<List<Song>> ParsePlaylistBasicInfoAsync(
    string playlistText, 
    string aiModelId, 
    CancellationToken cancellationToken = default)
{
    var prompt = @"解析以下歌單文字，萃取歌名與演唱者。
回傳 JSON 格式: [{""title"":""歌名"",""artist"":""演唱者""}]
不要包含歌詞，僅返回歌名和演唱者。";

    var songs = await _aiService.ParseStructuredDataAsync<List<Song>>(
        prompt,
        playlistText,
        aiModelId,
        TimeSpan.FromSeconds(5),  // 快速解析，不含歌詞
        cancellationToken);

    // 初始化所有歌曲為未初始化狀態
    foreach (var song in songs)
    {
        song.Lyrics = null;  // 延遲載入
        song.InitializationFailed = false;
    }

    return songs;
}
```

**第二階段：延遲載入歌詞（隨機選中時）**
```csharp
public async Task<bool> InitializeSongLyricsAsync(
    Song song, 
    string aiModelId, 
    CancellationToken cancellationToken = default)
{
    // 如果已初始化或已失敗，跳過
    if (song.IsInitialized || song.InitializationFailed)
        return song.IsInitialized;

    try
    {
        var prompt = $"請提供歌曲「{song.Title}」（演唱者：{song.Artist}）的完整歌詞。";
        
        var lyrics = await _aiService.GenerateTextAsync(
            prompt,
            aiModelId,
            TimeSpan.FromSeconds(5),  // 單首歌詞快速載入
            cancellationToken);

        if (!string.IsNullOrWhiteSpace(lyrics))
        {
            song.Lyrics = lyrics;
            return true;
        }
        else
        {
            song.InitializationFailed = true;
            return false;
        }
    }
    catch (Exception ex)
    {
        _logger.LogWarning(ex, "無法初始化歌曲 {Title} - {Artist} 的歌詞", song.Title, song.Artist);
        song.InitializationFailed = true;
        return false;
    }
}
```

#### 2. 隨機選歌邏輯（含延遲初始化）

```csharp
public async Task<Question?> GenerateRandomQuestionAsync(
    GameState gameState, 
    string aiModelId, 
    int maxRetries = 3)
{
    var availableIndices = Enumerable.Range(0, gameState.Songs.Count)
        .Except(gameState.UsedSongIndices)
        .Except(gameState.FailedSongIndices)
        .ToList();

    if (!availableIndices.Any())
        return null;  // 所有歌曲已用完或初始化失敗

    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        var randomIndex = availableIndices[Random.Shared.Next(availableIndices.Count)];
        var song = gameState.Songs[randomIndex];

        // 延遲初始化歌詞（如果尚未初始化）
        if (!song.IsInitialized)
        {
            bool success = await InitializeSongLyricsAsync(song, aiModelId);
            
            if (!success)
            {
                // 初始化失敗，標記並重試
                gameState.FailedSongIndices.Add(randomIndex);
                availableIndices.Remove(randomIndex);
                continue;
            }
        }

        // 生成問題
        gameState.UsedSongIndices.Add(randomIndex);
        return CreateQuestionFromSong(song);
    }

    return null;  // 多次重試仍無法初始化
}
```

#### 3. UI 歌單顯示（按鈕 + 彈窗）

**Razor Component**
```razor
<button @onclick="ShowPlaylistDialog">查看歌單 (@songs.Count 首)</button>

@if (showDialog)
{
    <div class="modal">
        <div class="modal-content">
            <h3>已解析歌單</h3>
            <ul>
                @foreach (var song in songs)
                {
                    <!-- 不顯示初始化狀態，避免洩漏答案 -->
                    <li>@song.Title - @song.Artist</li>
                }
            </ul>
            <button @onclick="() => showDialog = false">關閉</button>
        </div>
    </div>
}

@code {
    private bool showDialog = false;
    
    private void ShowPlaylistDialog()
    {
        showDialog = true;
    }
}
```

#### 4. 載入提示（首次初始化歌曲時）

```razor
@if (isInitializingSong)
{
    <div class="loading-overlay">
        <div class="spinner"></div>
        <p>正在載入歌詞...</p>
    </div>
}
```

### Error Handling Strategy

| 錯誤情境 | 檢測方式 | 處理策略 | 使用者訊息 |
|----------|----------|----------|------------|
| 歌曲初始化失敗 | InitializeSongLyricsAsync 回傳 false | 標記為 FailedSongIndices，重新隨機選歌 | 透明處理（不打擾使用者） |
| 所有歌曲初始化失敗 | availableIndices 為空 | 顯示錯誤訊息 | "無法取得任何歌詞，請更換歌單" |
| 第一階段解析失敗 | ParsePlaylistBasicInfoAsync 拋出異常 | 顯示錯誤訊息 | "無法解析歌單，請檢查格式" |
| AI 逾時（>5 秒） | TimeoutException | 標記失敗並重試 | "AI 處理時間過長，正在重試..." |

---

## R4. Blazor Server SignalR 連線穩定性

### Questions
- SignalR 預設逾時設定值？
- AI 呼叫（10 秒解析）是否會觸發 Keep-Alive 機制？
- 斷線重連時，SessionStorage 資料是否會遺失？

### Research Findings

**Decision**: 調整 SignalR 設定，確保長時間 AI 呼叫不會導致斷線

**SignalR Default Settings** (ASP.NET Core 8.0):
| 設定項 | 預設值 | 說明 |
|--------|--------|------|
| ClientTimeoutInterval | 30 秒 | 伺服器未收到 Ping 後等待時間 |
| KeepAliveInterval | 15 秒 | 伺服器主動發送 Ping 頻率 |
| HandshakeTimeout | 15 秒 | 初始握手逾時 |
| MaximumReceiveMessageSize | 32 KB | 單次訊息大小限制 |

**AI Call Duration Analysis**:
- 歌單解析（10 秒）< ClientTimeoutInterval（30 秒）✅ **安全**
- 答案判定（5 秒）< ClientTimeoutInterval（30 秒）✅ **安全**
- KeepAlive（15 秒）會在 AI 呼叫期間自動觸發 ✅ **無需調整**

**SessionStorage Persistence**:
- SessionStorage 資料儲存於 **客戶端瀏覽器**
- SignalR 斷線重連 **不會影響** SessionStorage
- 頁面重新整理會清空 SessionStorage（預期行為）

**Rationale**:
- 預設設定已足夠應對 10 秒 AI 呼叫
- 無需調整 SignalR 逾時參數
- 建議加入 UI Loading 指示，避免使用者誤以為系統無回應

### Alternatives Considered

| 方案 | 優點 | 缺點 | 決策 |
|------|------|------|------|
| 增加 ClientTimeoutInterval 至 60 秒 | 更大容錯空間 | 延遲錯誤偵測時間 | 🔶 備案（若測試發現問題） |
| 使用預設值（30 秒） | 符合標準、無需調整 | 需確保 AI 呼叫 < 10 秒 | ✅ 採用 |
| 改用 Blazor WebAssembly | 無 SignalR 依賴 | 需重新設計架構、AI Key 曝露風險 | ❌ 拒絕 |

### Implementation Approach

#### 1. Program.cs SignalR 設定（使用預設值）

```csharp
builder.Services.AddServerSideBlazor(options =>
{
    // 保留預設值（已足夠）
    // options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    // options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    
    // 僅調整訊息大小限制（若歌詞過長）
    options.MaximumReceiveMessageSize = 64 * 1024; // 64 KB（預設 32 KB）
});
```

#### 2. AI 呼叫逾時保護

```csharp
public async Task<List<Song>> ParsePlaylistAsync(
    string playlistText, 
    string aiModelId, 
    CancellationToken cancellationToken = default)
{
    // 設定 AI 呼叫逾時（10 秒）< SignalR 逾時（30 秒）
    var timeout = TimeSpan.FromSeconds(10);
    
    try
    {
        return await _aiService.ParseStructuredDataAsync<List<Song>>(
            "...",
            playlistText,
            aiModelId,
            timeout,
            cancellationToken);
    }
    catch (TimeoutException)
    {
        // AI 逾時不會導致 SignalR 斷線（10s < 30s）
        throw new InvalidOperationException("AI 處理時間過長，請簡化歌單或稍後再試");
    }
}
```

#### 3. UI Loading 狀態指示

```razor
@if (isProcessing)
{
    <div class="loading-overlay">
        <div class="spinner"></div>
        <p>AI 正在解析歌單，預計需要 5-10 秒...</p>
    </div>
}
```

### Connection Lost Handling

**Scenario**: 使用者網路短暫中斷（< 30 秒）

**Blazor Server Behavior**:
1. SignalR 自動嘗試重新連線（預設 4 次）
2. 重連成功後，伺服器端狀態恢復（Blazor Component 狀態保留）
3. SessionStorage 資料完整保留（客戶端儲存）

**User Experience**:
- 顯示「正在重新連線...」訊息（Blazor 內建 UI）
- 重連成功後自動恢復遊戲狀態
- 無需使用者手動操作

---

## R5. 隨機抽題演算法

### Questions
- 如何避免連續兩題來自同一首歌？
- 如何確保片段包含關鍵字（避免「啊～」等無意義內容）？
- 是否需要紀錄已出題目（避免重複）？

### Research Findings

**Decision**: 採用 **加權隨機演算法 + 歌詞品質過濾**

**Algorithm Design**:
```
1. 過濾無效歌詞片段（< 10 字、重複字元 > 50%、僅標點符號）
2. 排除上一題的歌曲（避免連續重複）
3. 從剩餘歌曲中隨機抽選
4. 從選中歌曲的歌詞中隨機擷取 2-4 句
5. 紀錄已出題目索引（SessionStorage），避免同一場遊戲重複
```

**Rationale**:
1. **避免連續重複**: 簡單的「排除上一首」策略已足夠（歌單通常 10-20 首）
2. **歌詞品質控制**: 過濾無意義片段，提升遊戲體驗
3. **已出題紀錄**: 儲存於 SessionStorage，無需後端支援

### Implementation Approach

#### 1. 歌詞片段品質驗證

```csharp
private bool IsValidLyricsSnippet(string snippet)
{
    // 最少 10 個字元
    if (snippet.Length < 10) return false;

    // 移除空白與標點
    var cleanText = Regex.Replace(snippet, @"[\s\p{P}]", "");
    if (cleanText.Length < 5) return false;

    // 檢查重複字元比例（避免「啊啊啊啊～」）
    var uniqueChars = cleanText.Distinct().Count();
    var repetitionRatio = (double)uniqueChars / cleanText.Length;
    if (repetitionRatio < 0.3) return false; // 至少 30% 字元不重複

    return true;
}
```

#### 2. 隨機抽題演算法

```csharp
public Question GenerateQuestion(
    List<Song> songs, 
    int? excludeSongIndex = null,
    HashSet<int>? usedSongIndices = null)
{
    if (songs.Count == 0)
        throw new ArgumentException("歌曲清單為空");

    // 建立可選歌曲索引清單
    var availableIndices = Enumerable.Range(0, songs.Count)
        .Where(i => i != excludeSongIndex)  // 排除上一首
        .Where(i => usedSongIndices?.Contains(i) != true)  // 排除已出題
        .ToList();

    if (availableIndices.Count == 0)
    {
        // 所有歌曲已出完，重置已出題紀錄
        availableIndices = Enumerable.Range(0, songs.Count)
            .Where(i => i != excludeSongIndex)
            .ToList();
    }

    // 隨機選擇歌曲
    var randomIndex = availableIndices[Random.Shared.Next(availableIndices.Count)];
    var selectedSong = songs[randomIndex];

    // 擷取歌詞片段（2-4 句）
    var snippet = ExtractLyricsSnippet(selectedSong.Lyrics);

    return new Question
    {
        LyricsSnippet = snippet,
        CorrectSongTitle = selectedSong.Title,
        CorrectArtist = selectedSong.Artist,
        SongIndex = randomIndex
    };
}

private string ExtractLyricsSnippet(string lyrics)
{
    // 分割歌詞為句子（以換行或標點符號分隔）
    var sentences = Regex.Split(lyrics, @"[\n。！？]")
        .Where(s => !string.IsNullOrWhiteSpace(s))
        .Where(IsValidLyricsSnippet)
        .ToList();

    if (sentences.Count == 0)
        throw new InvalidOperationException("歌詞無有效內容");

    // 隨機選擇起始句
    var startIndex = Random.Shared.Next(0, Math.Max(1, sentences.Count - 2));
    
    // 擷取 2-4 句
    var snippetLength = Random.Shared.Next(2, Math.Min(5, sentences.Count - startIndex + 1));
    var snippet = string.Join("\n", sentences.Skip(startIndex).Take(snippetLength));

    return snippet;
}
```

#### 3. GameState 中的已出題紀錄

```csharp
public class GameState
{
    public List<Song> SongList { get; set; } = new();
    public Question? CurrentQuestion { get; set; }
    public int Score { get; set; }
    public int TotalQuestions { get; set; }
    public HashSet<int> UsedSongIndices { get; set; } = new(); // 已出題歌曲索引
}
```

### Edge Cases Handling

| 情境 | 處理策略 |
|------|----------|
| 歌詞全為「啊～喔～」無意義內容 | 擲出 InvalidOperationException，提示使用者該歌曲無法出題 |
| 僅剩 1 首歌曲可選 | 允許重複出題（已出題紀錄重置） |
| 所有句子長度 < 10 字 | 降低最小長度要求至 5 字 |
| 歌詞無換行符號 | 使用標點符號分割 |

---

## Summary of Research Outcomes

| 研究項目 | 決策 | 主要產出 | 連結 |
|----------|------|----------|------|
| **R1** | AI 整合方式 | 自訂 IAIServiceProvider | 契約介面（ParseStructuredDataAsync、GenerateTextAsync、ValidateAnswerAsync）、OpenAI 實作範例、錯誤處理矩陣 | [R1 詳細](#r1-copilotsdk-使用模式研究) |
| **R2** | AI 模型清單 | appsettings.json | 設定結構、DI 註冊、多 Tool 共用策略 | [R2 詳細](#r2-ai-模型清單管理方式) |
| **R3** | 前端資料儲存策略 | Component 狀態 + 延遲初始化 | 兩階段 AI 處理：第一階段僅解析歌名/演唱者（5-10 秒），第二階段隨機選中時延遲載入歌詞（2-5 秒），等待時間分散至遊戲過程 | [R3 詳細](#r3-前端資料儲存策略) |
| **R4** | SignalR 連線 | 使用預設設定（30 秒逾時） | 逾時保護策略、重連機制說明 | [R4 詳細](#r4-blazor-server-signalr-連線穩定性) |
| **R5** | 抽題演算法 | 加權隨機 + 品質過濾 | 演算法實作、品質驗證邏輯、已出題紀錄 | [R5 詳細](#r5-隨機題目生成演算法) |

**GATE PASS**: 所有研究任務完成 ✅ 可進入 Phase 1 設計階段

---

**Appendix: Key Takeaways**

1. **不使用現成 copilot.sdk**，改為自訂 AI 抽象層（符合治理原則）
2. **AI 模型清單使用設定檔**（非資料庫），保持 Tool 獨立性
3. **兩階段 AI 處理 + 延遲初始化**：歌單輸入時僅解析基本資訊（5-10 秒），隨機選歌時才載入歌詞（2-5 秒），大幅縮短等待時間
4. **UI 改進：按鈕彈窗顯示歌單**，避免從初始化過程洩漏答案
5. **SignalR 預設設定已足夠**，無需調整逾時參數
6. **隨機演算法加入品質過濾**，提升遊戲體驗

**Next Steps**: 
- 執行 Phase 1（Data Model、API Contracts、Quick Start）
- 更新 plan.md 中的 Technical Context（移除 copilot.sdk，改為 IAIServiceProvider）
- 更新 spec.md 中的功能需求（反映兩階段 AI 處理流程）
