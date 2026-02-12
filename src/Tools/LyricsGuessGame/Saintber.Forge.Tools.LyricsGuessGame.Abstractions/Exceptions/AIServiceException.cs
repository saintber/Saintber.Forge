namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Exceptions;

/// <summary>
/// AI 服務呼叫異常 (T018)
/// </summary>
public class AIServiceException : Exception
{
    /// <summary>
    /// 建立 AI 服務異常
    /// </summary>
    public AIServiceException()
    {
    }

    /// <summary>
    /// 建立包含訊息的 AI 服務異常
    /// </summary>
    /// <param name="message">異常訊息</param>
    public AIServiceException(string message) : base(message)
    {
    }

    /// <summary>
    /// 建立包含訊息與內部異常的 AI 服務異常
    /// </summary>
    /// <param name="message">異常訊息</param>
    /// <param name="innerException">內部異常</param>
    public AIServiceException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
