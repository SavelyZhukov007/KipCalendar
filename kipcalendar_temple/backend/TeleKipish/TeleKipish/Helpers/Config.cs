using Microsoft.Extensions.Configuration;

namespace TeleKipish.Helpers
{
    public class Config
    {
        private readonly IConfiguration _configuration;

        public Config(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string TelegramBotToken => _configuration["TelegramBot:Token"] ?? throw new InvalidOperationException("Telegram bot token not configured");
        public string BotUsername => _configuration["TelegramBot:BotUsername"] ?? "KipCalendarBot";
        public string WebhookUrl => _configuration["TelegramBot:WebhookUrl"] ?? "";
        public long OwnerId => long.Parse(_configuration["TelegramBot:OwnerId"] ?? "0");

        public string ApiBaseUrl => _configuration["Api:BaseUrl"] ?? "https://api.kipcalendar.com";
        public string ApiKey => _configuration["Api:ApiKey"] ?? "";
        public int ApiTimeoutSeconds => int.Parse(_configuration["Api:TimeoutSeconds"] ?? "30");

        public string DatabaseConnectionString => _configuration["Database:ConnectionString"] ?? "Data Source=kipcalendar_telegram.db";

        public bool EnableNotifications => bool.Parse(_configuration["Features:EnableNotifications"] ?? "true");
        public bool EnableQRCode => bool.Parse(_configuration["Features:EnableQRCode"] ?? "true");
        public int CacheDurationMinutes => int.Parse(_configuration["Features:CacheDurationMinutes"] ?? "60");
        public int LinkCodeExpiryMinutes => int.Parse(_configuration["Features:LinkCodeExpiryMinutes"] ?? "10");
        public int QRTokenExpiryMinutes => int.Parse(_configuration["Features:QRTokenExpiryMinutes"] ?? "15");
        public int NotificationPollingIntervalSeconds => int.Parse(_configuration["Features:NotificationPollingIntervalSeconds"] ?? "30");

        public string DefaultLanguage => _configuration["Localization:DefaultLanguage"] ?? "ru";
        public string[] SupportedLanguages => _configuration.GetSection("Localization:SupportedLanguages").Get<string[]>() ?? ["ru", "en"];
    }
}