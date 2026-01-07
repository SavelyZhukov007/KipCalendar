// ============================================================================
// Bot/CommandHandler.cs - Обработчик команд бота
// ============================================================================
using Microsoft.Extensions.Logging;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;
using Telegram.Bot.Types.ReplyMarkups;
using TeleKipish.TeleKipish.Bot.TeleKipish.Bot;

namespace TeleKipish.Bot;

public class CommandHandler
{
    private readonly BotClient _botClient;
    private readonly AuthService _authService;
    private readonly UserService _userService;
    private readonly EventService _eventService;
    private readonly GradeService _gradeService;
    private readonly AttendanceService _attendanceService;
    private readonly QRCodeService _qrCodeService;
    private readonly ILogger<CommandHandler> _logger;
    private readonly Dictionary<long, UserSession> _userSessions = new();

    public CommandHandler(
        BotClient botClient,
        AuthService authService,
        UserService userService,
        EventService eventService,
        GradeService gradeService,
        AttendanceService attendanceService,
        QRCodeService qrCodeService,
        ILogger<CommandHandler> logger)
    {
        _botClient = botClient;
        _authService = authService;
        _userService = userService;
        _eventService = eventService;
        _gradeService = gradeService;
        _attendanceService = attendanceService;
        _qrCodeService = qrCodeService;
        _logger = logger;
    }

    public async Task HandleMessageAsync(Message message, CancellationToken cancellationToken)
    {
        if (message.Text is not { } messageText) return;

        var chatId = message.Chat.Id;
        var userId = message.From?.Id ?? 0;

        _logger.LogInformation($"Received message from {userId}: {messageText}");

        // Проверяем аутентификацию
        var isLinked = await _authService.IsUserLinkedAsync(userId);

        if (!isLinked && !messageText.StartsWith("/start") && !messageText.StartsWith("/link"))
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Для использования бота необходимо связать аккаунт.\nИспользуйте /start для начала.", cancellationToken);
            return;
        }

        var command = messageText.Split(' ')[0].ToLower();

