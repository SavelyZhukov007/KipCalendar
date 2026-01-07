using Telegram.Bot.Types;
using TeleKipish.Helpers;
using TeleKipish.Services;
using TeleKipish.Models;
using System.Threading.Tasks;

namespace TeleKipish.Bot
{
    public class CommandHandler
    {
        private readonly BotClient _botClient;
        private readonly Logger _logger;
        private readonly AuthService _authService;
        private readonly UserService _userService;
        private readonly ScheduleService _scheduleService;
        private readonly GradeService _gradeService;
        private readonly AttendanceService _attendanceService;
        private readonly HomeworkService _homeworkService;
        private readonly CalendarService _calendarService;
        private readonly NotificationService _notificationService;
        private readonly LocalizationService _localizationService;
        private readonly InlineKeyboardBuilder _keyboardBuilder;

        public CommandHandler(BotClient botClient, Logger logger, AuthService authService, UserService userService,
            ScheduleService scheduleService, GradeService gradeService, AttendanceService attendanceService,
            HomeworkService homeworkService, CalendarService calendarService, NotificationService notificationService,
            LocalizationService localizationService, InlineKeyboardBuilder keyboardBuilder)
        {
            _botClient = botClient;
            _logger = logger;
            _authService = authService;
            _userService = userService;
            _scheduleService = scheduleService;
            _gradeService = gradeService;
            _attendanceService = attendanceService;
            _homeworkService = homeworkService;
            _calendarService = calendarService;
            _notificationService = notificationService;
            _localizationService = localizationService;
            _keyboardBuilder = keyboardBuilder;
        }

        // Minimal public handlers
        public async Task HandleCommand(Message message)
        {
            if (message?.Text == null) return;
            var telegramId = message.From?.Id.ToString() ?? string.Empty;
            var text = message.Text.Trim();

            // Simple command parsing
            if (text.StartsWith("/start"))
            {
                var code = await _authService.GenerateLinkCode(telegramId);
                var instructions = _localizationService.GetTranslation("link_instructions");
                if (!string.IsNullOrEmpty(instructions))
                {
                    instructions = instructions.Replace("{code}", code);
                }

                await _botClient.SendMessageAsync(message.Chat.Id,
                    _localizationService.GetTranslation("welcome") + "\n" + instructions);
                return;
            }

            if (text.StartsWith("/help"))
            {
                var help = _localizationService.GetRoleBasedHelp("student");
                await _botClient.SendMessageAsync(message.Chat.Id, help);
                return;
            }

            if (text.StartsWith("/link"))
            {
                // /link <code>
                var parts = text.Split(' ', 2, System.StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 2)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("link_instructions").Replace("{code}", "<code>"));
                    return;
                }

                var code = parts[1].Trim();
                var valid = await _authService.ValidateLinkCode(telegramId, code);
                if (!valid)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("error.not_linked"));
                    return;
                }

                // In real app we would determine KipCalendar user id from code; here we just call LinkAccount stub
                var linked = await _authService.LinkAccount(telegramId, code, 0);
                if (linked)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, "✅ Аккаунт успешно связан.");
                }
                else
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("error.general"));
                }

                return;
            }

            if (text.StartsWith("/unlink"))
            {
                var ok = await _authService.UnlinkAccount(telegramId);
                if (ok)
                    await _botClient.SendMessageAsync(message.Chat.Id, "✅ Аккаунт отвязан.");
                else
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("error.general"));
                return;
            }

            if (text.StartsWith("/notifications"))
            {
                // /notifications on|off
                var parts = text.Split(' ', 2, System.StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 2)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, "Используйте: /notifications on или /notifications off");
                    return;
                }
                var arg = parts[1].ToLowerInvariant();
                if (arg == "on")
                {
                    await _notificationService.EnableForTelegramId(telegramId);
                    await _botClient.SendMessageAsync(message.Chat.Id, "✅ Уведомления включены");
                }
                else if (arg == "off")
                {
                    await _notificationService.DisableForTelegramId(telegramId);
                    await _botClient.SendMessageAsync(message.Chat.Id, "✅ Уведомления отключены");
                }
                else
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, "Используйте: /notifications on или /notifications off");
                }

                return;
            }

            if (text.StartsWith("/scan"))
            {
                // /scan <token>
                var parts = text.Split(' ', 2, System.StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length < 2)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("scan.instructions"));
                    return;
                }
                var token = parts[1].Trim();
                var ok = await _attendanceService.VerifyQrToken(token, telegramId);
                if (ok)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("scan.success"));
                }
                else
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("scan.error"));
                }
                return;
            }

            if (text.StartsWith("/profile"))
            {
                var user = await _userService.GetUserByTelegramId(telegramId);
                if (user == null)
                {
                    await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("error.user_not_found"));
                    return;
                }

                var sb = new System.Text.StringBuilder();
                sb.AppendLine(_localizationService.GetTranslation("profile.title"));
                sb.AppendLine($"👤 {user.FirstName} {user.LastName} @{user.Username}");
                sb.AppendLine($"Роль: {user.Role}");
                sb.AppendLine($"Язык: {user.Language}");

                await _botClient.SendMessageAsync(message.Chat.Id, sb.ToString());
                return;
            }

            // Fallback: unknown command
            await _botClient.SendMessageAsync(message.Chat.Id, _localizationService.GetTranslation("error.unknown_command"));
        }

        public async Task HandleCallbackQuery(Telegram.Bot.Types.CallbackQuery callbackQuery)
        {
            if (callbackQuery?.Data == null) return;
            await _botClient.AnswerCallbackQueryAsync(callbackQuery.Id, "OK");
        }
    }
}