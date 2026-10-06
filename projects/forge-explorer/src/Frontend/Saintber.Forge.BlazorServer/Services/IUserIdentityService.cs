namespace Saintber.Forge.BlazorServer.Services;

public interface IUserIdentityService
{
    Task UpdateLastLoginAsync(string userId, string? displayName, string? email);
}
