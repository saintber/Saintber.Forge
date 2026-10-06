using Microsoft.EntityFrameworkCore;
using Saintber.Forge.Persistence.EF.Postgres;
using Saintber.Forge.Persistence.EF.Postgres.Entities;

namespace Saintber.Forge.BlazorServer.Services;

public class ToolRegistrationService : IToolRegistrationService
{
    private readonly PortalDbContext _dbContext;
    private readonly ILogger<ToolRegistrationService> _logger;

    public ToolRegistrationService(PortalDbContext dbContext, ILogger<ToolRegistrationService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<List<ToolRegistration>> GetAllToolsAsync()
    {
        try
        {
            _logger.LogDebug("Querying all tools");
            var tools = await _dbContext.ToolRegistrations
                .AsNoTracking()
                .OrderBy(t => t.DisplayOrder)
                .ThenBy(t => t.ToolName)
                .ToListAsync();
            _logger.LogInformation("Retrieved {Count} tools", tools.Count);
            return tools;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving all tools");
            throw;
        }
    }

    public async Task<List<ToolRegistration>> GetPublicToolsAsync()
    {
        try
        {
            _logger.LogDebug("Querying public tools");
            var tools = await _dbContext.ToolRegistrations
                .AsNoTracking()
                .Where(t => t.IsPublic)
                .OrderBy(t => t.DisplayOrder)
                .ThenBy(t => t.ToolName)
                .ToListAsync();
            _logger.LogInformation("Retrieved {Count} public tools", tools.Count);
            return tools;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving public tools");
            throw;
        }
    }
}
