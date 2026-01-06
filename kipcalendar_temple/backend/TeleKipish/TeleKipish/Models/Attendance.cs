using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("Attendance")]
    public class Attendance
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Subject { get; set; } = string.Empty;

        public DateTime Date { get; set; }

        [MaxLength(20)]
        public string Status { get; set; } = "present"; // present, absent, late, excused

        public TimeSpan? ArrivalTime { get; set; }

        public TimeSpan? DepartureTime { get; set; }

        public string? Notes { get; set; }

        public bool IsQRScanned { get; set; } = false;

        public string? QRToken { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}