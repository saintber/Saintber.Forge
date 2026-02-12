namespace Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

/// <summary>
/// 代表可供使用者選擇的 AI 模型資訊 (T016)
/// </summary>
public class AIModelConfig
{
    /// <summary>
    /// AI SDK 實際呼叫時使用的模型識別碼（如 "gpt-4-turbo"、"claude-3-sonnet"）
    /// </summary>
    public required string ModelId { get; set; }

    /// <summary>
    /// 對使用者友善的顯示名稱（如 "GPT-4 Turbo（快速、準確）"）
    /// </summary>
    public required string DisplayName { get; set; }

    /// <summary>
    /// AI 模型的原始供應商（如 "OpenAI"、"Anthropic"）
    /// </summary>
    public required string Provider { get; set; }

    /// <summary>
    /// 模型是否在下拉選單中顯示
    /// </summary>
    public bool IsEnabled { get; set; } = true;

    /// <summary>
    /// 是否為系統啟動時預設選用的模型（僅一個模型可為 true）
    /// </summary>
    public bool IsDefault { get; set; } = false;
}
