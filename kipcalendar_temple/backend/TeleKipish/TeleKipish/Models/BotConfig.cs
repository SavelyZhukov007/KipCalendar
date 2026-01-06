using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("BotConfig")]
    public class BotConfig
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string BotToken { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? BotUsername { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastUsed { get; set; }

        public string? WebhookUrl { get; set; }

        public int? OwnerId { get; set; }

        public string? WebhookSecret { get; set; }
    }
}