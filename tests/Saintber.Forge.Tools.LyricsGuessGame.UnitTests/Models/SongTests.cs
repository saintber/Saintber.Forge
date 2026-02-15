using FluentAssertions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Xunit;

namespace Saintber.Forge.Tools.LyricsGuessGame.UnitTests.Models;

/// <summary>
/// TDD Tests for Song model validation (T010 - MUST FAIL initially)
/// </summary>
public class SongTests
{
    [Fact]
    public void Song_ShouldInitialize_WithTitleAndArtist()
    {
        // Arrange & Act
        var song = new Song
        {
            Title = "晴天",
            Artist = "周杰倫"
        };

        // Assert
        song.Title.Should().Be("晴天");
        song.Artist.Should().Be("周杰倫");
        song.CanGenerateQuestion.Should().BeTrue();
    }

    [Fact]
    public void Song_ShouldAllow_DisablingQuestionGeneration()
    {
        // Arrange
        var song = new Song
        {
            Title = "晴天",
            Artist = "周杰倫",
            CanGenerateQuestion = false
        };

        // Assert
        song.CanGenerateQuestion.Should().BeFalse();
    }

    [Fact]
    public void Song_ShouldAllowEmpty_TitleOrArtist()
    {
        // Arrange & Act
        var song1 = new Song { Title = "", Artist = "周杰倫" };
        var song2 = new Song { Title = "晴天", Artist = "" };

        // Assert - Data model validation notes that Title and Artist should not BOTH be empty
        // But individually they can be (AI might return partial data)
        song1.Title.Should().BeEmpty();
        song2.Artist.Should().BeEmpty();
    }
}
