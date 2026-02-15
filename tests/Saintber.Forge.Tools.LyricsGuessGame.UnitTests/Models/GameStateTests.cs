using FluentAssertions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Xunit;

namespace Saintber.Forge.Tools.LyricsGuessGame.UnitTests.Models;

/// <summary>
/// TDD Tests for GameState model (T014 - MUST FAIL initially)
/// </summary>
public class GameStateTests
{
    [Fact]
    public void GameState_ShouldInitialize_WithDefaultValues()
    {
        // Arrange & Act
        var gameState = new GameState();

        // Assert
        gameState.Songs.Should().NotBeNull().And.BeEmpty();
        gameState.CurrentQuestion.Should().BeNull();
        gameState.UsedSongIndices.Should().NotBeNull().And.BeEmpty();
        gameState.IsPlaylistParsed.Should().BeFalse();
        gameState.IsGameActive.Should().BeFalse();
        gameState.SelectedModelId.Should().NotBeNull();
    }

    [Fact]
    public void GameState_ShouldTransition_ToPlaylistParsed()
    {
        // Arrange
        var gameState = new GameState();
        var songs = new List<Song>
        {
            new Song { Title = "晴天", Artist = "周杰倫" },
            new Song { Title = "七里香", Artist = "周杰倫" }
        };

        // Act
        gameState.Songs = songs;
        gameState.IsPlaylistParsed = true;

        // Assert
        gameState.Songs.Should().HaveCount(2);
        gameState.IsPlaylistParsed.Should().BeTrue();
    }

    [Fact]
    public void GameState_ShouldTransition_ToGameActive_WithQuestion()
    {
        // Arrange
        var gameState = new GameState
        {
            Songs = new List<Song>
            {
                new Song { Title = "晴天", Artist = "周杰倫" }
            },
            IsPlaylistParsed = true
        };

        var question = new Question
        {
            LyricsSnippet = "故事的小黃花",
            CorrectSongTitle = "晴天",
            CorrectArtist = "周杰倫",
            SongIndex = 0
        };

        // Act
        gameState.CurrentQuestion = question;
        gameState.UsedSongIndices.Add(0);
        gameState.IsGameActive = true;

        // Assert
        gameState.IsGameActive.Should().BeTrue();
        gameState.CurrentQuestion.Should().NotBeNull();
        gameState.UsedSongIndices.Should().Contain(0);
    }

    [Fact]
    public void GameState_ShouldAllowModelSwitch()
    {
        // Arrange
        var gameState = new GameState
        {
            SelectedModelId = "gpt-4-turbo"
        };

        // Act
        gameState.SelectedModelId = "claude-3-sonnet";

        // Assert
        gameState.SelectedModelId.Should().Be("claude-3-sonnet");
    }
}
