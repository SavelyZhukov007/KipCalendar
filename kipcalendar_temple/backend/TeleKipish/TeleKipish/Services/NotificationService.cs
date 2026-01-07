using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TeleKipish.Helpers;

namespace TeleKipish.Services
{
    public class NotificationService
    {
        private readonly Logger _logger;
        private readonly ApiClient _apiClient;

        public NotificationService(Logger logger, ApiClient apiClient)
        {
            _logger = logger;
            _apiClient = apiClient;
        }

        public Task EnableForTelegramId(string telegramId)
        {
            _logger.LogInformation($"Enable notifications for TelegramId={telegramId}");
            // In real implementation update DB / call API
            return Task.CompletedTask;
        }

        public Task DisableForTelegramId(string telegramId)
        {
            _logger.LogInformation($"Disable notifications for TelegramId={telegramId}");
            // In real implementation update DB / call API
            return Task.CompletedTask;
        }

        public Task<List<Models.Notification>> GetPendingForUserAsync(int userId)
        {
            // Stub - in real life call backend API via ApiClient
            return Task.FromResult(new List<Models.Notification>());
        }

        public Task<List<(long ChatId, string Text, int NotificationId)>> GetAllPendingForTelegramAsync()
        {
            // Stub: should query backend for pending notifications for all users linked to telegram
            return Task.FromResult(new List<(long, string, int)>());
        }

        public Task MarkNotificationsSentAsync(List<int> notificationIds)
        {
            // Stub: call backend to mark as sent
            _logger.LogInformation($"Marking {notificationIds.Count} notifications as sent");
            return Task.CompletedTask;
        }
    }
}
