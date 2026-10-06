using Saintber.Forge.Persistence.EF.Postgres.Entities;

namespace Saintber.Forge.BlazorServer.Services;

public interface IToolRegistrationService
{
    Task<List<ToolRegistration>> GetAllToolsAsync();
    Task<List<ToolRegistration>> GetPublicToolsAsync();
}
