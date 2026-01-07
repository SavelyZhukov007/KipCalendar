// ============================================================================
// Services/AttendanceService.cs - Сервис работы с посещаемостью
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;

namespace TeleKipish.Services;

public class AttendanceService
{
    private readonly ApiService _apiService;
    private readonly ILogger<AttendanceService> _logger;

    public AttendanceService(ApiService apiService, ILogger<AttendanceService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<AttendanceStats?> GetAttendanceStatsAsync(long telegramId)
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

            var fromDate = DateTime.Now.AddMonths(-3).ToString("yyyy-MM-dd");

            var response = await _apiService.GetAsync<AttendanceStatsResponse>(
                $"/telegram/user/{linkInfo.UserId}/attendance?from_date={fromDate}",
                telegramId
            );

            return response?.Statistics;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting attendance stats");
            return null;
        }
    }

    public async Task<bool> MarkAttendanceAsync(long telegramId, string actualLessonId, List<AttendanceEntry> entries)
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
                "/telegram/teacher/mark-attendance",
                new
                {
                    teacher_id = linkInfo.UserId,
                    actual_lesson_id = actualLessonId,
                    attendance = entries
                },
                telegramId
            );

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking attendance");
            return false;
        }
    }
}