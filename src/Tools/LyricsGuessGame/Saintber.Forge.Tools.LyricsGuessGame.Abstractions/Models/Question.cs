namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

/// <summary>
/// 題目狀態枚舉 (T013)
/// </summary>
public enum QuestionState
{
    /// <summary>未作答</summary>
    Unanswered,

    /// <summary>已答對</summary>
    AnsweredCorrectly,

    /// <summary>已公佈答案</summary>
    RevealedAnswer
}

/// <summary>
/// 代表當前顯示的猜歌題目 (T013)
/// </summary>
public class Question
{
    /// <summary>
    /// 隨機選取的歌詞片段（至少 10 字，句子完整）
    /// </summary>
    public required string LyricsSnippet { get; set; }

    /// <summary>
    /// 正確答案：歌曲名稱
    /// </summary>
    public required string CorrectSongTitle { get; set; }

    /// <summary>
    /// 正確答案：演唱者名稱
    /// </summary>
    public required string CorrectArtist { get; set; }

    /// <summary>
    /// 歌曲在 GameState.Songs 中的索引位置
    /// </summary>
    public required int SongIndex { get; set; }

    /// <summary>
    /// 題目狀態
    /// </summary>
    public QuestionState QuestionState { get; set; } = QuestionState.Unanswered;
}
