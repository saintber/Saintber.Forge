namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

/// <summary>
/// 代表從歌單解析出的單首歌曲資訊 (T011)
/// </summary>
public class Song
{
    /// <summary>
    /// 歌曲名稱（第一階段 AI 解析取得）
    /// </summary>
    public required string Title { get; set; }

    /// <summary>
    /// 演唱者名稱（第一階段 AI 解析取得）
    /// </summary>
    public required string Artist { get; set; }

    /// <summary>
    /// 完整歌詞（第二階段延遲載入，預設為 null）
    /// </summary>
    public string? Lyrics { get; set; }

    /// <summary>
    /// 標記該歌曲是否初始化失敗（AI 無法取得歌詞），預設 false
    /// </summary>
    public bool InitializationFailed { get; set; } = false;

    /// <summary>
    /// 計算屬性：歌詞是否已初始化（Lyrics 不為 null）
    /// </summary>
    public bool IsInitialized => Lyrics != null;
}
