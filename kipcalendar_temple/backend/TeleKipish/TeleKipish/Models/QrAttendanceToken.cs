using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("QrAttendanceTokens")]
    public class QrAttendanceToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LessonId { get; set; }

        [Required]
        public int TeacherId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Token { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public bool Used { get; set; } = false;

        public DateTime? UsedAt { get; set; }

        [MaxLength(50)]
        public string? UsedBy { get; set; }

        [ForeignKey("TeacherId")]
        public virtual User? Teacher { get; set; }
    }
}