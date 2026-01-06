using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("Users")]
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string? TelegramId { get; set; }

        public int? KipCalendarUserId { get; set; }

        [MaxLength(100)]
        public string? Username { get; set; }

        [MaxLength(100)]
        public string? FirstName { get; set; }

        [MaxLength(100)]
        public string? LastName { get; set; }

        [MaxLength(50)]
        public string Role { get; set; } = "student"; // student, teacher, admin

        [MaxLength(50)]
        public string? Language { get; set; } = "ru";

        public bool IsActive { get; set; } = true;

        public DateTime LinkedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastActivity { get; set; }

        public string? CurrentGroup { get; set; }

        public string? CurrentSubject { get; set; }

        // Navigation properties
        public virtual TelegramLink? TelegramLink { get; set; }
        public virtual NotificationSettings? NotificationSettings { get; set; }
        public virtual TelegramToken? TelegramToken { get; set; }
        public virtual List<Notification>? Notifications { get; set; }
    }
}