// ============================================================================
// Bot/BotConfig.cs - Конфигурация бота
// ============================================================================
namespace TeleKipish.Bot;

public class BotConfig
{
    public string BotToken { get; set; } = Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN")
        ?? "YOUR_BOT_TOKEN_HERE";

    public string ApiBaseUrl { get; set; } = "http://localhost:5000/api";
    public int NotificationCheckIntervalSeconds { get; set; } = 30;
    public int QRCodeExpirationMinutes { get; set; } = 15;
    public string DatabasePath { get; set; } = "telekipish.db";
}