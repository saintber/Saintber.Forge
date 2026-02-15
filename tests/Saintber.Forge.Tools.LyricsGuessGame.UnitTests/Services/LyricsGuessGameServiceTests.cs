using FluentAssertions;
using Moq;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Exceptions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Saintber.Forge.Tools.LyricsGuessGame.BLL;
using Saintber.Forge.Tools.LyricsGuessGame.BLL.Config;
using Xunit;

namespace Saintber.Forge.Tools.LyricsGuessGame.UnitTests.Services;

public class LyricsGuessGameServiceTests
{
    private static LyricsGuessGameConfig CreateConfig() => new()
    {
        ParsePlaylistTimeoutSeconds = 10,
        GenerateLyricsSnippetTimeoutSeconds = 5,
        ValidateAnswerTimeoutSeconds = 5,
        MinSnippetLength = 10,
        MaxSnippetLength = 50
    };

    [Fact]
    public async Task ParsePlaylistBasicInfoAsync_ShouldReturnSongs_WithCanGenerateQuestion()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var expected = new List<Song>
        {
            new() { Title = "晴天", Artist = "周杰倫", CanGenerateQuestion = false }
        };

        aiService
            .Setup(x => x.ParseStructuredDataAsync<List<Song>>(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.ParsePlaylistTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var service = new LyricsGuessGameService(aiService.Object, config);

        // Act
        var result = await service.ParsePlaylistBasicInfoAsync("晴天 周杰倫", "gpt-4o");

        // Assert
        result.Should().HaveCount(1);
        result[0].Title.Should().Be("晴天");
        result[0].Artist.Should().Be("周杰倫");
        result[0].CanGenerateQuestion.Should().BeTrue();
    }

    [Fact]
    public async Task ParsePlaylistBasicInfoAsync_ShouldThrow_WhenInputEmpty()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var service = new LyricsGuessGameService(aiService.Object, CreateConfig());

        // Act
        var act = async () => await service.ParsePlaylistBasicInfoAsync(" ", "gpt-4o");

        // Assert
        await act.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GenerateLyricsSnippetAsync_ShouldReturnSnippet_WhenValid()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var service = new LyricsGuessGameService(aiService.Object, config);
        var song = new Song { Title = "晴天", Artist = "周杰倫" };

        aiService
            .Setup(x => x.GenerateTextAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.GenerateLyricsSnippetTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("雨一直下 氣氛不算融洽");

        // Act
        var snippet = await service.GenerateLyricsSnippetAsync(song, "gpt-4o");

        // Assert
        snippet.Should().NotBeNullOrWhiteSpace();
        song.CanGenerateQuestion.Should().BeTrue();
    }

    [Fact]
    public async Task GenerateLyricsSnippetAsync_ShouldMarkFailed_WhenTooShort()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var service = new LyricsGuessGameService(aiService.Object, config);
        var song = new Song { Title = "晴天", Artist = "周杰倫" };

        aiService
            .SetupSequence(x => x.GenerateTextAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.GenerateLyricsSnippetTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("太短")
            .ReturnsAsync("還是短");

        // Act
        var snippet = await service.GenerateLyricsSnippetAsync(song, "gpt-4o");

        // Assert
        snippet.Should().BeNull();
        song.CanGenerateQuestion.Should().BeFalse();
    }

    [Fact]
    public async Task GenerateLyricsSnippetAsync_ShouldMarkFailed_OnAIError()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var service = new LyricsGuessGameService(aiService.Object, config);
        var song = new Song { Title = "晴天", Artist = "周杰倫" };

        aiService
            .Setup(x => x.GenerateTextAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.GenerateLyricsSnippetTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AIServiceException("boom"));

        // Act
        var snippet = await service.GenerateLyricsSnippetAsync(song, "gpt-4o");

        // Assert
        snippet.Should().BeNull();
        song.CanGenerateQuestion.Should().BeFalse();
    }

    [Fact]
    public async Task GenerateRandomQuestionAsync_ShouldReturnQuestion_WhenSnippetAvailable()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var service = new LyricsGuessGameService(aiService.Object, config);
        var gameState = new GameState
        {
            Songs = new List<Song> { new() { Title = "晴天", Artist = "周杰倫" } }
        };

        aiService
            .Setup(x => x.GenerateTextAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.GenerateLyricsSnippetTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("雨一直下 氣氛不算融洽");

        // Act
        var question = await service.GenerateRandomQuestionAsync(gameState, "gpt-4o", 1);

        // Assert
        question.Should().NotBeNull();
        gameState.UsedSongIndices.Should().Contain(0);
        question!.LyricsSnippet.Should().NotBeNullOrWhiteSpace();
        question.CorrectSongTitle.Should().Be("晴天");
    }

    [Fact]
    public async Task GenerateRandomQuestionAsync_ShouldReturnNull_WhenNoAvailableSongs()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var service = new LyricsGuessGameService(aiService.Object, CreateConfig());
        var gameState = new GameState
        {
            Songs = new List<Song> { new() { Title = "晴天", Artist = "周杰倫", CanGenerateQuestion = false } }
        };

        // Act
        var question = await service.GenerateRandomQuestionAsync(gameState, "gpt-4o", 1);

        // Assert
        question.Should().BeNull();
    }

    [Fact]
    public async Task ValidateAnswerAsync_ShouldReturnWrong_WhenEmpty()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var service = new LyricsGuessGameService(aiService.Object, CreateConfig());

        // Act
        var result = await service.ValidateAnswerAsync(" ", "晴天", "gpt-4o");

        // Assert
        result.SimilarityType.Should().Be(SimilarityType.Wrong);
        result.Feedback.Should().Be("請輸入答案");
    }

    [Fact]
    public async Task ValidateAnswerAsync_ShouldCallAI_WhenInputProvided()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var expected = new AnswerValidationResult
        {
            SimilarityType = SimilarityType.Exact,
            Feedback = "答對了！"
        };

        aiService
            .Setup(x => x.ParseStructuredDataAsync<AnswerValidationResult>(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                config.ValidateAnswerTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var service = new LyricsGuessGameService(aiService.Object, config);

        // Act
        var result = await service.ValidateAnswerAsync("晴天", "晴天", "gpt-4o");

        // Assert
        result.Should().BeEquivalentTo(expected);
    }
}
