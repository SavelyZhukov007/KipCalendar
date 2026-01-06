using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("Notifications")]
    public class Notification
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = string.Empty; // grade, homework, event, message, announcement

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? ScheduledFor { get; set; }

        public DateTime? SentAt { get; set; }

        public bool SentToTelegram { get; set; } = false;

        public bool IsRead { get; set; } = false;

        public string? LinkUrl { get; set; }

        public string? MetadataJson { get; set; } // Additional data in JSON format

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}