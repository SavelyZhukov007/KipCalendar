using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("TelegramTokens")]
    public class TelegramToken
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(500)]
        public string Token { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime ExpiresAt { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime? LastUsed { get; set; }

        [MaxLength(50)]
        public string? LastUsedFrom { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}