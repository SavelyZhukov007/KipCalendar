// ============================================================================
// Services/UserService.cs - Сервис работы с пользователями
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;

namespace TeleKipish.Services;

public class UserService
{
    private readonly ApiService _apiService;
    private readonly ILogger<UserService> _logger;

    public UserService(ApiService apiService, ILogger<UserService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<UserProfile?> GetUserProfileAsync(long telegramId)
    {
        try
        {
            // Сначала получаем user_id по telegram_id
            var linkInfo = await _apiService.GetAsync<LinkInfoResponse>(
                $"/telegram/link/info?telegram_id={telegramId}"
            );

            if (linkInfo?.UserId == null)
            {
                return null;
            }

            // Получаем профиль пользователя
            var profile = await _apiService.GetAsync<UserProfile>(
                $"/telegram/user/{linkInfo.UserId}/profile",
                telegramId
            );

            return profile;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting user profile");
            return null;
        }
    }

    public async Task<List<TeacherGroup>?> GetTeacherGroupsAsync(long telegramId)
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

            var response = await _apiService.GetAsync<TeacherGroupsResponse>(
                $"/telegram/teacher/groups?teacher_id={linkInfo.UserId}",
                telegramId
            );

            return response?.Groups;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting teacher groups");
            return null;
        }
    }

    public async Task<QuickStats?> GetQuickStatsAsync(long telegramId)
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

            var stats = await _apiService.GetAsync<QuickStats>(
                $"/telegram/user/{linkInfo.UserId}/quick-stats",
                telegramId
            );

            return stats;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting quick stats");
            return null;
        }
    }
}