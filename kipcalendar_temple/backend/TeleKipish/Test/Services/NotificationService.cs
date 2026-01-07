// ============================================================================
// Services/NotificationService.cs - Сервис уведомлений
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Bot;
using TeleKipish.Models;
using TeleKipish.Services.TeleKipish.Services.TeleKipish.Models;
using TeleKipish.TeleKipish.Bot;
using TeleKipish.TeleKipish.Bot.TeleKipish.Bot;

namespace TeleKipish.Services;

public class NotificationService
{
    private readonly ApiService _apiService;
    private readonly BotClient _botClient;
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(ApiService apiService, BotClient botClient, ILogger<NotificationService> logger)
    {
        _apiService = apiService;
        _botClient = botClient;
        _logger = logger;
    }

    public async Task ProcessPendingNotificationsAsync(CancellationToken cancellationToken)
    {
        try
        {
            // Получаем список всех связанных пользователей
            var users = await GetLinkedUsersAsync();

            if (users == null || users.Count == 0)
            {
                return;
            }

            foreach (var user in users)
            {
                try
                {
                    await ProcessUserNotificationsAsync(user, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error processing notifications for user {user.TelegramId}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in notification processing loop");
        }
    }

    private async Task ProcessUserNotificationsAsync(LinkedUser user, CancellationToken cancellationToken)
    {
        var notifications = await _apiService.GetAsync<NotificationsResponse>(
            $"/telegram/notifications/pending?telegram_id={user.TelegramId}&limit=50",
            user.TelegramId
        );

        if (notifications?.Notifications == null || notifications.Notifications.Count == 0)
        {
            return;
        }

        var sentIds = new List<string>();

        foreach (var notification in notifications.Notifications)
        {
            try
            {
                var message = FormatNotification(notification);
                await _botClient.SendMessageAsync(user.TelegramId, message, cancellationToken);
                sentIds.Add(notification.Id);

                // Небольшая задержка между сообщениями
                await Task.Delay(100, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error sending notification {notification.Id}");
            }
        }

        // Отмечаем уведомления как отправленные
        if (sentIds.Count > 0)
        {
            await _apiService.PostAsync(
                "/telegram/notifications/mark-sent",
                new { notification_ids = sentIds },
                user.TelegramId
            );
        }
    }

    private string FormatNotification(NotificationItem notification)
    {
        var icon = notification.Type switch
        {
            "grade" => "📊",
            "homework" => "📝",
            "event" => "📅",
            "message" => "💬",
            "announcement" => "📢",
            "attendance" => "✅",
            _ => "🔔"
        };

        var typeText = notification.Type switch
        {
            "grade" => "Новая оценка",
            "homework" => "Домашнее задание",
            "event" => "Событие",
            "message" => "Сообщение",
            "announcement" => "Объявление",
            "attendance" => "Посещаемость",
            _ => "Уведомление"
        };

        var time = DateTimeOffset.FromUnixTimeSeconds(notification.Timestamp)
            .ToLocalTime()
            .ToString("dd.MM.yyyy HH:mm");

        return $"{icon} *{typeText}*\n\n{notification.Content}\n\n🕐 {time}";
    }

    private async Task<List<LinkedUser>?> GetLinkedUsersAsync()
    {
        // Этот метод должен получать список всех связанных пользователей
        // В реальном приложении это может быть кэшировано
        return await _apiService.GetAsync<List<LinkedUser>>("/telegram/linked-users");
    }
}

// ============================================================================
// Services/QRCodeService.cs - Сервис QR-кодов
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Models;

namespace TeleKipish.Services;

public class QRCodeService
{
    private readonly ApiService _apiService;
    private readonly ILogger<QRCodeService> _logger;

    public QRCodeService(ApiService apiService, ILogger<QRCodeService> logger)
    {
        _apiService = apiService;
        _logger = logger;
    }

    public async Task<QRCodeInfo?> GenerateQRCodeAsync(long telegramId)
    {
        try
        {
            var linkInfo = await _apiService.GetAsync<LinkInfoResponse>(
                $"/telegram/link/info?telegram_id={telegramId}"
            );

            if (linkInfo?.UserId == null)
            {
                return null;
            }

            // Получаем текущее занятие преподавателя
            // Здесь можно добавить логику выбора занятия
            var response = await _apiService.PostAsync<QRCodeResponse>(
                "/telegram/qr/generate",
                new
                {
                    teacher_id = linkInfo.UserId,
                    lesson_id = "current", // Или конкретный ID
                    duration = 15 // минут
                },
                telegramId
            );

            if (response?.Token == null)
            {
                return null;
            }

            return new QRCodeInfo
            {
                Token = response.Token,
                ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(response.ExpiresAt).LocalDateTime,
                QrUrl = response.QrUrl
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating QR code");
            return null;
        }
    }

    public async Task<QRVerifyResult> VerifyQRCodeAsync(long telegramId, string token)
    {
        try
        {
            var linkInfo = await _apiService.GetAsync<LinkInfoResponse>(
                $"/telegram/link/info?telegram_id={telegramId}"
            );

            if (linkInfo?.UserId == null)
            {
                return new QRVerifyResult
                {
                    Success = false,
                    Message = "Аккаунт не связан"
                };
            }

            var response = await _apiService.PostAsync<QRVerifyResponse>(
                "/telegram/qr/verify",
                new
                {
                    token = token,
                    student_id = linkInfo.UserId
                },
                telegramId
            );

            if (response?.Success == true)
            {
                return new QRVerifyResult
                {
                    Success = true,
                    Subject = response.Subject,
                    Date = response.Date,
                    Time = response.Time,
                    Message = "Посещаемость отмечена"
                };
            }

            return new QRVerifyResult
            {
                Success = false,
                Message = response?.Error ?? "Неизвестная ошибка"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error verifying QR code");
            return new QRVerifyResult
            {
                Success = false,
                Message = "Ошибка при проверке QR-кода"
            };
        }
    }
}

// ============================================================================
// Models/*.cs - Модели данных
// ============================================================================
namespace TeleKipish.Models;

// Базовые ответы API
public class ApiResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
}

// Аутентификация
public class LinkStatusResponse
{
    public bool IsLinked { get; set; }
}

public class LinkInfoResponse
{
    public string? UserId { get; set; }
    public string? TelegramId { get; set; }
    public string? Username { get; set; }
}

public class LinkCompleteResponse : ApiResponse
{
    public string? UserId { get; set; }
    public string? TelegramId { get; set; }
}

public class TokenResponse
{
    public string? Token { get; set; }
    public long ExpiresAt { get; set; }
}

public class LinkResult
{
    public bool Success { get; set; }
    public string? UserId { get; set; }
    public string? Message { get; set; }
}

// Пользователи
public class LinkedUser
{
    public long TelegramId { get; set; }
    public string UserId { get; set; } = "";
    public string? Username { get; set; }
}

public class UserProfile
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string Email { get; set; } = "";
    public string FirstName { get; set; } = "";
    public string LastName { get; set; } = "";
    public string? MiddleName { get; set; }
    public List<string> Roles { get; set; } = new();
    public string CurrentRole { get; set; } = "";
    public List<Organization> Organizations { get; set; } = new();
    public List<Group> Groups { get; set; } = new();
}

public class Organization
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? ShortName { get; set; }
}

public class Group
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int Course { get; set; }
    public string? Specialty { get; set; }
    public string? OrganizationName { get; set; }
}

public class TeacherGroup
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public int StudentCount { get; set; }
    public string Organization { get; set; } = "";
}

public class TeacherGroupsResponse
{
    public List<TeacherGroup> Groups { get; set; } = new();
}

public class QuickStats
{
    public int TodayLessons { get; set; }
    public int PendingHomework { get; set; }
    public int NewGrades { get; set; }
    public int NewNotifications { get; set; }
}

// Расписание
public class ScheduleLesson
{
    public string Id { get; set; } = "";
    public string Date { get; set; } = "";
    public string StartTime { get; set; } = "";
    public string EndTime { get; set; } = "";
    public string Subject { get; set; } = "";
    public string Teacher { get; set; } = "";
    public string? Room { get; set; }
    public string? Building { get; set; }
    public string? Topic { get; set; }
    public string? Homework { get; set; }
    public string? LessonType { get; set; }
}

public class ScheduleResponse
{
    public List<ScheduleLesson> Schedule { get; set; } = new();
    public string Period { get; set; } = "";
    public string StartDate { get; set; } = "";
    public string EndDate { get; set; } = "";
}

// Домашние задания
public class HomeworkItem
{
    public string Id { get; set; } = "";
    public string Subject { get; set; } = "";
    public string SubjectCode { get; set; } = "";
    public string Date { get; set; } = "";
    public string Homework { get; set; } = "";
    public string? Topic { get; set; }
    public string? GroupName { get; set; }
}

public class HomeworkResponse
{
    public List<HomeworkItem> Homework { get; set; } = new();
}

// Оценки
public class Grade
{
    public string Id { get; set; } = "";
    public string Subject { get; set; } = "";
    public string SubjectCode { get; set; } = "";
    public string Value { get; set; } = "";
    public string Date { get; set; } = "";
    public string? Comment { get; set; }
    public string? Topic { get; set; }
    public string? TeacherName { get; set; }
}

public class GradesResponse
{
    public List<Grade> Grades { get; set; } = new();
    public double? Average { get; set; }
    public int Count { get; set; }
}

// Посещаемость
public class AttendanceEntry
{
    public string StudentId { get; set; } = "";
    public string Status { get; set; } = ""; // present, absent, late
    public string? Note { get; set; }
}

public class AttendanceStats
{
    public int Total { get; set; }
    public int Present { get; set; }
    public int Absent { get; set; }
    public int Late { get; set; }
    public double AttendanceRate { get; set; }
    public List<SubjectAttendance>? BySubject { get; set; }
}

public class SubjectAttendance
{
    public string Name { get; set; } = "";
    public int Total { get; set; }
    public int Present { get; set; }
    public int Absent { get; set; }
    public int Late { get; set; }
}

public class AttendanceStatsResponse
{
    public AttendanceStats Statistics { get; set; } = new();
    public List<AttendanceRecord> Records { get; set; } = new();
}

public class AttendanceRecord
{
    public string Status { get; set; } = "";
    public string Date { get; set; } = "";
    public string Subject { get; set; } = "";
    public string? Note { get; set; }
}

// События календаря
public class CalendarEvent
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Date { get; set; } = "";
    public string Time { get; set; } = "";
    public string? EndTime { get; set; }
    public string EventType { get; set; } = ""; // plan, task, lesson
}

