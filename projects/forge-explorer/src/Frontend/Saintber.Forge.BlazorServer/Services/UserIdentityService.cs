using Microsoft.EntityFrameworkCore;
using Saintber.Forge.Persistence.EF.Postgres;
using Saintber.Forge.Persistence.EF.Postgres.Entities;

namespace Saintber.Forge.BlazorServer.Services;

public class UserIdentityService : IUserIdentityService
{
    private readonly PortalDbContext _dbContext;
    private readonly ILogger<UserIdentityService> _logger;

    public UserIdentityService(PortalDbContext dbContext, ILogger<UserIdentityService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task UpdateLastLoginAsync(string userId, string? displayName, string? email)
    {
        try
        {
            _logger.LogDebug("Updating last login for user {UserId}", userId);
            
            var user = await _dbContext.UserIdentities
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
            {
                // 首次登入，建立紀錄
                user = new UserIdentity
                {
                    UserId = userId,
                    DisplayName = displayName,
                    Email = email,
                    LastLoginAt = DateTime.UtcNow
                };
                _dbContext.UserIdentities.Add(user);
                _logger.LogInformation("Created new user identity for {UserId}", userId);
            }
            else
            {
                // 更新最後登入時間
                user.LastLoginAt = DateTime.UtcNow;
                user.DisplayName = displayName; // 更新可能變動的資訊
                user.Email = email;
                _logger.LogInformation("Updated last login for user {UserId}", userId);
            }

            await _dbContext.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating last login for user {UserId}", userId);
            throw;
        }
    }
}
