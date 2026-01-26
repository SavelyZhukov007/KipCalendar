using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using Telegram.Bot;
using Telegram.Bot.Polling;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Requests;

namespace MafiaReminderBot
{
    class Program
    {
        private const string BotToken = "Placw_your_token_here";
        private static readonly Dictionary<DayOfWeek, List<TimeOnly>> Schedule = new()
        {
            { DayOfWeek.Monday, new List<TimeOnly>()},     // Нет напоминаний
            { DayOfWeek.Tuesday, new List<TimeOnly>() },   // Нет напоминаний
            { DayOfWeek.Wednesday, new List<TimeOnly> { new(9, 00) } },
            { DayOfWeek.Thursday, new List<TimeOnly>()},   // Нет напоминаний
            { DayOfWeek.Friday, new List<TimeOnly> { new(9, 00) } },
            { DayOfWeek.Saturday, new List<TimeOnly>() },  // Нет напоминаний
            { DayOfWeek.Sunday, new List<TimeOnly>() }     // Нет напоминаний
        };

        private static long _groupChatId = -1002203085215;

        private static readonly ITelegramBotClient Bot = new TelegramBotClient(BotToken);
        private static readonly HashSet<DateTime> SentReminders = new();
        private static Timer? _checkTimer;
        static async Task Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;

            Console.WriteLine("Бот запущен! Нажмите Ctrl+C для остановки.");
            _checkTimer = new Timer(CheckAndSendReminders, null, TimeSpan.Zero, TimeSpan.FromMinutes(1));
            var cts = new CancellationTokenSource();
            var receiverOptions = new ReceiverOptions
            {
                AllowedUpdates = Array.Empty<UpdateType>()
            };

            Bot.StartReceiving(
                HandleUpdateAsync,
                HandleErrorAsync,
                receiverOptions,
                cts.Token
            );

            Console.ReadLine();
            cts.Cancel();
        }
        private static void CheckAndSendReminders(object? state)
        {
            var now = DateTime.Now;
            var today = now.DayOfWeek;
            var currentTime = TimeOnly.FromDateTime(now);
            if (!Schedule.ContainsKey(today))
                return;
            foreach (var scheduledTime in Schedule[today])
            {
                var reminderKey = new DateTime(now.Year, now.Month, now.Day,
                    scheduledTime.Hour, scheduledTime.Minute, 0);
                if (currentTime.Hour == scheduledTime.Hour &&
                    currentTime.Minute == scheduledTime.Minute &&
                    !SentReminders.Contains(reminderKey))
                {
                    SendReminderToGroup().Wait();
                    SentReminders.Add(reminderKey);
                    SentReminders.RemoveWhere(dt => dt < now.AddDays(-1));
                }
            }
        }

        private static async Task SendReminderToGroup()
        {
            try
            {
                if (_groupChatId == 0)
                {
                    Console.WriteLine("ОШИБКА: ID группы не установлен!");
                    return;
                }

                await Bot.SendMessage(
                    chatId: _groupChatId,
                    text: "Бегом к Пестову! А то без мафии останетесь!"
                );

                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Напоминание отправлено!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка отправки напоминания: {ex.Message}");
            }
        }

        private static async Task HandleUpdateAsync(ITelegramBotClient bot, Update update, CancellationToken ct)
        {
            if (update.Type != UpdateType.Message || update.Message?.Text == null)
                return;

            var message = update.Message;
            var chatId = message.Chat.Id;

            // Сохраняем ID группы при первом сообщении
            if (_groupChatId == 0 && message.Chat.Type != ChatType.Private)
            {
                _groupChatId = chatId;
                Console.WriteLine($"ID группы сохранён: {_groupChatId}");
            }

            // Обрабатываем только сообщения боту (не в группе или с упоминанием)
            var botInfo = await bot.GetMe(ct);
            if (message.Chat.Type == ChatType.Private ||
                (message.Text.Contains($"@{botInfo.Username}")))
            {
                var responseText = GetResponseForCurrentTime();
                await bot.SendMessage(chatId, responseText, cancellationToken: ct);
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Ответ отправлен: {responseText}");
            }
        }

        private static string GetResponseForCurrentTime()
        {
            var now = DateTime.Now;
            var today = now.DayOfWeek;
            var currentTime = TimeOnly.FromDateTime(now);

            if (!Schedule.ContainsKey(today))
                return "Прости солнышко, я просто твоя совесть, а значит ничем не могу помочь";

            // Проверяем, находимся ли мы в пределах 1.5 часов после любого напоминания
            foreach (var scheduledTime in Schedule[today])
            {
                var endTime = scheduledTime.AddMinutes(90);

                // Учитываем переход через полночь
                if (endTime.Hour < scheduledTime.Hour)
                {
                    if (currentTime >= scheduledTime || currentTime <= endTime)
                        return "Учись давай, а то будет тебе ата-та";
                }
                else
                {
                    if (currentTime >= scheduledTime && currentTime <= endTime)
                        return "Учись давай, а то будет тебе ата-та";
                }
            }

            return "Прости солнышко, я просто твоя совесть, а значит ничем не могу помочь";
        }

        private static Task HandleErrorAsync(ITelegramBotClient bot, Exception exception, CancellationToken ct)
        {
            Console.WriteLine($"Ошибка: {exception.Message}");
            return Task.CompletedTask;
        }
    }
}