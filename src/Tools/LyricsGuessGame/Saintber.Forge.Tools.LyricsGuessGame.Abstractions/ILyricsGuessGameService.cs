using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions;

/// <summary>
/// Lyrics Guess Game 服務契約介面 (T020)
/// </summary>
public interface ILyricsGuessGameService
{
    /// <summary>
    /// 解析歌單文字，取得歌曲基本資訊（歌名 + 演唱者）
    /// </summary>
    /// <param name="playlistText">歌單文字（使用者輸入）</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>歌曲清單（僅包含 Title 和 Artist，Lyrics 為 null）</returns>
    Task<List<Song>> ParsePlaylistBasicInfoAsync(
        string playlistText,
        string modelId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 初始化歌曲歌詞（延遲載入）
    /// </summary>
    /// <param name="song">歌曲物件（將更新 Lyrics 或 InitializationFailed 屬性）</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="cancellationToken">取消權杖</param>
    Task InitializeSongLyricsAsync(
        Song song,
        string modelId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 生成新題目（隨機選取歌詞片段）
    /// </summary>
    /// <param name="song">歌曲物件（必須已初始化歌詞）</param>
    /// <param name="songIndex">歌曲在清單中的索引</param>
    /// <returns>題目物件</returns>
    Question GenerateQuestion(Song song, int songIndex);

    /// <summary>
    /// 驗證使用者答案
    /// </summary>
    /// <param name="userAnswer">使用者答案</param>
    /// <param name="correctAnswer">正確答案（歌名）</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>答案驗證結果</returns>
    Task<AnswerValidationResult> ValidateAnswerAsync(
        string userAnswer,
        string correctAnswer,
        string modelId,
        CancellationToken cancellationToken = default);
}
