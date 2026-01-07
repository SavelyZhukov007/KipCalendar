// ============================================================================
// Services/EventService.cs - Сервис работы с событиями и расписанием
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;

namespace TeleKipish.Services;

public class EventService
{
    private readonly ApiService _apiService;
    private readonly ILogger<EventService> _logger;

    public EventService(ApiService apiService, ILogger<EventService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<List<ScheduleLesson>?> GetScheduleAsync(long telegramId, string period = "today")
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

            var date = period switch
            {
                "today" => DateTime.Now.ToString("yyyy-MM-dd"),
                "tomorrow" => DateTime.Now.AddDays(1).ToString("yyyy-MM-dd"),
                _ => DateTime.Now.ToString("yyyy-MM-dd")
            };

            var response = await _apiService.GetAsync<ScheduleResponse>(
                $"/telegram/user/{linkInfo.UserId}/schedule?date={date}&period={period}",
                telegramId
            );

            return response?.Schedule;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting schedule");
            return null;
        }
    }

    public async Task<List<HomeworkItem>?> GetHomeworkAsync(long telegramId, string status = "active")
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

            var fromDate = DateTime.Now.ToString("yyyy-MM-dd");

            var response = await _apiService.GetAsync<HomeworkResponse>(
                $"/telegram/user/{linkInfo.UserId}/homework?status={status}&from_date={fromDate}",
                telegramId
            );

            return response?.Homework;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting homework");
            return null;
        }
    }

    public async Task<List<CalendarEvent>?> GetCalendarEventsAsync(long telegramId)
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

            var startDate = DateTime.Now.ToString("yyyy-MM-dd");
            var endDate = DateTime.Now.AddDays(30).ToString("yyyy-MM-dd");

            var response = await _apiService.GetAsync<CalendarResponse>(
                $"/api/calendar/user/{linkInfo.UserId}?start_date={startDate}&end_date={endDate}",
                telegramId
            );

            return response?.Events;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting calendar events");
            return null;
        }
    }
}