public class CalendarResponse
{
    public List<CalendarEvent> Events { get; set; } = new();
    public int Total { get; set; }
}

// Уведомления
public class NotificationItem
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = ""; // grade, homework, event, message, announcement
    public string Content { get; set; } = "";
    public long Timestamp { get; set; }
    public bool IsRead { get; set; }
}

public class NotificationsResponse
{
    public List<NotificationItem> Notifications { get; set; } = new();
}

// QR-коды
public class QRCodeInfo
{
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public string QrUrl { get; set; } = "";
}

public class QRCodeResponse
{
    public string Token { get; set; } = "";
    public long ExpiresAt { get; set; }
    public string QrUrl { get; set; } = "";
}

public class QRVerifyResult
{
    public bool Success { get; set; }
    public string? Subject { get; set; }
    public string? Date { get; set; }
    public string? Time { get; set; }
    public string? Message { get; set; }
}

public class QRVerifyResponse : ApiResponse
{
    public string? Subject { get; set; }
    public string? Date { get; set; }
    public string? Time { get; set; }
    public string? AttendanceId { get; set; }
}

// ============================================================================
// Database/DatabaseService.cs - Локальная БД для кэширования
// ============================================================================
using Microsoft.Extensions.Logging;
using TeleKipish.Bot;

namespace TeleKipish.Database;

