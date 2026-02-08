using Microsoft.EntityFrameworkCore;
using Saintber.Forge.Persistence.EF.Postgres.Entities;

namespace Saintber.Forge.Persistence.EF.Postgres;

public class PortalDbContext : DbContext
{
    public PortalDbContext(DbContextOptions<PortalDbContext> options)
        : base(options)
    {
    }

    public DbSet<ToolRegistration> ToolRegistrations => Set<ToolRegistration>();
    public DbSet<UserIdentity> UserIdentities => Set<UserIdentity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ToolRegistration Indexes
        modelBuilder.Entity<ToolRegistration>()
            .HasIndex(t => t.DisplayOrder)
            .HasDatabaseName("IX_ToolRegistrations_DisplayOrder");

        modelBuilder.Entity<ToolRegistration>()
            .HasIndex(t => t.IsPublic)
            .HasDatabaseName("IX_ToolRegistrations_IsPublic");

        // UserIdentity Indexes
        modelBuilder.Entity<UserIdentity>()
            .HasIndex(u => u.Email)
            .HasDatabaseName("IX_UserIdentities_Email");

        // Seed Data - 2 sample ToolRegistrations
        modelBuilder.Entity<ToolRegistration>().HasData(
            new ToolRegistration
            {
                ToolId = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                ToolName = "範例工具 A",
                Description = "這是一個公開的範例工具",
                Url = "/tools/example-a",
                IsPublic = true,
                DisplayOrder = 1,
                CreatedAt = new DateTime(2026, 2, 8, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 2, 8, 0, 0, 0, DateTimeKind.Utc)
            },
            new ToolRegistration
            {
                ToolId = Guid.Parse("10000000-0000-0000-0000-000000000002"),
                ToolName = "範例工具 B（需登入）",
                Description = "這是一個需要登入的範例工具",
                Url = "/tools/example-b",
                IsPublic = false,
                DisplayOrder = 2,
                CreatedAt = new DateTime(2026, 2, 8, 0, 0, 0, DateTimeKind.Utc),
                UpdatedAt = new DateTime(2026, 2, 8, 0, 0, 0, DateTimeKind.Utc)
            }
        );
    }
}
