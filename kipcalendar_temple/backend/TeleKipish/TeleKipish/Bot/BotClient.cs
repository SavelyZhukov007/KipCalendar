using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Microsoft.Extensions.Configuration;
using TeleKipish.Helpers;
using TeleKipish.Services;

namespace TeleKipish.Bot
{
    public class BotClient
    {
        private readonly TelegramBotClient _botClient;
        private readonly Config _config;
        private readonly Logger _logger;
        private readonly CommandHandler _commandHandler;
        private readonly AuthService _authService;
        private CancellationTokenSource _cts;

        public BotClient(Config config, Logger logger, CommandHandler commandHandler, AuthService authService)
        {
            _config = config;
            _logger = logger;
            _commandHandler = commandHandler;
            _authService = authService;

            _botClient = new TelegramBotClient(_config.TelegramBotToken);
            _cts = new CancellationTokenSource();
        }

        public async Task StartAsync()
        {
            try
            {
                _logger.LogInformation("Starting Telegram bot...");

                var receiverOptions = new ReceiverOptions
                {
                    AllowedUpdates = Array.Empty<UpdateType>(),
                    DropPendingUpdates = true
                };

                // Start receiving updates
                _botClient.StartReceiving(
                    updateHandler: HandleUpdateAsync,
                    pollingErrorHandler: HandlePollingErrorAsync,
                    receiverOptions: receiverOptions,
                    cancellationToken: _cts.Token
                );

                // Get bot info
                var me = await _botClient.GetMeAsync(_cts.Token);
                _logger.LogInformation($"Bot started successfully: @{me.Username} (ID: {me.Id})");

                // Set webhook if configured
                if (!string.IsNullOrEmpty(_config.WebhookUrl))
                {
                    await SetWebhookAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start bot");
                throw;
            }
        }

        public async Task StopAsync()
        {
            _logger.LogInformation("Stopping Telegram bot...");
            _cts.Cancel();

            if (!string.IsNullOrEmpty(_config.WebhookUrl))
            {
                await DeleteWebhookAsync();
            }

            await Task.CompletedTask;
        }

        private async Task HandleUpdateAsync(ITelegramBotClient botClient, Update update, CancellationToken cancellationToken)
        {
            try
            {
                var handler = update.Type switch
                {
                    UpdateType.Message => HandleMessageAsync(update.Message),
                    UpdateType.CallbackQuery => HandleCallbackQueryAsync(update.CallbackQuery),
                    UpdateType.InlineQuery => HandleInlineQueryAsync(update.InlineQuery),
                    UpdateType.ChosenInlineResult => HandleChosenInlineResultAsync(update.ChosenInlineResult),
                    _ => HandleUnknownUpdateAsync(update)
                };

                await handler;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling update");
            }
        }

        private async Task HandleMessageAsync(Message? message)
        {
            if (message is null || string.IsNullOrEmpty(message.Text))
                return;

            try
            {
                _logger.LogInformation($"Received message from {message.From?.Id}: {message.Text}");

                // Update user activity
                if (message.From != null)
                {
                    var telegramId = message.From.Id.ToString();
                    await _authService.UpdateUserActivity(telegramId);
                }

                // Handle command
                await _commandHandler.HandleCommand(message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling message");

                // Send error message to user
                try
                {
                    await _botClient.SendTextMessageAsync(
                        chatId: message.Chat.Id,
                        text: "❌ Произошла ошибка при обработке команды. Пожалуйста, попробуйте позже.",
                        cancellationToken: _cts.Token
                    );
                }
                catch (Exception sendEx)
                {
                    _logger.LogError(sendEx, "Error sending error message to user");
                }
            }
        }

        private async Task HandleCallbackQueryAsync(CallbackQuery? callbackQuery)
        {
            if (callbackQuery is null || string.IsNullOrEmpty(callbackQuery.Data))
                return;

            try
            {
                _logger.LogInformation($"Received callback query from {callbackQuery.From.Id}: {callbackQuery.Data}");

                // Update user activity
                var telegramId = callbackQuery.From.Id.ToString();
                await _authService.UpdateUserActivity(telegramId);

                // Handle callback query
                await _commandHandler.HandleCallbackQuery(callbackQuery);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error handling callback query");

                // Answer callback query with error
                try
                {
                    await _botClient.AnswerCallbackQueryAsync(
                        callbackQueryId: callbackQuery.Id,
                        text: "Произошла ошибка",
                        cancellationToken: _cts.Token
                    );
                }
                catch (Exception answerEx)
                {
                    _logger.LogError(answerEx, "Error answering callback query");
                }
            }
        }

        private async Task HandleInlineQueryAsync(InlineQuery? inlineQuery)
        {
            if (inlineQuery is null)
                return;

            // Handle inline query if needed
            await Task.CompletedTask;
        }

        private async Task HandleChosenInlineResultAsync(ChosenInlineResult? chosenInlineResult)
        {
            if (chosenInlineResult is null)
                return;

            // Handle chosen inline result if needed
            await Task.CompletedTask;
        }

        private async Task HandleUnknownUpdateAsync(Update update)
        {
            _logger.LogWarning($"Received unknown update type: {update.Type}");
            await Task.CompletedTask;
        }

        private Task HandlePollingErrorAsync(ITelegramBotClient botClient, Exception exception, CancellationToken cancellationToken)
        {
            var errorMessage = exception switch
            {
                ApiRequestException apiRequestException =>
                    $"Telegram API Error: [{apiRequestException.ErrorCode}] {apiRequestException.Message}",
                _ => exception.ToString()
            };

            _logger.LogError(exception, errorMessage);
            return Task.CompletedTask;
        }

        public async Task SendMessageAsync(long chatId, string text, ParseMode parseMode = ParseMode.Markdown,
            bool disableWebPagePreview = true, int? replyToMessageId = null,
            Telegram.Bot.Types.ReplyMarkups.InlineKeyboardMarkup? replyMarkup = null)
        {
            try
            {
                await _botClient.SendTextMessageAsync(
                    chatId: chatId,
                    text: text,
                    parseMode: parseMode,
                    disableWebPagePreview: disableWebPagePreview,
                    replyToMessageId: replyToMessageId,
                    replyMarkup: replyMarkup,
                    cancellationToken: _cts.Token
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error sending message to chat {chatId}");
                throw;
            }
        }

        public async Task SendPhotoAsync(long chatId, byte[] photo, string caption = "",
            ParseMode parseMode = ParseMode.Markdown, int? replyToMessageId = null)
        {
            try
            {
                using var stream = new MemoryStream(photo);
                var photoInput = Telegram.Bot.Types.InputFiles.InputFile.FromStream(stream);

                await _botClient.SendPhotoAsync(
                    chatId: chatId,
                    photo: photoInput,
                    caption: caption,
                    parseMode: parseMode,
                    replyToMessageId: replyToMessageId,
                    cancellationToken: _cts.Token
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error sending photo to chat {chatId}");
                throw;
            }
        }

        public async Task AnswerCallbackQueryAsync(string callbackQueryId, string? text = null,
            bool showAlert = false, string? url = null, int cacheTime = 0)
        {
            try
            {
                await _botClient.AnswerCallbackQueryAsync(
                    callbackQueryId: callbackQueryId,
                    text: text,
                    showAlert: showAlert,
                    url: url,
                    cacheTime: cacheTime,
                    cancellationToken: _cts.Token
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error answering callback query {callbackQueryId}");
                throw;
            }
        }

        private async Task SetWebhookAsync()
        {
            try
            {
                await _botClient.SetWebhookAsync(
                    url: _config.WebhookUrl,
                    cancellationToken: _cts.Token
                );
                _logger.LogInformation($"Webhook set to: {_config.WebhookUrl}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting webhook");
                throw;
            }
        }

        private async Task DeleteWebhookAsync()
        {
            try
            {
                await _botClient.DeleteWebhookAsync(cancellationToken: _cts.Token);
                _logger.LogInformation("Webhook deleted");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting webhook");
                throw;
            }
        }
    }
}