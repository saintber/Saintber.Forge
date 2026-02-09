using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

[Table("ToolRegistrations")]
public class ToolRegistration
{
    [Key]
    public Guid ToolId { get; set; }

    [Required]
    [MaxLength(100)]
    public required string ToolName { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required]
    [MaxLength(2000)]
    public required string Url { get; set; }

    [Required]
    public bool IsPublic { get; set; } = true;

    [Required]
    public int DisplayOrder { get; set; } = 0;

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Required]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
