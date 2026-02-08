using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saintber.Forge.Persistence.EF.Postgres.Entities;

[Table("UserIdentities")]
public class UserIdentity
{
    [Key]
    [MaxLength(450)] // Microsoft Identity Object ID 長度
    public required string UserId { get; set; }

    [MaxLength(200)]
    public string? DisplayName { get; set; }

    [MaxLength(200)]
    public string? Email { get; set; }

    public DateTime? LastLoginAt { get; set; }
}