public class DatabaseService
{
    private readonly BotConfig _config;
    private readonly ILogger<DatabaseService> _logger;

    public DatabaseService(BotConfig config, ILogger<DatabaseService> logger)
    {
        _config = config;
        _logger = logger;
        InitializeDatabase();
    }

    private void InitializeDatabase()
    {
        // Здесь можно добавить инициализацию SQLite для локального кэширования
        // Например, для хранения настроек пользователей или кэша данных
        _logger.LogInformation("Database initialized");
    }

    // Методы для работы с локальной БД
    public async Task SaveUserSettingsAsync(long telegramId, Dictionary<string, object> settings)
    {
        // Реализация сохранения настроек
        await Task.CompletedTask;
    }

    public async Task<Dictionary<string, object>?> GetUserSettingsAsync(long telegramId)
    {
        // Реализация получения настроек
        await Task.CompletedTask;
        return null;
    }
}

// ============================================================================
// Helpers/Logger.cs - Логирование
// ============================================================================
namespace TeleKipish.Helpers;

public static class BotLogger
{
    public static void LogCommand(long userId, string command, bool success, string? error = null)
    {
        var status = success ? "✅" : "❌";
        Console.WriteLine($"{status} [{DateTime.Now:HH:mm:ss}] User {userId}: {command}");

        if (!success && error != null)
        {
            Console.WriteLine($"   Error: {error}");
        }
    }

