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
        song.Lyrics.Should().BeNull();
        song.InitializationFailed.Should().BeFalse();
        song.IsInitialized.Should().BeFalse();
    }

    [Fact]
    public void Song_IsInitialized_ShouldBeTrue_WhenLyricsAreSet()
    {
        // Arrange
        var song = new Song
        {
            Title = "晴天",
            Artist = "周杰倫",
            Lyrics = "故事的小黃花\n從出生那年就飄著..."
        };

        // Assert
        song.IsInitialized.Should().BeTrue();
    }

    [Fact]
    public void Song_InitializationFailed_ShouldNotAffect_IsInitialized_WhenLyricsNull()
    {
        // Arrange
        var song = new Song
        {
            Title = "晴天",
            Artist = "周杰倫",
            InitializationFailed = true
        };

        // Assert
        song.IsInitialized.Should().BeFalse();
        song.InitializationFailed.Should().BeTrue();
        song.Lyrics.Should().BeNull();
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
