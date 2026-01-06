using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("CommandStatistics")]
    public class CommandStatistic
    {
        [Key]
        public int Id { get; set; }

        public int? UserId { get; set; }

        public string? TelegramId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Command { get; set; } = string.Empty;

        public long ExecutionTime { get; set; } // in milliseconds

        public DateTime Timestamp { get; set; } = DateTime.UtcNow;

        public bool Success { get; set; } = true;

        public string? ErrorMessage { get; set; }

        public string? Parameters { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}