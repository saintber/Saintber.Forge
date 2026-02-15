using FluentAssertions;
using GitHub.Copilot.SDK;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Saintber.Forge.Tools.LyricsGuessGame.BLL;
using Xunit;

namespace Saintber.Forge.Tools.LyricsGuessGame.UnitTests.Services;

public class CopilotAIServiceProviderTests
{
    private sealed class FakeCopilotAIServiceProvider : CopilotAIServiceProvider
    {
        private readonly string _response;

        public FakeCopilotAIServiceProvider(string response)
            : base(new CopilotClient())
        {
            _response = response;
        }

        protected override Task<string> SendPromptAsync(
            string systemPrompt,
            string userPrompt,
            string modelId,
            int timeoutSeconds,
            CancellationToken cancellationToken)
        {
            return Task.FromResult(_response);
        }
    }

    [Fact]
    public async Task ParseStructuredDataAsync_ShouldDeserializeJson()
    {
        // Arrange
        var json = "```json\n{\"SimilarityType\":\"Exact\",\"Feedback\":\"OK\"}\n```";
        var service = new FakeCopilotAIServiceProvider(json);

        // Act
        var result = await service.ParseStructuredDataAsync<AnswerValidationResult>(
            "prompt",
            "input",
            "gpt-4o",
            timeoutSeconds: 1);

        // Assert
        result.SimilarityType.Should().Be(SimilarityType.Exact);
        result.Feedback.Should().Be("OK");
    }

    [Fact]
    public async Task GenerateTextAsync_ShouldReturnRawText()
    {
        // Arrange
        var service = new FakeCopilotAIServiceProvider("hello world");

        // Act
        var result = await service.GenerateTextAsync("prompt", "gpt-4o", 1);

        // Assert
        result.Should().Be("hello world");
    }

}
