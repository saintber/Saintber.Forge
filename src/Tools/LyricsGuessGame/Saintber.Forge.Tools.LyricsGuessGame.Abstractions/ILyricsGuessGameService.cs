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
    /// <returns>歌曲清單（僅包含 Title 和 Artist）</returns>
    Task<List<Song>> ParsePlaylistBasicInfoAsync(
        string playlistText,
        string modelId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 即時節錄歌曲歌詞片段
    /// </summary>
    /// <param name="song">歌曲物件（節錄失敗時會標記 CanGenerateQuestion = false）</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>歌詞片段（若無法節錄則為 null）</returns>
    Task<string?> GenerateLyricsSnippetAsync(
        Song song,
        string modelId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 生成新題目（隨機選歌並即時節錄歌詞片段）
    /// </summary>
    /// <param name="gameState">遊戲狀態</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="maxRetries">節錄失敗時的重試次數</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>題目物件（若無法出題則為 null）</returns>
    Task<Question?> GenerateRandomQuestionAsync(
        GameState gameState,
        string modelId,
        int maxRetries = 3,
        CancellationToken cancellationToken = default);

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

    /// <summary>
    /// 取得已啟用的 AI 模型清單
    /// </summary>
    List<AIModelConfig> GetAvailableModels();

    /// <summary>
    /// 取得預設 AI 模型識別碼
    /// </summary>
    string GetDefaultModelId();
}
