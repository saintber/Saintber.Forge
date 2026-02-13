using System.Text;
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
            Lyrics = null,
            InitializationFailed = false
        }).ToList();
    }

    /// <summary>
    /// 初始化歌曲歌詞（延遲載入）
    /// </summary>
    public async Task InitializeSongLyricsAsync(
        Song song,
        string modelId,
        CancellationToken cancellationToken = default)
    {
        if (song == null)
        {
            throw new ArgumentNullException(nameof(song));
        }

        if (song.IsInitialized)
        {
            return; // Already initialized
        }

        var prompt = $@"請提供歌曲《{song.Title}》（演唱者：{song.Artist}）的完整歌詞。

要求：
1. 僅提供歌詞文字，不包含任何說明或註解
2. 每段之間用空行分隔
3. 如果無法取得歌詞，請回應：""LYRICS_NOT_FOUND""";

        try
        {
            var lyrics = await _aiService.GenerateTextAsync(
                prompt,
                modelId,
                _config.FetchLyricsTimeoutSeconds,
                cancellationToken);

            if (lyrics.Contains("LYRICS_NOT_FOUND") || lyrics.Length < 50)
            {
                song.InitializationFailed = true;
                return;
            }

            song.Lyrics = lyrics;
        }
        catch (AIServiceException)
        {
            song.InitializationFailed = true;
            throw;
        }
    }

    /// <summary>
    /// 生成新題目（隨機選取歌詞片段）
    /// </summary>
    public Question GenerateQuestion(Song song, int songIndex)
    {
        if (song == null)
        {
            throw new ArgumentNullException(nameof(song));
        }

        if (!song.IsInitialized)
        {
            throw new InvalidOperationException($"Song '{song.Title}' lyrics are not initialized");
        }

        // Split lyrics into lines
        var lines = song.Lyrics!
            .Split(new[] { '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .ToList();

        if (lines.Count == 0)
        {
            throw new InvalidOperationException($"Song '{song.Title}' has no valid lyrics lines");
        }

        // Select random starting line
        var maxStartIndex = Math.Max(0, lines.Count - 3); // Ensure at least 3 lines available
        var startIndex = _random.Next(0, maxStartIndex + 1);

        // Build snippet (2-4 lines)
        var lineCount = Math.Min(4, lines.Count - startIndex);
        lineCount = Math.Max(2, lineCount);
        
        var snippet = new StringBuilder();
        for (int i = 0; i < lineCount; i++)
        {
            if (startIndex + i < lines.Count)
            {
                snippet.AppendLine(lines[startIndex + i]);
            }
        }

        var snippetText = snippet.ToString().Trim();

        // Ensure snippet meets minimum length requirement
        var contentLength = snippetText.Replace(" ", "").Replace("\n", "").Replace("\r", "").Length;
        if (contentLength < _config.MinSnippetLength)
        {
            // Fallback: use first 3 lines
            snippet.Clear();
            for (int i = 0; i < Math.Min(3, lines.Count); i++)
            {
                snippet.AppendLine(lines[i]);
            }
            snippetText = snippet.ToString().Trim();
        }

        return new Question
        {
            LyricsSnippet = snippetText,
            CorrectSongTitle = song.Title,
            CorrectArtist = song.Artist,
            SongIndex = songIndex,
            QuestionState = QuestionState.Unanswered
        };
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

        return await _aiService.ValidateAnswerAsync(
            userAnswer,
            correctAnswer,
            modelId,
            _config.ValidateAnswerTimeoutSeconds,
            cancellationToken);
    }

    // DTO removed: parse directly into Song to simplify testing and avoid private type coupling.
}
