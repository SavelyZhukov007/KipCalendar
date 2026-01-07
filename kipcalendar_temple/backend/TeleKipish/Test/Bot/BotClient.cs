// ============================================================================
// Bot/BotClient.cs - Основной клиент бота
// ============================================================================
using Telegram.Bot;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Exceptions;
using Microsoft.Extensions.Logging;

namespace TeleKipish.Bot;

public class BotClient
{
    private readonly TelegramBotClient _client;
    private readonly CommandHandler _commandHandler;
    private readonly ILogger<BotClient> _logger;
    private readonly BotConfig _config;

    public BotClient(BotConfig config, CommandHandler commandHandler, ILogger<BotClient> logger)
    {
        _config = config;
        _commandHandler = commandHandler;
        _logger = logger;
        _client = new TelegramBotClient(config.BotToken);
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        var me = await _client.GetMeAsync(cancellationToken);
        _logger.LogInformation($"Bot started: @{me.Username}");

        var receiverOptions = new ReceiverOptions
        {
            AllowedUpdates = Array.Empty<UpdateType>()
        };

        _client.StartReceiving(
            HandleUpdateAsync,
            HandleErrorAsync,
            receiverOptions,
            cancellationToken
        );
    }

    private async Task HandleUpdateAsync(ITelegramBotClient client, Update update, CancellationToken cancellationToken)
    {
        try
        {
            if (update.Message is { } message)
            {
                await _commandHandler.HandleMessageAsync(message, cancellationToken);
            }
            else if (update.CallbackQuery is { } callbackQuery)
            {
                await _commandHandler.HandleCallbackQueryAsync(callbackQuery, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling update");
        }
    }

    private Task HandleErrorAsync(ITelegramBotClient client, Exception exception, CancellationToken cancellationToken)
    {
        var errorMessage = exception switch
        {
            ApiRequestException apiEx => $"Telegram API Error: {apiEx.ErrorCode} - {apiEx.Message}",
            _ => exception.ToString()
        };

        _logger.LogError(errorMessage);
        return Task.CompletedTask;
    }

    public async Task SendMessageAsync(long chatId, string text, CancellationToken cancellationToken = default)
    {
        await _client.SendTextMessageAsync(chatId, text, cancellationToken: cancellationToken);
    }

    public async Task SendPhotoAsync(long chatId, string photoUrl, string caption, CancellationToken cancellationToken = default)
    {
        await _client.SendPhotoAsync(chatId, photoUrl, caption, cancellationToken: cancellationToken);
    }

    public TelegramBotClient Client => _client;
}