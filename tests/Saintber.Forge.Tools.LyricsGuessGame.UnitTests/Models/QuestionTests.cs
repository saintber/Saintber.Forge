using FluentAssertions;
using Saintber.Forge.Tools.LyricsGuessGame.Abstractions.Models;
using Xunit;

namespace Saintber.Forge.Tools.LyricsGuessGame.UnitTests.Models;

/// <summary>
/// TDD Tests for Question model (T012 - MUST FAIL initially)
/// </summary>
public class QuestionTests
{
    [Fact]
    public void Question_ShouldInitialize_WithRequiredFields()
    {
        // Arrange & Act
        var question = new Question
        {
            LyricsSnippet = "故事的小黃花\n從出生那年就飄著",
            CorrectSongTitle = "晴天",
            CorrectArtist = "周杰倫",
            SongIndex = 3,
            QuestionState = QuestionState.Unanswered
        };

        // Assert
        question.LyricsSnippet.Should().Be("故事的小黃花\n從出生那年就飄著");
        question.CorrectSongTitle.Should().Be("晴天");
        question.CorrectArtist.Should().Be("周杰倫");
        question.SongIndex.Should().Be(3);
        question.QuestionState.Should().Be(QuestionState.Unanswered);
    }

    [Fact]
    public void QuestionState_ShouldTransition_FromUnanswered_ToAnsweredCorrectly()
    {
        // Arrange
        var question = new Question
        {
            LyricsSnippet = "Sample lyrics",
            CorrectSongTitle = "Title",
            CorrectArtist = "Artist",
            SongIndex = 0,
            QuestionState = QuestionState.Unanswered
        };

        // Act
        question.QuestionState = QuestionState.AnsweredCorrectly;

        // Assert
        question.QuestionState.Should().Be(QuestionState.AnsweredCorrectly);
    }

    [Fact]
    public void QuestionState_ShouldTransition_FromUnanswered_ToRevealedAnswer()
    {
        // Arrange
        var question = new Question
        {
            LyricsSnippet = "Sample lyrics",
            CorrectSongTitle = "Title",
            CorrectArtist = "Artist",
            SongIndex = 0,
            QuestionState = QuestionState.Unanswered
        };

        // Act
        question.QuestionState = QuestionState.RevealedAnswer;

        // Assert
        question.QuestionState.Should().Be(QuestionState.RevealedAnswer);
    }

    [Theory]
    [InlineData("故事的小黃花")]
    [InlineData("從出生那年就飄著\n童年的盪鞦韆")]
    [InlineData("隨記憶一直晃到現在")]
    public void Question_LyricsSnippet_ShouldAccept_VariousLengths(string snippet)
    {
        // Arrange & Act
        var question = new Question
        {
            LyricsSnippet = snippet,
            CorrectSongTitle = "Title",
            CorrectArtist = "Artist",
            SongIndex = 0
        };

        // Assert
        question.LyricsSnippet.Should().Be(snippet);
    }
}
