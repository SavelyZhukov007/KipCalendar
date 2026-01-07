// ============================================================================
// Bot/BotHostedService.cs - Хостинг сервис для бота
// ============================================================================
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TeleKipish.Services;

namespace TeleKipish.Bot;

public class BotHostedService : BackgroundService
{
    private readonly BotClient _botClient;
    private readonly NotificationService _notificationService;
    private readonly BotConfig _config;
    private readonly ILogger<BotHostedService> _logger;

    public BotHostedService(
        BotClient botClient,
        NotificationService notificationService,
        BotConfig config,
        ILogger<BotHostedService> logger)
    {
        _botClient = botClient;
        _notificationService = notificationService;
        _config = config;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _botClient.StartAsync(stoppingToken);

        // Запускаем проверку уведомлений
        _ = Task.Run(async () => await CheckNotificationsLoop(stoppingToken), stoppingToken);

        await Task.Delay(Timeout.Infinite, stoppingToken);
    }

    private async Task CheckNotificationsLoop(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                await _notificationService.ProcessPendingNotificationsAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing notifications");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.NotificationCheckIntervalSeconds), cancellationToken);
        }
    }
}