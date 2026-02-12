using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

namespace Saintber.Forge.Tools.LyricsGuessGame.BLL.Config;

/// <summary>
/// Lyrics Guess Game 配置類別 (T021)
/// </summary>
public class LyricsGuessGameConfig
{
    /// <summary>
    /// 配置區段名稱（對應 appsettings.json 的 key）
    /// </summary>
    public const string SectionName = "LyricsGuessGame";

    /// <summary>
    /// 可用的 AI 模型清單
    /// </summary>
    public List<AIModelConfig> AvailableModels { get; set; } = new();

    /// <summary>
    /// 預設模型識別碼（從 AvailableModels 中選擇 IsDefault = true 的模型）
    /// </summary>
    public string DefaultModelId { get; set; } = string.Empty;

    /// <summary>
    /// 歌單解析逾時秒數（預設 10 秒）
    /// </summary>
    public int ParsePlaylistTimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// 取得歌詞逾時秒數（預設 5 秒）
    /// </summary>
    public int FetchLyricsTimeoutSeconds { get; set; } = 5;

    /// <summary>
    /// 答案驗證逾時秒數（預設 5 秒）
    /// </summary>
    public int ValidateAnswerTimeoutSeconds { get; set; } = 5;

    /// <summary>
    /// 歌詞片段最小字數（預設 10 字）
    /// </summary>
    public int MinSnippetLength { get; set; } = 10;

    /// <summary>
    /// 歌詞片段最大字數（預設 50 字）
    /// </summary>
    public int MaxSnippetLength { get; set; } = 50;

    /// <summary>
    /// 初始化失敗重試次數（預設 3 次）
    /// </summary>
    public int InitializationRetryCount { get; set; } = 3;
}
