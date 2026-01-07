// ============================================================================
// Services/GradeService.cs - Сервис работы с оценками
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;

namespace TeleKipish.Services;

public class GradeService
{
    private readonly ApiService _apiService;
    private readonly ILogger<GradeService> _logger;

    public GradeService(ApiService apiService, ILogger<GradeService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<GradesResponse?> GetGradesAsync(long telegramId, string? subjectId = null, int limit = 10)
    {
        try
        {
            var linkInfo = await _apiService.GetAsync<LinkInfoResponse>(
                $"/telegram/link/info?telegram_id={telegramId}"
            );

            if (linkInfo?.UserId == null)
            {
                return null;
            }

            var url = $"/telegram/user/{linkInfo.UserId}/grades?limit={limit}";
            if (!string.IsNullOrEmpty(subjectId))
            {
                url += $"&subject_id={subjectId}";
            }

            var response = await _apiService.GetAsync<GradesResponse>(url, telegramId);
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting grades");
            return null;
        }
    }

    public async Task<bool> AddGradeAsync(long telegramId, string studentId, string actualLessonId, string value, string? comment = null)
    {
        try
        {
            var linkInfo = await _apiService.GetAsync<LinkInfoResponse>(
                $"/telegram/link/info?telegram_id={telegramId}"
            );

            if (linkInfo?.UserId == null)
            {
                return false;
            }

            var result = await _apiService.PostAsync(
                "/telegram/teacher/add-grade",
                new
                {
                    teacher_id = linkInfo.UserId,
                    student_id = studentId,
                    actual_lesson_id = actualLessonId,
                    value = value,
                    comment = comment
                },
                telegramId
            );

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding grade");
            return false;
        }
    }
}