    public static void LogNotification(long userId, string type, bool success)
    {
        var status = success ? "✅" : "❌";
        Console.WriteLine($"{status} [{DateTime.Now:HH:mm:ss}] Notification to {userId}: {type}");
    }

    public static void LogError(string context, Exception ex)
    {
        Console.WriteLine($"❌ [{DateTime.Now:HH:mm:ss}] ERROR in {context}:");
        Console.WriteLine($"   {ex.Message}");
        Console.WriteLine($"   {ex.StackTrace}");
    }
}

// ============================================================================
// README.md - Инструкция по запуску
// ============================================================================
/*
# TeleKipish - Telegram Bot для KipCalendar

## Требования
- .NET 8.0 SDK
- Telegram Bot Token
- Запущенный API KipCalendar (app_test.py)

## Установка

1. Установите зависимости:
```bash
dotnet restore
```

2. Настройте переменные окружения:
```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
```

Или измените в Bot/BotConfig.cs:
```csharp
public string BotToken { get; set; } = "YOUR_BOT_TOKEN_HERE";
```

3. Убедитесь, что API запущен на http://localhost:5000

## Запуск

```bash
dotnet run
```

## Структура проекта

```
TeleKipish/
├── Program.cs                 # Точка входа
├── Bot/
│   ├── BotClient.cs          # Основной клиент бота
│   ├── BotConfig.cs          # Конфигурация
│   ├── CommandHandler.cs     # Обработчик команд
│   └── BotHostedService.cs   # Фоновый сервис
├── Services/
│   ├── ApiService.cs         # Базовый API клиент
│   ├── AuthService.cs        # Аутентификация
│   ├── UserService.cs        # Пользователи
│   ├── EventService.cs       # События и расписание
│   ├── GradeService.cs       # Оценки
│   ├── AttendanceService.cs  # Посещаемость
│   ├── NotificationService.cs # Уведомления
│   └── QRCodeService.cs      # QR-коды
├── Models/
│   └── *.cs                  # Модели данных
├── Database/
│   └── DatabaseService.cs    # Локальная БД
└── Helpers/
    └── Logger.cs             # Логирование

## Основные команды бота

### Для всех пользователей:
- /start - Начало работы
- /link [код] - Связать аккаунт
- /help - Помощь
- /schedule - Расписание
- /homework - Домашние задания
- /grades - Оценки
- /attendance - Посещаемость
- /profile - Профиль
- /calendar - Календарь
- /settings - Настройки
- /unlink - Отвязать аккаунт

### Для преподавателей:
- /qr_attendance - Создать QR-код для посещаемости
- /groups - Список групп

### Для студентов:
- /scan [токен] - Отметить посещаемость через QR

## Функции

✅ Связывание аккаунта через 6-значный код
✅ Получение расписания занятий
✅ Просмотр домашних заданий
✅ Просмотр оценок
✅ Статистика посещаемости
✅ Календарь событий
✅ Уведомления в реальном времени
✅ QR-коды для отметки посещаемости
✅ Настройки уведомлений

## API Endpoints

Бот использует следующие API endpoints:
- /telegram/link/complete - Связывание аккаунта
- /telegram/unlink - Отвязка аккаунта
- /telegram/token/generate - Генерация токена
- /telegram/user/{id}/profile - Профиль пользователя
- /telegram/user/{id}/schedule - Расписание
- /telegram/user/{id}/homework - Домашние задания
- /telegram/user/{id}/grades - Оценки
- /telegram/user/{id}/attendance - Посещаемость
- /telegram/notifications/pending - Уведомления
- /telegram/qr/generate - Генерация QR
- /telegram/qr/verify - Проверка QR

## Логирование

Все действия пользователей логируются в консоль.
Формат: [время] User {id}: {action}

## Troubleshooting

1. Бот не запускается:
   - Проверьте BOT_TOKEN
   - Убедитесь, что .NET 8.0 установлен

2. Не работает связывание:
   - Проверьте, что API запущен
   - Проверьте код связывания

3. Не приходят уведомления:
   - Проверьте настройки уведомлений (/settings)
   - Проверьте логи API

## Лицензия
MIT
*/