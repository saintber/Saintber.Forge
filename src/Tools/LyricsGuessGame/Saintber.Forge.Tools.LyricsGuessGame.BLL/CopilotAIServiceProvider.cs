using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using GitHub.Copilot.SDK;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Exceptions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;

namespace Saintber.Forge.Tools.LyricsGuessGame.BLL;

public class CopilotAIServiceProvider : IAIServiceProvider
{
    private readonly CopilotClient _copilotClient;
    private readonly SemaphoreSlim _startLock = new(1, 1);
    private bool _started;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Converters = { new JsonStringEnumConverter() }
    };

    public CopilotAIServiceProvider(CopilotClient copilotClient)
    {
        _copilotClient = copilotClient ?? throw new ArgumentNullException(nameof(copilotClient));
    }

    public async Task<T> ParseStructuredDataAsync<T>(
        string prompt,
        string userInput,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default)
    {
        var responseText = await SendPromptAsync(
            systemPrompt: prompt,
            userPrompt: userInput,
            modelId: modelId,
            timeoutSeconds: timeoutSeconds,
            cancellationToken: cancellationToken);

        var jsonText = ExtractJson(responseText);
        return JsonSerializer.Deserialize<T>(jsonText, JsonOptions)
               ?? throw new AIServiceException("AI returned null or invalid JSON");
    }

    public async Task<string> GenerateTextAsync(
        string prompt,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default)
    {
        return await SendPromptAsync(
            systemPrompt: string.Empty,
            userPrompt: prompt,
            modelId: modelId,
            timeoutSeconds: timeoutSeconds,
            cancellationToken: cancellationToken);
    }

    public async Task<AnswerValidationResult> ValidateAnswerAsync(
        string userAnswer,
        string correctAnswer,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken = default)
    {
        var prompt = $@"請比較使用者答案與正確答案的相似度。請以 JSON 格式回應：
{{
  ""SimilarityType"": ""Exact|AlmostCorrect|SimilarButWrong|Wrong"",
  ""Feedback"": ""給使用者的回饋訊息（繁體中文）""
}}

正確答案：{correctAnswer}
使用者答案：{userAnswer}";

        return await ParseStructuredDataAsync<AnswerValidationResult>(
            prompt,
            string.Empty,
            modelId,
            timeoutSeconds,
            cancellationToken);
    }

    protected virtual async Task<string> SendPromptAsync(
        string systemPrompt,
        string userPrompt,
        string modelId,
        int timeoutSeconds,
        CancellationToken cancellationToken)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

        await EnsureStartedAsync(cts.Token);

        var sessionConfig = new SessionConfig
        {
            Model = modelId
        };

        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            sessionConfig.SystemMessage = new SystemMessageConfig
            {
                Mode = SystemMessageMode.Append,
                Content = systemPrompt
            };
        }

        await using var session = await _copilotClient.CreateSessionAsync(sessionConfig);

        var responseBuilder = new StringBuilder();
        var completionSource = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);

        using var subscription = session.On(evt =>
        {
            if (evt is AssistantMessageEvent messageEvent)
            {
                if (!string.IsNullOrWhiteSpace(messageEvent.Data?.Content))
                {
                    responseBuilder.Append(messageEvent.Data.Content);
                }
            }
            else if (evt is SessionIdleEvent)
            {
                completionSource.TrySetResult(responseBuilder.ToString());
            }
        });

        await session.SendAsync(new MessageOptions { Prompt = userPrompt });

        using var registration = cts.Token.Register(() => completionSource.TrySetCanceled(cts.Token));

        try
        {
            return await completionSource.Task;
        }
        catch (OperationCanceledException)
        {
            throw new AIServiceException($"AI request timed out after {timeoutSeconds} seconds");
        }
        catch (Exception ex) when (ex is not AIServiceException)
        {
            throw new AIServiceException($"AI service error: {ex.Message}", ex);
        }
    }

    private async Task EnsureStartedAsync(CancellationToken cancellationToken)
    {
        if (_started)
        {
            return;
        }

        await _startLock.WaitAsync(cancellationToken);
        try
        {
            if (_started)
            {
                return;
            }

            await _copilotClient.StartAsync();
            _started = true;
        }
        finally
        {
            _startLock.Release();
        }
    }

    private static string ExtractJson(string text)
    {
        text = text.Trim();
        if (text.StartsWith("```json"))
        {
            text = text.Substring(7);
        }
        else if (text.StartsWith("```"))
        {
            text = text.Substring(3);
        }

        if (text.EndsWith("```"))
        {
            text = text.Substring(0, text.Length - 3);
        }

        return text.Trim();
    }
}
