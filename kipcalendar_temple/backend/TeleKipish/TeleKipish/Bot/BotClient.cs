using System.Threading.Tasks;
using TeleKipish.Helpers;
using TeleKipish.Services;

namespace TeleKipish.Bot
{
    public class BotClient
    {
        private readonly Helpers.Config _config;
        private readonly Logger _logger;
        private readonly AuthService _authService;

        public BotClient(Helpers.Config config, Logger logger, AuthService authService)
        {
            _config = config;
            _logger = logger;
            _authService = authService;
        }

        public Task StartAsync()
        {
            _logger.LogInformation("Starting Telegram bot (stub)");
            return Task.CompletedTask;
        }

        public Task StopAsync()
        {
            _logger.LogInformation("Stopping Telegram bot (stub)");
            return Task.CompletedTask;
        }

        public Task SendMessageAsync(long chatId, string text, object? parseMode = null,
            bool disableWebPagePreview = true, int? replyToMessageId = null, object? replyMarkup = null)
        {
            _logger.LogInformation($"[BotStub] SendMessage to {chatId}: {text}");
            return Task.CompletedTask;
        }

        public Task SendPhotoAsync(long chatId, byte[] photo, string caption = "",
            object? parseMode = null, int? replyToMessageId = null)
        {
            _logger.LogInformation($"[BotStub] SendPhoto to {chatId}: caption={caption}");
            return Task.CompletedTask;
        }

        public Task AnswerCallbackQueryAsync(string callbackQueryId, string? text = null,
            bool showAlert = false, string? url = null, int cacheTime = 0)
        {
            _logger.LogInformation($"[BotStub] AnswerCallbackQuery {callbackQueryId}: {text}");
            return Task.CompletedTask;
        }
    }
}