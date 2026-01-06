using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace TeleKipish.Models
{
    [Table("Grades")]
    public class Grade
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Subject { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string GradeValue { get; set; } = string.Empty; // Could be numeric or letter grade

        public DateTime Date { get; set; }

        public string? Topic { get; set; }

        public string? TeacherComment { get; set; }

        [MaxLength(50)]
        public string? GradeType { get; set; } // exam, test, homework, quiz

        public int? MaxScore { get; set; }

        public int? Weight { get; set; } // Weight for average calculation

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }
    }
}