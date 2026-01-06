using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("TelegramLinks")]
    public class TelegramLink
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(6)]
        public string LinkCode { get; set; } = string.Empty;

        [Required]
        public int KipCalendarUserId { get; set; }

        public string? TelegramId { get; set; }

        public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public bool IsUsed { get; set; } = false;

        public DateTime? UsedAt { get; set; }

        [ForeignKey("User")]
        public int? UserId { get; set; }

        public virtual User? User { get; set; }
    }
}