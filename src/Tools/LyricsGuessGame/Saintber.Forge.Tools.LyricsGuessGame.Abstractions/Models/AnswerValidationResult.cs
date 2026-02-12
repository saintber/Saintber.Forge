namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

/// <summary>
/// 答案相似度類型枚舉 (T017)
/// </summary>
public enum SimilarityType
{
    /// <summary>完全正確</summary>
    Exact,

    /// <summary>風格很像但不是（相似但錯誤）</summary>
    SimilarButWrong,

    /// <summary>只差一個字（幾乎正確）</summary>
    AlmostCorrect,

    /// <summary>不對喔！（完全錯誤）</summary>
    Wrong
}

/// <summary>
/// 答案驗證結果 (T017)
/// </summary>
public class AnswerValidationResult
{
    /// <summary>
    /// 答案相似度類型
    /// </summary>
    public required SimilarityType SimilarityType { get; set; }

    /// <summary>
    /// AI 提供的回饋訊息
    /// </summary>
    public required string Feedback { get; set; }

    /// <summary>
    /// 是否為正確答案
    /// </summary>
    public bool IsCorrect => SimilarityType == SimilarityType.Exact;
}
