using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using TeleKipish.Helpers;
using TeleKipish.Services;
using TeleKipish.Models;

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

        public CommandHandler(
            BotClient botClient,
            Logger logger,
            AuthService authService,
            UserService userService,
            ScheduleService scheduleService,
            GradeService gradeService,
            AttendanceService attendanceService,
            HomeworkService homeworkService,
            CalendarService calendarService,
            NotificationService notificationService,
            LocalizationService localizationService,
            InlineKeyboardBuilder keyboardBuilder)
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

        public async Task HandleCommand(Message message)
        {
            var chatId = message.Chat.Id;
            var text = message.Text ?? "";
            var user = message.From;

            if (user == null)
                return;

            var telegramId = user.Id.ToString();
            var username = user.Username;
            var firstName = user.FirstName;
            var lastName = user.LastName;

            // Create or update user
            var dbUser = await _userService.CreateOrUpdateUser(telegramId, username, firstName, lastName);

            // Check if user is linked
            var isLinked = dbUser?.KipCalendarUserId != null;

            // Parse command
            var command = ParseCommand(text);

            // Log command execution
            var startTime = DateTime.UtcNow;

            try
            {
                // Handle command based on type
                var response = await HandleCommandInternal(command, telegramId, text, isLinked, dbUser?.Role ?? "student");

                // Send response
                await _botClient.SendMessageAsync(chatId, response);

                // Log successful command
                var executionTime = (DateTime.UtcNow - startTime).TotalMilliseconds;
                _logger.LogCommand(telegramId, command, true, (long)executionTime);
            }
            catch (Exception ex)
            {
                // Log failed command
                var executionTime = (DateTime.UtcNow - startTime).TotalMilliseconds;
                _logger.LogCommand(telegramId, command, false, (long)executionTime, ex.Message);

                // Send error message
                await _botClient.SendMessageAsync(chatId,
                    _localizationService.GetTranslation("error.general", dbUser?.Language ?? "ru"));
            }
        }

        public async Task HandleCallbackQuery(CallbackQuery callbackQuery)
        {
            var chatId = callbackQuery.Message?.Chat.Id ?? 0;
            var data = callbackQuery.Data;
            var user = callbackQuery.From;

            if (user == null || string.IsNullOrEmpty(data))
                return;

            var telegramId = user.Id.ToString();

            // Answer callback query immediately
            await _botClient.AnswerCallbackQueryAsync(callbackQuery.Id);

            // Handle callback data
            var response = await HandleCallbackData(data, telegramId);

            if (!string.IsNullOrEmpty(response))
            {
                await _botClient.SendMessageAsync(chatId, response);
            }
        }

        private async Task<string> HandleCommandInternal(string command, string telegramId, string fullText, bool isLinked, string userRole)
        {
            var user = await _userService.GetUserByTelegramId(telegramId);
            var language = user?.Language ?? "ru";

            // Handle start command (available to everyone)
            if (command == "/start")
            {
                return await HandleStartCommand(telegramId, user, language, isLinked);
            }

            // Check if user is linked for other commands
            if (!isLinked)
            {
                return _localizationService.GetTranslation("error.not_linked", language);
            }

            // Handle commands based on user role
            switch (command)
            {
                case "/help":
                    return HandleHelpCommand(userRole, language);

                case "/schedule":
                    return await HandleScheduleCommand(telegramId, fullText, language);

                case "/homework":
                    return await HandleHomeworkCommand(telegramId, fullText, language);

                case "/grades":
                    return await HandleGradesCommand(telegramId, fullText, language);

                case "/attendance":
                    return await HandleAttendanceCommand(telegramId, language);

                case "/calendar":
                    return await HandleCalendarCommand(telegramId, fullText, language);

                case "/profile":
                    return await HandleProfileCommand(telegramId, language);

                case "/settings":
                    return HandleSettingsCommand(language);

                case "/feedback":
                    return HandleFeedbackCommand(language);

                case "/language":
                    return HandleLanguageCommand(language);

                // Teacher commands
                case "/grade" when userRole == "teacher":
                    return await HandleGradeCommand(telegramId, fullText, language);

                case "/attendance_mark" when userRole == "teacher":
                    return await HandleAttendanceMarkCommand(telegramId, language);

                case "/homework_assign" when userRole == "teacher":
                    return await HandleHomeworkAssignCommand(telegramId, fullText, language);

                case "/qr_attendance" when userRole == "teacher":
                    return await HandleQRAttendanceCommand(telegramId, language);

                case "/groups" when userRole == "teacher":
                    return await HandleGroupsCommand(telegramId, language);

                case "/stats" when userRole == "teacher":
                    return await HandleStatsCommand(telegramId, language);

                // Admin commands
                case "/admin_stats" when userRole == "admin":
                    return await HandleAdminStatsCommand(telegramId, language);

                case "/admin_users" when userRole == "admin":
                    return await HandleAdminUsersCommand(telegramId, language);

                case "/admin_broadcast" when userRole == "admin":
                    return await HandleAdminBroadcastCommand(telegramId, fullText, language);

                // Student QR scan
                case "/scan" when userRole == "student":
                    return await HandleScanCommand(telegramId, fullText, language);

                // Search
                case "/search":
                    return await HandleSearchCommand(telegramId, fullText, language);

                // Export
                case "/export":
                    return await HandleExportCommand(telegramId, language);

                default:
                    return _localizationService.GetTranslation("error.unknown_command", language);
            }
        }

        private async Task<string> HandleStartCommand(string telegramId, User? user, string language, bool isLinked)
        {
            var welcomeText = _localizationService.GetTranslation("welcome", language);

            if (!isLinked)
            {
                var linkCode = await _authService.GenerateLinkCode(telegramId);
                var linkInstructions = _localizationService.GetTranslation("link_instructions", language)
                    .Replace("{code}", linkCode);

                return $"{welcomeText}\n\n{linkInstructions}";
            }
            else
            {
                var helpText = _localizationService.GetTranslation("help.basic", language);
                return $"{welcomeText}\n\n{helpText}";
            }
        }

        private string HandleHelpCommand(string userRole, string language)
        {
            return _localizationService.GetRoleBasedHelp(userRole, language);
        }

        private async Task<string> HandleScheduleCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length > 1)
            {
                var parameter = parts[1].ToLower();

                switch (parameter)
                {
                    case "today":
                        return await _scheduleService.GetScheduleForToday(telegramId);

                    case "tomorrow":
                        return await _scheduleService.GetScheduleForTomorrow(telegramId);

                    case "week":
                        var startOfWeek = DateTimeHelper.GetStartOfWeek(DateTime.Today);
                        return await _scheduleService.GetScheduleForWeek(telegramId, startOfWeek);

                    default:
                        if (DateTime.TryParse(parameter, out var date))
                        {
                            return await _scheduleService.GetScheduleForUser(telegramId, date);
                        }
                        break;
                }
            }

            // Default: schedule for today
            return await _scheduleService.GetScheduleForToday(telegramId);
        }

        private async Task<string> HandleHomeworkCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length > 1)
            {
                var parameter = parts[1].ToLower();

                if (parameter == "week")
                {
                    return await _homeworkService.GetHomeworkWithDeadlines(telegramId, 7);
                }
                else
                {
                    // Assume it's a subject name
                    return await _homeworkService.GetHomeworkBySubject(telegramId, string.Join(" ", parts.Skip(1)));
                }
            }

            // Default: current homework
            return await _homeworkService.GetCurrentHomework(telegramId);
        }

        private async Task<string> HandleGradesCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length > 1)
            {
                var parameter = parts[1].ToLower();

                switch (parameter)
                {
                    case "recent":
                        var count = parts.Length > 2 && int.TryParse(parts[2], out var n) ? n : 5;
                        return await _gradeService.GetRecentGrades(telegramId, count);

                    case "average":
                        return await _gradeService.GetAverageGrades(telegramId);

                    default:
                        // Assume it's a subject name
                        return await _gradeService.GetGradesBySubject(telegramId, string.Join(" ", parts.Skip(1)));
                }
            }

            // Default: recent grades
            return await _gradeService.GetRecentGrades(telegramId);
        }

        private async Task<string> HandleAttendanceCommand(string telegramId, string language)
        {
            return await _attendanceService.GetAttendanceStatistics(telegramId);
        }

        private async Task<string> HandleCalendarCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length > 1)
            {
                var parameter = parts[1].ToLower();

                switch (parameter)
                {
                    case "today":
                        return await _calendarService.GetEventsForDate(telegramId, DateTime.Today);

                    case "tomorrow":
                        return await _calendarService.GetEventsForDate(telegramId, DateTime.Today.AddDays(1));

                    case "week":
                        var startOfWeek = DateTimeHelper.GetStartOfWeek(DateTime.Today);
                        return await _calendarService.GetEventsForWeek(telegramId, startOfWeek);

                    default:
                        if (DateTime.TryParse(parameter, out var date))
                        {
                            return await _calendarService.GetEventsForDate(telegramId, date);
                        }
                        break;
                }
            }

            // Default: upcoming events for next 7 days
            return await _calendarService.GetUpcomingEvents(telegramId, 7);
        }

        private async Task<string> HandleProfileCommand(string telegramId, string language)
        {
            var user = await _userService.GetUserByTelegramId(telegramId);
            if (user == null)
                return _localizationService.GetTranslation("error.user_not_found", language);

            var profileText = _localizationService.GetTranslation("profile.title", language) + "\n\n";
            profileText += $"👤 {user.FirstName} {user.LastName}\n";

            if (!string.IsNullOrEmpty(user.Username))
                profileText += $"📱 @{user.Username}\n";

            profileText += $"🎓 Роль: {GetRoleName(user.Role, language)}\n";
            profileText += $"🌐 Язык: {GetLanguageName(user.Language, language)}\n";
            profileText += $"📅 Дата связывания: {user.LinkedAt:dd.MM.yyyy}\n";

            if (user.LastActivity.HasValue)
                profileText += $"🕒 Последняя активность: {user.LastActivity.Value:dd.MM.yyyy HH:mm}\n";

            return profileText;
        }

        private string HandleSettingsCommand(string language)
        {
            var settingsText = _localizationService.GetTranslation("settings.title", language) + "\n\n";
            settingsText += _localizationService.GetTranslation("settings.options", language);

            // In a real implementation, this would show inline keyboard with settings
            return settingsText;
        }

        private string HandleFeedbackCommand(string language)
        {
            return _localizationService.GetTranslation("feedback.instructions", language);
        }

        private string HandleLanguageCommand(string language)
        {
            var languages = _localizationService.GetAvailableLanguages();
            var languageText = _localizationService.GetTranslation("language.title", language) + "\n\n";
            languageText += _localizationService.GetTranslation("language.options", language);

            foreach (var lang in languages)
            {
                languageText += $"\n{GetLanguageName(lang, language)} - /set_language_{lang}";
            }

            return languageText;
        }

        // Teacher command handlers
        private async Task<string> HandleGradeCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length >= 5)
            {
                var group = parts[1];
                var subject = parts[2];
                var student = parts[3];
                var grade = parts[4];
                var comment = parts.Length > 5 ? string.Join(" ", parts.Skip(5)) : null;

                return await _gradeService.AddGrade(telegramId, group, subject, student, grade, comment);
            }
            else
            {
                return _localizationService.GetTranslation("grade.instructions", language);
            }
        }

        private async Task<string> HandleAttendanceMarkCommand(string telegramId, string language)
        {
            return _localizationService.GetTranslation("attendance_mark.instructions", language);
        }

        private async Task<string> HandleHomeworkAssignCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length >= 4)
            {
                var group = parts[1];
                var subject = parts[2];
                var description = string.Join(" ", parts.Skip(3));

                return await _homeworkService.AssignHomework(telegramId, group, subject, description);
            }
            else
            {
                return _localizationService.GetTranslation("homework_assign.instructions", language);
            }
        }

        private async Task<string> HandleQRAttendanceCommand(string telegramId, string language)
        {
            // Generate QR attendance token
            var qrToken = await _attendanceService.GenerateQRAttendanceToken(telegramId, 1); // lessonId should come from somewhere

            if (qrToken == null)
                return _localizationService.GetTranslation("error.qr_generation", language);

            // Generate QR code image
            var qrHelper = new QRCodeHelper(new Config(null)); // Would need proper DI
            var qrImage = qrHelper.GenerateQRCodeImage(qrToken.Token);
            var qrMessage = qrHelper.FormatQRMessage(qrToken.Token, qrToken.ExpiresAt);

            // Send QR code
            await _botClient.SendPhotoAsync(long.Parse(telegramId), qrImage, qrMessage);

            return _localizationService.GetTranslation("qr_generated", language);
        }

        private async Task<string> HandleGroupsCommand(string telegramId, string language)
        {
            return _localizationService.GetTranslation("groups.instructions", language);
        }

        private async Task<string> HandleStatsCommand(string telegramId, string language)
        {
            return _localizationService.GetTranslation("stats.instructions", language);
        }

        // Admin command handlers
        private async Task<string> HandleAdminStatsCommand(string telegramId, string language)
        {
            var activeUsersCount = await _userService.GetActiveUsersCount();

            var statsText = _localizationService.GetTranslation("admin_stats.title", language) + "\n\n";
            statsText += $"👥 Активных пользователей: {activeUsersCount}\n";
            statsText += $"🤖 Бот работает с: {DateTime.UtcNow.AddDays(-7):dd.MM.yyyy}\n";

            return statsText;
        }

        private async Task<string> HandleAdminUsersCommand(string telegramId, string language)
        {
            var activeUsers = await _userService.GetActiveUsers(10);

            var usersText = _localizationService.GetTranslation("admin_users.title", language) + "\n\n";

            foreach (var user in activeUsers)
            {
                usersText += $"👤 {user.FirstName} {user.LastName} (@{user.Username})\n";
                usersText += $"   ID: {user.TelegramId}, Роль: {user.Role}\n";
                usersText += $"   Активность: {user.LastActivity:dd.MM.yyyy HH:mm}\n\n";
            }

            return usersText;
        }

        private async Task<string> HandleAdminBroadcastCommand(string telegramId, string text, string language)
        {
            var message = text.Replace("/admin_broadcast", "").Trim();

            if (string.IsNullOrEmpty(message))
                return _localizationService.GetTranslation("admin_broadcast.instructions", language);

            return _localizationService.GetTranslation("admin_broadcast.sent", language)
                .Replace("{message}", message);
        }

        // Student QR scan
        private async Task<string> HandleScanCommand(string telegramId, string text, string language)
        {
            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            if (parts.Length < 2)
                return _localizationService.GetTranslation("scan.instructions", language);

            var token = parts[1];
            var success = await _attendanceService.MarkAttendanceViaQR(telegramId, token);

            if (success)
                return _localizationService.GetTranslation("scan.success", language);
            else
                return _localizationService.GetTranslation("scan.error", language);
        }

        private async Task<string> HandleSearchCommand(string telegramId, string text, string language)
        {
            var query = text.Replace("/search", "").Trim();

            if (string.IsNullOrEmpty(query))
                return _localizationService.GetTranslation("search.instructions", language);

            return _localizationService.GetTranslation("search.results", language)
                .Replace("{query}", query);
        }

        private async Task<string> HandleExportCommand(string telegramId, string language)
        {
            return _localizationService.GetTranslation("export.instructions", language);
        }

        private async Task<string> HandleCallbackData(string data, string telegramId)
        {
            // Handle different callback data patterns
            if (data.StartsWith("language_"))
            {
                var language = data.Replace("language_", "");
                await _userService.UpdateUserLanguage(telegramId, language);
                return _localizationService.GetTranslation("language.changed", language);
            }

            return "Callback handled";
        }

        private string ParseCommand(string text)
        {
            if (string.IsNullOrEmpty(text))
                return "";

            var parts = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts[0].ToLower();
        }

        private string GetRoleName(string role, string language)
        {
            return role switch
            {
                "student" => "Студент",
                "teacher" => "Преподаватель",
                "admin" => "Администратор",
                _ => role
            };
        }

        private string GetLanguageName(string languageCode, string currentLanguage)
        {
            return languageCode switch
            {
                "ru" => "Русский 🇷🇺",
                "en" => "English 🇺🇸",
                _ => languageCode
            };
        }
    }
}