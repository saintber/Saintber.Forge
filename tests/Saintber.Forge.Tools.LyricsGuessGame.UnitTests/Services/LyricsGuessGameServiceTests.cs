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
        FetchLyricsTimeoutSeconds = 5,
        ValidateAnswerTimeoutSeconds = 5,
        MinSnippetLength = 10,
        MaxSnippetLength = 50
    };

    [Fact]
    public async Task ParsePlaylistBasicInfoAsync_ShouldReturnSongs_WithResetLyrics()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var config = CreateConfig();
        var expected = new List<Song>
        {
            new() { Title = "晴天", Artist = "周杰倫", Lyrics = "should be cleared", InitializationFailed = true }
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
        result[0].Lyrics.Should().BeNull();
        result[0].InitializationFailed.Should().BeFalse();
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
    public async Task InitializeSongLyricsAsync_ShouldSetLyrics_WhenValid()
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
                config.FetchLyricsTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new string('a', 60));

        // Act
        await service.InitializeSongLyricsAsync(song, "gpt-4o");

        // Assert
        song.Lyrics.Should().NotBeNull();
        song.InitializationFailed.Should().BeFalse();
    }

    [Fact]
    public async Task InitializeSongLyricsAsync_ShouldMarkFailed_WhenNotFound()
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
                config.FetchLyricsTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync("LYRICS_NOT_FOUND");

        // Act
        await service.InitializeSongLyricsAsync(song, "gpt-4o");

        // Assert
        song.InitializationFailed.Should().BeTrue();
        song.Lyrics.Should().BeNull();
    }

    [Fact]
    public async Task InitializeSongLyricsAsync_ShouldThrowAndMarkFailed_OnAIError()
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
                config.FetchLyricsTimeoutSeconds,
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new AIServiceException("boom"));

        // Act
        var act = async () => await service.InitializeSongLyricsAsync(song, "gpt-4o");

        // Assert
        await act.Should().ThrowAsync<AIServiceException>();
        song.InitializationFailed.Should().BeTrue();
    }

    [Fact]
    public void GenerateQuestion_ShouldThrow_WhenLyricsNotInitialized()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var service = new LyricsGuessGameService(aiService.Object, CreateConfig());
        var song = new Song { Title = "晴天", Artist = "周杰倫" };

        // Act
        var act = () => service.GenerateQuestion(song, 0);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void GenerateQuestion_ShouldReturnQuestion_WithSnippet()
    {
        // Arrange
        var aiService = new Mock<IAIServiceProvider>();
        var service = new LyricsGuessGameService(aiService.Object, CreateConfig());
        var song = new Song
        {
            Title = "晴天",
            Artist = "周杰倫",
            Lyrics = "第一行歌詞\n第二行歌詞\n第三行歌詞\n第四行歌詞"
        };

        // Act
        var question = service.GenerateQuestion(song, 2);

        // Assert
        question.LyricsSnippet.Should().NotBeNullOrWhiteSpace();
        question.CorrectSongTitle.Should().Be("晴天");
        question.CorrectArtist.Should().Be("周杰倫");
        question.SongIndex.Should().Be(2);
        question.QuestionState.Should().Be(QuestionState.Unanswered);
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
            .Setup(x => x.ValidateAnswerAsync(
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
