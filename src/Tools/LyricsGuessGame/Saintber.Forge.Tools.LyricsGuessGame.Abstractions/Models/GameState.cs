namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

/// <summary>
/// 管理整個遊戲的進行狀態與資料 (T015)
/// </summary>
public class GameState
{
    /// <summary>
    /// 歌曲清單（第一階段 AI 解析後建立）
    /// </summary>
    public List<Song> Songs { get; set; } = new();

    /// <summary>
    /// 當前題目（遊戲開始後建立）
    /// </summary>
    public Question? CurrentQuestion { get; set; }

    /// <summary>
    /// 已出題的歌曲索引集合（避免重複出題）
    /// </summary>
    public HashSet<int> UsedSongIndices { get; set; } = new();

    /// <summary>
    /// 使用者目前選擇的 AI 模型識別碼
    /// </summary>
    public string SelectedModelId { get; set; } = string.Empty;

    /// <summary>
    /// 歌單是否已完成第一階段解析
    /// </summary>
    public bool IsPlaylistParsed { get; set; }

    /// <summary>
    /// 遊戲是否正在進行中
    /// </summary>
    public bool IsGameActive { get; set; }
}
