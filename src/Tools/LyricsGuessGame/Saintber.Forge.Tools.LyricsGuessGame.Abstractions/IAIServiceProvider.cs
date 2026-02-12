using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions;

/// <summary>
/// AI 服務提供者契約介面 (T019)
/// 符合 Constitution Principle 5（契約介面）與 Principle 6（可替換性）
/// </summary>
public interface IAIServiceProvider
{
    /// <summary>
    /// 使用 AI 解析結構化資料（如歌單文字 → 歌曲陣列）
    /// </summary>
    /// <typeparam name="T">目標資料型別</typeparam>
    /// <param name="prompt">提示詞</param>
    /// <param name="userInput">使用者輸入</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeoutSeconds">逾時秒數</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>解析後的結構化資料</returns>
    Task<T> ParseStructuredDataAsync<T>(
        string prompt,
        string userInput,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 使用 AI 生成文字（如取得歌詞）
    /// </summary>
    /// <param name="prompt">提示詞</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeoutSeconds">逾時秒數</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>生成的文字內容</returns>
    Task<string> GenerateTextAsync(
        string prompt,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// 使用 AI 驗證使用者答案
    /// </summary>
    /// <param name="userAnswer">使用者答案</param>
    /// <param name="correctAnswer">正確答案</param>
    /// <param name="modelId">AI 模型識別碼</param>
    /// <param name="timeoutSeconds">逾時秒數</param>
    /// <param name="cancellationToken">取消權杖</param>
    /// <returns>答案驗證結果</returns>
    Task<AnswerValidationResult> ValidateAnswerAsync(
        string userAnswer,
        string correctAnswer,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default);
}
