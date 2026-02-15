using Bunit;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Saintber.Forge.BlazorServer.Pages;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Saintber.Forge.Tools.LyricsGuessGame.BLL.Config;
using Xunit;

namespace Saintber.Forge.BlazorServer.UnitTests.Pages;

public class LyricsGuessGameTests : TestContext
{
    private static LyricsGuessGameConfig CreateConfig() => new()
    {
        AvailableModels = new List<AIModelConfig>
        {
            new() { ModelId = "gpt-4o", DisplayName = "GPT-4o", Provider = "OpenAI", IsEnabled = true, IsDefault = true }
        },
        DefaultModelId = "gpt-4o",
        InitializationRetryCount = 1
    };

    [Fact]
    public async Task HandlePlaylistConfirmAsync_ShouldParseAndStartQuestion_OnSuccess()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();
        var songs = new List<Song> { new() { Title = "晴天", Artist = "周杰倫" } };

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        mockService
            .Setup(x => x.ParsePlaylistBasicInfoAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(songs);

        mockService
            .Setup(x => x.GenerateRandomQuestionAsync(
                It.IsAny<GameState>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .Callback<GameState, string, int, CancellationToken>((state, _, _, _) =>
            {
                state.UsedSongIndices.Add(0);
            })
            .ReturnsAsync(new Question
            {
                LyricsSnippet = "片段",
                CorrectSongTitle = "晴天",
                CorrectArtist = "周杰倫",
                SongIndex = 0
            });

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();

        // Act
        await cut.Instance.HandlePlaylistConfirmAsync("晴天 周杰倫");

        // Assert
        cut.Instance.GameState.IsPlaylistParsed.Should().BeTrue();
        cut.Instance.GameState.CurrentQuestion.Should().NotBeNull();
        cut.Instance.ErrorMessage.Should().BeNull();
        cut.Instance.IsParsing.Should().BeFalse();
    }

    [Fact]
    public async Task HandlePlaylistConfirmAsync_ShouldSetError_OnFailure()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        mockService
            .Setup(x => x.ParsePlaylistBasicInfoAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("boom"));

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();

        // Act
        await cut.Instance.HandlePlaylistConfirmAsync("晴天 周杰倫");

        // Assert
        cut.Instance.ErrorMessage.Should().NotBeNullOrWhiteSpace();
        cut.Instance.IsParsing.Should().BeFalse();
    }

    [Fact]
    public async Task StartNextQuestionAsync_ShouldSetQuestion_WhenLyricsInitialized()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();
        var song = new Song { Title = "晴天", Artist = "周杰倫" };

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        mockService
            .Setup(x => x.GenerateRandomQuestionAsync(
                It.IsAny<GameState>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .Callback<GameState, string, int, CancellationToken>((state, _, _, _) =>
            {
                state.UsedSongIndices.Add(0);
            })
            .ReturnsAsync(new Question
            {
                LyricsSnippet = "片段",
                CorrectSongTitle = "晴天",
                CorrectArtist = "周杰倫",
                SongIndex = 0
            });

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();
        cut.Instance.GameState.Songs = new List<Song> { song };

        // Act
        await cut.Instance.StartNextQuestionAsync();

        // Assert
        cut.Instance.GameState.CurrentQuestion.Should().NotBeNull();
        cut.Instance.GameState.IsGameActive.Should().BeTrue();
        cut.Instance.GameState.UsedSongIndices.Should().Contain(0);
    }

    // T057: 測試答案提交（正確答案）
    [Fact]
    public async Task SubmitAnswerAsync_ShouldAdvanceToNextQuestion_OnCorrectAnswer()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();

        var validationResult = new AnswerValidationResult
        {
            SimilarityType = SimilarityType.Exact,
            Feedback = "答對了！"
        };

        mockService
            .Setup(x => x.ValidateAnswerAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(validationResult);

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        mockService
            .Setup(x => x.GenerateRandomQuestionAsync(
                It.IsAny<GameState>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<CancellationToken>()))
            .Callback<GameState, string, int, CancellationToken>((state, _, _, _) =>
            {
                state.UsedSongIndices.Add(1);
            })
            .ReturnsAsync(new Question
            {
                LyricsSnippet = "片段",
                CorrectSongTitle = "晴天",
                CorrectArtist = "周杰倫",
                SongIndex = 1
            });

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();
        cut.Instance.GameState.Songs = new List<Song>
        {
            new() { Title = "晴天", Artist = "周杰倫" },
            new() { Title = "七里香", Artist = "周杰倫" }
        };
        cut.Instance.GameState.CurrentQuestion = new Question
        {
            LyricsSnippet = "片段",
            CorrectSongTitle = "晴天",
            CorrectArtist = "周杰倫",
            SongIndex = 0
        };
        cut.Instance.GameState.IsGameActive = true;
        cut.Instance.GameState.IsPlaylistParsed = true;

        // Act
        await cut.Instance.SubmitAnswerAsync("晴天");

        // Assert
        cut.Instance.GameState.CurrentQuestion.Should().NotBeNull();
        cut.Instance.GameState.CurrentQuestion.SongIndex.Should().Be(1); // 進入下一題
        cut.Instance.GameState.UsedSongIndices.Should().Contain(0); // 上一題標記為已使用
        cut.Instance.ErrorMessage.Should().BeNull();
    }

    // T058: 測試答案提交（錯誤答案顯示提示）
    [Fact]
    public async Task SubmitAnswerAsync_ShouldDisplayHint_OnWrongAnswer()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();

        var validationResult = new AnswerValidationResult
        {
            SimilarityType = SimilarityType.SimilarButWrong,
            Feedback = "風格很像但不是"
        };

        mockService
            .Setup(x => x.ValidateAnswerAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(validationResult);

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();
        cut.Instance.GameState.Songs = new List<Song> { new() { Title = "晴天", Artist = "周杰倫" } };
        cut.Instance.GameState.CurrentQuestion = new Question
        {
            LyricsSnippet = "片段",
            CorrectSongTitle = "晴天",
            CorrectArtist = "周杰倫",
            SongIndex = 0
        };
        cut.Instance.GameState.IsGameActive = true;

        // Act
        await cut.Instance.SubmitAnswerAsync("七里香");

        // Assert
        cut.Instance.StatusMessage.Should().Be("風格很像但不是");
        cut.Instance.GameState.CurrentQuestion.QuestionState.Should().Be(QuestionState.Unanswered); // 保持在同一題
        cut.Instance.ErrorMessage.Should().BeNull();
    }

    // T059: 測試答案驗證錯誤處理
    [Fact]
    public async Task SubmitAnswerAsync_ShouldDisplayError_OnValidationFailure()
    {
        // Arrange
        var config = CreateConfig();
        var mockService = new Mock<ILyricsGuessGameService>();

        mockService
            .Setup(x => x.ValidateAnswerAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("AI service error"));

        mockService.Setup(x => x.GetAvailableModels()).Returns(config.AvailableModels);
        mockService.Setup(x => x.GetDefaultModelId()).Returns(config.DefaultModelId);

        Services.AddSingleton(config);
        Services.AddSingleton(mockService.Object);

        var cut = Render<LyricsGuessGame>();
        cut.Instance.GameState.Songs = new List<Song> { new() { Title = "晴天", Artist = "周杰倫" } };
        cut.Instance.GameState.CurrentQuestion = new Question
        {
            LyricsSnippet = "片段",
            CorrectSongTitle = "晴天",
            CorrectArtist = "周杰倫",
            SongIndex = 0
        };
        cut.Instance.GameState.IsGameActive = true;

        // Act
        await cut.Instance.SubmitAnswerAsync("七里香");

        // Assert
        cut.Instance.ErrorMessage.Should().NotBeNullOrWhiteSpace();
        cut.Instance.GameState.CurrentQuestion.Should().NotBeNull(); // 保持在同一題允許重試
    }
}
