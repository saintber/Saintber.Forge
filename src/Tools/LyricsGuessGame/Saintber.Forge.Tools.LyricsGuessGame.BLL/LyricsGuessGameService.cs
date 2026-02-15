using Saintber.Forge.Tools.LyricsGuessGame.Abstractions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Exceptions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Saintber.Forge.Tools.LyricsGuessGame.BLL.Config;

namespace Saintber.Forge.Tools.LyricsGuessGame.BLL;

/// <summary>
/// Lyrics Guess Game 服務實作 (T035-T040)
/// </summary>
public class LyricsGuessGameService : ILyricsGuessGameService
{
    private readonly IAIServiceProvider _aiService;
    private readonly LyricsGuessGameConfig _config;
    private readonly Random _random = new();

    public LyricsGuessGameService(IAIServiceProvider aiService, LyricsGuessGameConfig config)
    {
        _aiService = aiService ?? throw new ArgumentNullException(nameof(aiService));
        _config = config ?? throw new ArgumentNullException(nameof(config));
    }

    /// <summary>
    /// 解析歌單基本資訊（歌名 + 演唱者）
    /// </summary>
    public async Task<List<Song>> ParsePlaylistBasicInfoAsync(
        string playlistText,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(playlistText))
        {
            throw new ArgumentException("Playlist text cannot be empty", nameof(playlistText));
        }

        var prompt = @"請將以下歌單文字解析為歌曲清單。每行可能是：
- 歌曲名稱（自動推測演唱者）
- 歌曲名稱 + 演唱者（用空格、tab、或「-」分隔）
- 歌曲說明（取得最符合作品或代表作）

請以 JSON 陣列格式回應，**禁止**加入任何其他說明、評語：
[
  { ""Title"": ""歌曲名稱"", ""Artist"": ""演唱者"" },
  ...
]";

        var songs = await _aiService.ParseStructuredDataAsync<List<Song>>(
            prompt,
            playlistText,
            modelId,
            _config.ParsePlaylistTimeoutSeconds,
            cancellationToken);

        return songs.Select(dto => new Song
        {
            Title = dto.Title,
            Artist = dto.Artist,
            CanGenerateQuestion = true
        }).ToList();
    }

    /// <summary>
    /// 即時節錄歌曲歌詞片段
    /// </summary>
    public async Task<string?> GenerateLyricsSnippetAsync(
        Song song,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        if (song == null)
        {
            throw new ArgumentNullException(nameof(song));
        }

        var prompt = $@"請針對歌曲「{song.Title}」（演唱者：{song.Artist}）隨機節錄歌詞片段作為猜歌題目。
要求：
1. 最少 10 個字以上
2. 必須為完整句子，不可中斷
3. 句數越少越好，優先採用單一句子
4. 僅回傳歌詞片段本身，不要包含歌名或其他說明
5. 不可回傳完整歌詞，只回傳單一片段";

        const int maxAttempts = 2;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            try
            {
                var snippet = await _aiService.GenerateTextAsync(
                    prompt,
                    modelId,
                    _config.GenerateLyricsSnippetTimeoutSeconds,
                    cancellationToken);

                if (IsSnippetValid(snippet))
                {
                    return snippet.Trim();
                }
            }
            catch (AIServiceException)
            {
                song.CanGenerateQuestion = false;
                return null;
            }
        }

        song.CanGenerateQuestion = false;
        return null;
    }

    /// <summary>
    /// 生成新題目（隨機選歌並即時節錄歌詞片段）
    /// </summary>
    public async Task<Question?> GenerateRandomQuestionAsync(
        GameState gameState,
        string modelId,
        int maxRetries = 3,
        CancellationToken cancellationToken = default)
    {
        if (gameState == null)
        {
            throw new ArgumentNullException(nameof(gameState));
        }
        var availableIndices = gameState.Songs
            .Select((song, index) => new { song, index })
            .Where(x => x.song.CanGenerateQuestion && !gameState.UsedSongIndices.Contains(x.index))
            .Select(x => x.index)
            .ToList();

        if (availableIndices.Count == 0)
        {
            return null;
        }

        var attempts = Math.Max(1, maxRetries);
        for (var attempt = 0; attempt < attempts; attempt++)
        {
            if (availableIndices.Count == 0)
            {
                break;
            }

            var pickIndex = availableIndices[_random.Next(availableIndices.Count)];
            var song = gameState.Songs[pickIndex];
            var snippet = await GenerateLyricsSnippetAsync(song, modelId, cancellationToken);

            if (string.IsNullOrWhiteSpace(snippet))
            {
                song.CanGenerateQuestion = false;
                availableIndices.Remove(pickIndex);
                continue;
            }

            gameState.UsedSongIndices.Add(pickIndex);
            return new Question
            {
                LyricsSnippet = snippet,
                CorrectSongTitle = song.Title,
                CorrectArtist = song.Artist,
                SongIndex = pickIndex,
                QuestionState = QuestionState.Unanswered
            };
        }

        return null;
    }

    /// <summary>
    /// 驗證使用者答案
    /// </summary>
    public async Task<AnswerValidationResult> ValidateAnswerAsync(
        string userAnswer,
        string correctAnswer,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userAnswer))
        {
            return new AnswerValidationResult
            {
                SimilarityType = SimilarityType.Wrong,
                Feedback = "請輸入答案"
            };
        }

        var prompt = $@"請比較使用者答案與正確答案的相似度。請以 JSON 格式回應：
{{
  ""SimilarityType"": ""Exact|AlmostCorrect|SimilarButWrong|Wrong"",
  ""Feedback"": ""給使用者的回饋訊息（繁體中文）""
}}

正確答案：{correctAnswer}
使用者答案：{userAnswer}";

        return await _aiService.ParseStructuredDataAsync<AnswerValidationResult>(
            prompt,
            string.Empty,
            modelId,
            _config.ValidateAnswerTimeoutSeconds,
            cancellationToken);
    }

    public List<AIModelConfig> GetAvailableModels()
    {
        return _config.AvailableModels.Where(m => m.IsEnabled).ToList();
    }

    public string GetDefaultModelId()
    {
        return _config.AvailableModels.FirstOrDefault(m => m.IsDefault)?.ModelId
               ?? throw new InvalidOperationException("未設定預設 AI 模型");
    }

    private bool IsSnippetValid(string snippet)
    {
        if (string.IsNullOrWhiteSpace(snippet))
        {
            return false;
        }

        var contentLength = snippet
            .Replace(" ", string.Empty)
            .Replace("\n", string.Empty)
            .Replace("\r", string.Empty)
            .Length;

        return contentLength >= _config.MinSnippetLength;
    }

    // DTO removed: parse directly into Song to simplify testing and avoid private type coupling.
}
