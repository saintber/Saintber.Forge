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
    /// 標記該歌曲是否可出題（AI 節錄失敗時設為 false）
    /// </summary>
    public bool CanGenerateQuestion { get; set; } = true;
}