        try
        {
            await (command switch
            {
                "/start" => HandleStartCommand(chatId, userId, cancellationToken),
                "/link" => HandleLinkCommand(chatId, userId, messageText, cancellationToken),
                "/unlink" => HandleUnlinkCommand(chatId, userId, cancellationToken),
                "/help" => HandleHelpCommand(chatId, userId, cancellationToken),
                "/schedule" => HandleScheduleCommand(chatId, userId, messageText, cancellationToken),
                "/homework" => HandleHomeworkCommand(chatId, userId, cancellationToken),
                "/grades" => HandleGradesCommand(chatId, userId, messageText, cancellationToken),
                "/attendance" => HandleAttendanceCommand(chatId, userId, cancellationToken),
                "/profile" => HandleProfileCommand(chatId, userId, cancellationToken),
                "/calendar" => HandleCalendarCommand(chatId, userId, cancellationToken),
                "/settings" => HandleSettingsCommand(chatId, userId, cancellationToken),
                "/grade" => HandleGradeAddCommand(chatId, userId, messageText, cancellationToken),
                "/qr_attendance" => HandleQRAttendanceCommand(chatId, userId, cancellationToken),
                "/scan" => HandleScanCommand(chatId, userId, messageText, cancellationToken),
                "/groups" => HandleGroupsCommand(chatId, userId, cancellationToken),
                "/feedback" => HandleFeedbackCommand(chatId, userId, messageText, cancellationToken),
                _ => HandleUnknownCommand(chatId, messageText, cancellationToken)
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error handling command: {command}");
            await _botClient.SendMessageAsync(chatId,
                "❌ Произошла ошибка при обработке команды. Попробуйте позже.", cancellationToken);
        }
    }

    public async Task HandleCallbackQueryAsync(CallbackQuery callbackQuery, CancellationToken cancellationToken)
    {
        var chatId = callbackQuery.Message?.Chat.Id ?? 0;
        var data = callbackQuery.Data ?? "";

        try
        {
            if (data.StartsWith("settings_"))
            {
                await HandleSettingsCallbackAsync(chatId, data, cancellationToken);
            }
            else if (data.StartsWith("notif_"))
            {
                await HandleNotificationSettingsCallbackAsync(chatId, data, cancellationToken);
            }

            await _botClient.Client.AnswerCallbackQueryAsync(callbackQuery.Id, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling callback");
        }
    }

    private async Task HandleStartCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var isLinked = await _authService.IsUserLinkedAsync(telegramId);

        if (isLinked)
        {
            await _botClient.SendMessageAsync(chatId,
                "✅ Ваш аккаунт уже связан!\n\nИспользуйте /help для просмотра доступных команд.", cancellationToken);
        }
        else
        {
            await _botClient.SendMessageAsync(chatId,
                "👋 *Добро пожаловать в KipCalendar Bot!*\n\n" +
                "Для начала работы необходимо связать ваш аккаунт:\n\n" +
                "1️⃣ Войдите в веб-интерфейс KipCalendar\n" +
                "2️⃣ Перейдите в настройки профиля → Telegram\n" +
                "3️⃣ Нажмите 'Связать Telegram'\n" +
                "4️⃣ Получите 6-значный код\n" +
                "5️⃣ Отправьте код боту:\n\n" +
                "`/link XXXXXX`\n\n" +
                "Например: `/link 123456`",
                cancellationToken);
        }
    }

    private async Task HandleLinkCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        var parts = messageText.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length < 2)
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Укажите код связывания:\n`/link XXXXXX`\n\nНапример: `/link 123456`", cancellationToken);
            return;
        }

        var code = parts[1];

        if (code.Length != 6 || !int.TryParse(code, out _))
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Неверный формат кода. Код должен состоять из 6 цифр.", cancellationToken);
            return;
        }

        var result = await _authService.LinkAccountAsync(telegramId, code);

        if (result.Success)
        {
            await _botClient.SendMessageAsync(chatId,
                "✅ *Аккаунт успешно связан!*\n\n" +
                $"User ID: `{result.UserId}`\n\n" +
                "Используйте /help для просмотра доступных команд.\n" +
                "Настройте уведомления: /settings",
                cancellationToken);
        }
        else
        {
            await _botClient.SendMessageAsync(chatId,
                $"❌ *Ошибка связывания:* {result.Message}\n\n" +
                "Убедитесь, что:\n" +
                "• Код введен правильно\n" +
                "• Код не истек (действителен 10 минут)\n" +
                "• Код был сгенерирован в веб-интерфейсе",
                cancellationToken);
        }
    }

    private async Task HandleUnlinkCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("✅ Да, отвязать", "unlink_confirm"),
                InlineKeyboardButton.WithCallbackData("❌ Отмена", "unlink_cancel")
            }
        });

        await _botClient.Client.SendTextMessageAsync(chatId,
            "⚠️ *Подтвердите отвязку аккаунта*\n\n" +
            "После отвязки вы перестанете получать уведомления и не сможете использовать бота.\n\n" +
            "Вы уверены?",
            parseMode: ParseMode.Markdown,
            replyMarkup: keyboard,
            cancellationToken: cancellationToken);
    }

    private async Task HandleHelpCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var userProfile = await _userService.GetUserProfileAsync(telegramId);

        var helpText = "📚 *Доступные команды:*\n\n";

        helpText += "*📖 Общие команды:*\n" +
                   "• `/schedule` - Расписание занятий\n" +
                   "• `/homework` - Домашние задания\n" +
                   "• `/grades` - Оценки\n" +
                   "• `/attendance` - Посещаемость\n" +
                   "• `/calendar` - Календарь событий\n" +
                   "• `/profile` - Профиль\n" +
                   "• `/settings` - Настройки\n" +
                   "• `/help` - Помощь\n\n";

        if (userProfile?.Roles?.Contains("teacher") == true)
        {
            helpText += "*👨‍🏫 Команды преподавателя:*\n" +
                       "• `/grade` - Выставить оценку\n" +
                       "• `/qr_attendance` - QR-код посещаемости\n" +
                       "• `/groups` - Мои группы\n\n";
        }

        if (userProfile?.Roles?.Contains("admin") == true)
        {
            helpText += "*⚙️ Команды администратора:*\n" +
                       "• `/admin_stats` - Статистика\n" +
                       "• `/admin_users` - Пользователи\n" +
                       "• `/admin_broadcast` - Рассылка\n\n";
        }

        helpText += "*ℹ️ Прочее:*\n" +
                   "• `/feedback` - Обратная связь\n" +
                   "• `/unlink` - Отвязать аккаунт";

        await _botClient.Client.SendTextMessageAsync(chatId, helpText,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleScheduleCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        var parts = messageText.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var period = parts.Length > 1 ? parts[1].ToLower() : "today";

        var schedule = await _eventService.GetScheduleAsync(telegramId, period);

        if (schedule == null || schedule.Count == 0)
        {
            var periodText = period switch
            {
                "today" => "сегодня",
                "tomorrow" => "завтра",
                "week" => "на неделю",
                _ => "на выбранный период"
            };

            await _botClient.SendMessageAsync(chatId,
                $"📅 Занятий {periodText} не найдено.\n\n" +
                "Попробуйте:\n" +
                "• `/schedule today` - сегодня\n" +
                "• `/schedule tomorrow` - завтра\n" +
                "• `/schedule week` - неделя",
                cancellationToken);
            return;
        }

        var response = $"📅 *Расписание ({period}):*\n\n";
        var currentDate = "";

        foreach (var lesson in schedule)
        {
            if (lesson.Date != currentDate)
            {
                currentDate = lesson.Date;
                response += $"\n📆 *{lesson.Date}*\n";
            }

            response += $"\n🕐 {lesson.StartTime} - {lesson.EndTime}\n";
            response += $"📚 {lesson.Subject}\n";
            response += $"👤 {lesson.Teacher}\n";

            if (!string.IsNullOrEmpty(lesson.Room))
                response += $"🏛 {lesson.Building} - {lesson.Room}\n";

            if (!string.IsNullOrEmpty(lesson.Topic))
                response += $"📝 *Тема:* {lesson.Topic}\n";

            if (!string.IsNullOrEmpty(lesson.Homework))
                response += $"✏️ *ДЗ:* {lesson.Homework}\n";
        }

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleHomeworkCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var homework = await _eventService.GetHomeworkAsync(telegramId);

        if (homework == null || homework.Count == 0)
        {
            await _botClient.SendMessageAsync(chatId,
                "📝 Активных домашних заданий не найдено.\n\n" +
                "Отличная новость! 🎉",
                cancellationToken);
            return;
        }

        var response = "📝 *Домашние задания:*\n\n";
        var count = 1;

        foreach (var hw in homework)
        {
            response += $"{count}. 📚 *{hw.Subject}*\n";
            response += $"   📅 К: {hw.Date}\n";
            response += $"   📄 {hw.Homework}\n\n";
            count++;
        }

        response += $"Всего заданий: {homework.Count}";

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleGradesCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        var grades = await _gradeService.GetGradesAsync(telegramId);

        if (grades == null || grades.Count == 0)
        {
            await _botClient.SendMessageAsync(chatId,
                "📊 Оценок пока нет.\n\n" +
                "Оценки появятся после проверки работ преподавателем.",
                cancellationToken);
            return;
        }

        var response = "📊 *Последние оценки:*\n\n";

        foreach (var grade in grades.Take(10))
        {
            response += $"📚 *{grade.Subject}*\n";
            response += $"   ✅ Оценка: *{grade.Value}*\n";
            response += $"   📅 {grade.Date}\n";

            if (!string.IsNullOrEmpty(grade.Comment))
                response += $"   💬 _{grade.Comment}_\n";

            response += "\n";
        }

        if (grades.Count > 10)
            response += $"\n_Показаны последние 10 из {grades.Count} оценок_";

        // Добавляем средний балл если есть
        if (grades.Average != null)
            response += $"\n\n📈 *Средний балл:* {grades.Average:F2}";

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleAttendanceCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var attendance = await _attendanceService.GetAttendanceStatsAsync(telegramId);

        if (attendance == null)
        {
            await _botClient.SendMessageAsync(chatId,
                "📊 Данные о посещаемости пока не доступны.",
                cancellationToken);
            return;
        }

        var response = "📊 *Статистика посещаемости:*\n\n";
        response += $"📈 Общая посещаемость: *{attendance.AttendanceRate:F1}%*\n\n";
        response += $"✅ Присутствий: {attendance.Present}\n";
        response += $"❌ Отсутствий: {attendance.Absent}\n";
        response += $"⏰ Опозданий: {attendance.Late}\n";
        response += $"📝 Всего занятий: {attendance.Total}\n";

        if (attendance.BySubject?.Count > 0)
        {
            response += "\n*По предметам:*\n";
            foreach (var subject in attendance.BySubject.Take(5))
            {
                var rate = subject.Total > 0 ? (subject.Present * 100.0 / subject.Total) : 0;
                response += $"• {subject.Name}: {rate:F0}%\n";
            }
        }

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleProfileCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var profile = await _userService.GetUserProfileAsync(telegramId);

        if (profile == null)
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Профиль не найден. Попробуйте переподключить аккаунт.",
                cancellationToken);
            return;
        }

        var response = "👤 *Профиль:*\n\n";
        response += $"*Имя:* {profile.FirstName} {profile.LastName}\n";

        if (!string.IsNullOrEmpty(profile.MiddleName))
            response += $"*Отчество:* {profile.MiddleName}\n";

        response += $"*Email:* {profile.Email}\n";
        response += $"*Роли:* {string.Join(", ", profile.Roles)}\n";

        if (profile.Organizations?.Count > 0)
        {
            response += "\n*🏛 Организации:*\n";
            foreach (var org in profile.Organizations)
            {
                response += $"• {org.Name}\n";
            }
        }

        if (profile.Groups?.Count > 0)
        {
            response += "\n*📚 Группы:*\n";
            foreach (var group in profile.Groups)
            {
                response += $"• {group.Name}";
                if (group.Course > 0)
                    response += $" (курс {group.Course})";
                response += "\n";
            }
        }

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleCalendarCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var events = await _eventService.GetCalendarEventsAsync(telegramId);

        if (events == null || events.Count == 0)
        {
            await _botClient.SendMessageAsync(chatId,
                "📅 Предстоящих событий не найдено.\n\n" +
                "События можно добавить в веб-интерфейсе KipCalendar.",
                cancellationToken);
            return;
        }

        var response = "📅 *Предстоящие события:*\n\n";
        var count = 1;

        foreach (var evt in events.Take(10))
        {
            response += $"{count}. 📌 *{evt.Title}*\n";
            response += $"   📅 {evt.Date} {evt.Time}\n";

            if (!string.IsNullOrEmpty(evt.Description))
            {
                var desc = evt.Description.Length > 100
                    ? evt.Description.Substring(0, 100) + "..."
                    : evt.Description;
                response += $"   📝 {desc}\n";
            }

            response += "\n";
            count++;
        }

        if (events.Count > 10)
            response += $"_Показаны первые 10 из {events.Count} событий_";

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleSettingsCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var keyboard = new InlineKeyboardMarkup(new[]
        {
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🔔 Уведомления", "settings_notifications"),
            },
            new[]
            {
                InlineKeyboardButton.WithCallbackData("🌍 Язык", "settings_language"),
                InlineKeyboardButton.WithCallbackData("⏰ Тихий режим", "settings_quiet")
            }
        });

        await _botClient.Client.SendTextMessageAsync(chatId,
            "⚙️ *Настройки бота*\n\n" +
            "Выберите раздел для настройки:",
            parseMode: ParseMode.Markdown,
            replyMarkup: keyboard,
            cancellationToken: cancellationToken);
    }

    private async Task HandleSettingsCallbackAsync(long chatId, string data, CancellationToken cancellationToken)
    {
        if (data == "settings_notifications")
        {
            var keyboard = new InlineKeyboardMarkup(new[]
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("✅ Оценки", "notif_toggle_grade"),
                    InlineKeyboardButton.WithCallbackData("✅ ДЗ", "notif_toggle_homework")
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("✅ События", "notif_toggle_event"),
                    InlineKeyboardButton.WithCallbackData("✅ Сообщения", "notif_toggle_message")
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("🔙 Назад", "settings_back")
                }
            });

            await _botClient.Client.SendTextMessageAsync(chatId,
                "🔔 *Настройки уведомлений*\n\n" +
                "Выберите типы уведомлений:",
                parseMode: ParseMode.Markdown,
                replyMarkup: keyboard,
                cancellationToken: cancellationToken);
        }
    }

    private async Task HandleNotificationSettingsCallbackAsync(long chatId, string data, CancellationToken cancellationToken)
    {
        // Обработка переключения уведомлений
        await _botClient.SendMessageAsync(chatId,
            "✅ Настройки обновлены", cancellationToken);
    }

    private async Task HandleGradeAddCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        await _botClient.SendMessageAsync(chatId,
            "📝 *Выставление оценок через бота*\n\n" +
            "Функция в разработке.\n" +
            "Используйте веб-интерфейс для выставления оценок.",
            cancellationToken);
    }

    private async Task HandleQRAttendanceCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var qrCode = await _qrCodeService.GenerateQRCodeAsync(telegramId);

        if (qrCode == null)
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Ошибка создания QR-кода.\n\n" +
                "Возможные причины:\n" +
                "• У вас нет активных занятий сейчас\n" +
                "• Вы не являетесь преподавателем",
                cancellationToken);
            return;
        }

        await _botClient.Client.SendPhotoAsync(chatId,
            qrCode.QrUrl,
            caption: $"📱 *QR-код для посещаемости*\n\n" +
                    $"⏰ Действителен до: {qrCode.ExpiresAt:HH:mm}\n" +
                    $"🔑 Токен: `{qrCode.Token}`\n\n" +
                    $"Студенты могут отсканировать QR или использовать:\n" +
                    $"`/scan {qrCode.Token}`",
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleScanCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        var parts = messageText.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length < 2)
        {
            await _botClient.SendMessageAsync(chatId,
                "❌ Укажите токен:\n`/scan TOKEN`\n\n" +
                "Токен можно найти под QR-кодом преподавателя.",
                cancellationToken);
            return;
        }

        var token = parts[1];
        var result = await _qrCodeService.VerifyQRCodeAsync(telegramId, token);

        if (result.Success)
        {
            await _botClient.SendMessageAsync(chatId,
                $"✅ *Посещаемость отмечена!*\n\n" +
                $"📚 Предмет: {result.Subject}\n" +
                $"📅 Дата: {result.Date}\n" +
                $"🕐 Время: {result.Time}",
                cancellationToken);
        }
        else
        {
            await _botClient.SendMessageAsync(chatId,
                $"❌ *Ошибка:* {result.Message}\n\n" +
                "Возможные причины:\n" +
                "• Неверный или истекший токен\n" +
                "• Вы уже отметились\n" +
                "• Вы не являетесь студентом этой группы",
                cancellationToken);
        }
    }

    private async Task HandleGroupsCommand(long chatId, long telegramId, CancellationToken cancellationToken)
    {
        var groups = await _userService.GetTeacherGroupsAsync(telegramId);

        if (groups == null || groups.Count == 0)
        {
            await _botClient.SendMessageAsync(chatId,
                "📚 У вас нет назначенных групп.\n\n" +
                "Группы назначаются администратором организации.",
                cancellationToken);
            return;
        }

        var response = "👥 *Мои группы:*\n\n";

        foreach (var group in groups)
        {
            response += $"📚 *{group.Name}*\n";
            response += $"   👥 Студентов: {group.StudentCount}\n";
            response += $"   🏛 {group.Organization}\n\n";
        }

        await _botClient.Client.SendTextMessageAsync(chatId, response,
            parseMode: ParseMode.Markdown,
            cancellationToken: cancellationToken);
    }

    private async Task HandleFeedbackCommand(long chatId, long telegramId, string messageText, CancellationToken cancellationToken)
    {
        var parts = messageText.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);

        if (parts.Length < 2)
        {
            await _botClient.SendMessageAsync(chatId,
                "💬 *Обратная связь*\n\n" +
                "Отправьте сообщение командой:\n" +
                "`/feedback ваше сообщение`\n\n" +
                "Мы обязательно его рассмотрим!",
                cancellationToken);
            return;
        }

        var feedback = parts[1];
        // Здесь можно сохранить feedback в БД или отправить админу

        await _botClient.SendMessageAsync(chatId,
            "✅ Спасибо за обратную связь!\n\n" +
            "Ваше сообщение получено и будет рассмотрено.",
            cancellationToken);
    }

    private async Task HandleUnknownCommand(long chatId, string messageText, CancellationToken cancellationToken)
    {
        // Проверяем, не код ли это связывания
        if (messageText.Length == 6 && int.TryParse(messageText, out _))
        {
            await HandleLinkCommand(chatId, 0, "/link " + messageText, cancellationToken);
        }
        else
        {
            await _botClient.SendMessageAsync(chatId,
                "❓ Неизвестная команда.\n\nИспользуйте /help для списка доступных команд.",
                cancellationToken);
        }
    }

    private class UserSession
    {
        public string CurrentCommand { get; set; } = "";
        public Dictionary<string, object> Data { get; set; } = new();
        public DateTime LastActivity { get; set; } = DateTime.Now;
    }
}