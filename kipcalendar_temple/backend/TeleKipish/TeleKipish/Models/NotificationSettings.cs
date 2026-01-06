using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("NotificationSettings")]
    public class NotificationSettings
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [MaxLength(50)]
        public string? TelegramId { get; set; }

        [MaxLength(500)]
        public string? BotToken { get; set; }

        public string SettingsJson { get; set; } = "{}";

        public string NotificationTypesJson { get; set; } = "[\"grade\",\"homework\",\"event\",\"message\",\"announcement\"]";

        public bool IsActive { get; set; } = true;

        public DateTime LastActive { get; set; } = DateTime.UtcNow;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public TimeSpan? QuietModeStart { get; set; }

        public TimeSpan? QuietModeEnd { get; set; }

        [MaxLength(10)]
        public string Language { get; set; } = "ru";

        [MaxLength(20)]
        public string Format { get; set; } = "detailed"; // detailed, brief

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}