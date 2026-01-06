using Newtonsoft.Json;

namespace TeleKipish.Bot
{
    public class LocalizationService
    {
        private readonly Dictionary<string, Dictionary<string, string>> _translations;

        public LocalizationService()
        {
            _translations = LoadTranslations();
        }

        public string GetTranslation(string key, string language = "ru")
        {
            if (_translations.ContainsKey(key) && _translations[key].ContainsKey(language))
            {
                return _translations[key][language];
            }

            // Fallback to Russian
            if (_translations.ContainsKey(key) && _translations[key].ContainsKey("ru"))
            {
                return _translations[key]["ru"];
            }

            return key; // Return key itself if no translation found
        }

        public string GetRoleBasedHelp(string role, string language = "ru")
        {
            var helpText = GetTranslation("help.title", language) + "\n\n";

            switch (role)
            {
                case "student":
                    helpText += GetTranslation("help.student.commands", language) + "\n";
                    helpText += GetTranslation("help.student.description", language);
                    break;

                case "teacher":
                    helpText += GetTranslation("help.teacher.commands", language) + "\n";
                    helpText += GetTranslation("help.teacher.description", language);
                    break;

                case "admin":
                    helpText += GetTranslation("help.admin.commands", language) + "\n";
                    helpText += GetTranslation("help.admin.description", language);
                    break;

                default:
                    helpText += GetTranslation("help.basic", language);
                    break;
            }

            return helpText;
        }

        public List<string> GetAvailableLanguages()
        {
            return new List<string> { "ru", "en" };
        }

        private Dictionary<string, Dictionary<string, string>> LoadTranslations()
        {
            // In a real application, this would load from JSON files or database
            // For now, we'll define translations inline

            return new Dictionary<string, Dictionary<string, string>>
            {
                ["welcome"] = new()
                {
                    ["ru"] = "👋 Добро пожаловать в KipCalendar Bot!",
                    ["en"] = "👋 Welcome to KipCalendar Bot!"
                },

                ["link_instructions"] = new()
                {
                    ["ru"] = "Для начала работы необходимо связать ваш аккаунт KipCalendar с Telegram.\n\n" +
                            "1. Перейдите в веб-приложение KipCalendar\n" +
                            "2. Откройте настройки профиля\n" +
                            "3. Найдите раздел 'Telegram бот'\n" +
                            "4. Введите код: `{code}`\n\n" +
                            "Код действителен 10 минут.",
                    ["en"] = "To get started, you need to link your KipCalendar account with Telegram.\n\n" +
                            "1. Go to KipCalendar web application\n" +
                            "2. Open profile settings\n" +
                            "3. Find 'Telegram bot' section\n" +
                            "4. Enter code: `{code}`\n\n" +
                            "Code is valid for 10 minutes."
                },

                ["error.not_linked"] = new()
                {
                    ["ru"] = "❌ Ваш аккаунт не связан с KipCalendar.\nИспользуйте /start для получения кода связывания.",
                    ["en"] = "❌ Your account is not linked to KipCalendar.\nUse /start to get a link code."
                },

                ["error.unknown_command"] = new()
                {
                    ["ru"] = "❌ Неизвестная команда. Используйте /help для списка доступных команд.",
                    ["en"] = "❌ Unknown command. Use /help for list of available commands."
                },

                ["error.general"] = new()
                {
                    ["ru"] = "❌ Произошла ошибка. Пожалуйста, попробуйте позже.",
                    ["en"] = "❌ An error occurred. Please try again later."
                },

                ["error.user_not_found"] = new()
                {
                    ["ru"] = "❌ Пользователь не найден.",
                    ["en"] = "❌ User not found."
                },

                ["help.title"] = new()
                {
                    ["ru"] = "📚 Доступные команды:",
                    ["en"] = "📚 Available commands:"
                },

                ["help.basic"] = new()
                {
                    ["ru"] = "Основные команды:\n" +
                            "/start - Начать работу с ботом\n" +
                            "/help - Показать эту справку\n" +
                            "/schedule - Расписание занятий\n" +
                            "/homework - Домашние задания\n" +
                            "/grades - Оценки\n" +
                            "/attendance - Посещаемость\n" +
                            "/calendar - Календарь событий\n" +
                            "/profile - Профиль пользователя\n" +
                            "/settings - Настройки\n" +
                            "/language - Сменить язык",
                    ["en"] = "Basic commands:\n" +
                            "/start - Start working with bot\n" +
                            "/help - Show this help\n" +
                            "/schedule - Class schedule\n" +
                            "/homework - Homework\n" +
                            "/grades - Grades\n" +
                            "/attendance - Attendance\n" +
                            "/calendar - Event calendar\n" +
                            "/profile - User profile\n" +
                            "/settings - Settings\n" +
                            "/language - Change language"
                },

                // ... много других переводов ...

                ["profile.title"] = new()
                {
                    ["ru"] = "👤 Профиль пользователя",
                    ["en"] = "👤 User Profile"
                },

                ["settings.title"] = new()
                {
                    ["ru"] = "⚙️ Настройки",
                    ["en"] = "⚙️ Settings"
                },

                ["settings.options"] = new()
                {
                    ["ru"] = "Настройте получение уведомлений и другие параметры:",
                    ["en"] = "Configure notifications and other settings:"
                },

                ["feedback.instructions"] = new()
                {
                    ["ru"] = "💬 Отправьте ваше сообщение с отзывом, предложением или сообщением об ошибке.\n" +
                            "Просто напишите его после команды /feedback",
                    ["en"] = "💬 Send your feedback, suggestion or error report.\n" +
                            "Just write it after /feedback command"
                },

                ["language.title"] = new()
                {
                    ["ru"] = "🌐 Выбор языка",
                    ["en"] = "🌐 Language Selection"
                },

                ["language.options"] = new()
                {
                    ["ru"] = "Выберите язык:",
                    ["en"] = "Choose language:"
                },

                ["language.changed"] = new()
                {
                    ["ru"] = "✅ Язык изменен на русский",
                    ["en"] = "✅ Language changed to English"
                },

                ["error.qr_generation"] = new()
                {
                    ["ru"] = "❌ Ошибка генерации QR-кода",
                    ["en"] = "❌ QR code generation error"
                },

                ["qr_generated"] = new()
                {
                    ["ru"] = "✅ QR-код для отметки посещаемости сгенерирован",
                    ["en"] = "✅ QR code for attendance marking generated"
                },

                ["scan.instructions"] = new()
                {
                    ["ru"] = "📱 Используйте: /scan [код]\nили отсканируйте QR-код",
                    ["en"] = "📱 Use: /scan [code]\nor scan QR code"
                },

                ["scan.success"] = new()
                {
                    ["ru"] = "✅ Посещаемость отмечена успешно!",
                    ["en"] = "✅ Attendance marked successfully!"
                },

                ["scan.error"] = new()
                {
                    ["ru"] = "❌ Не удалось отметить посещаемость. Проверьте код и попробуйте снова.",
                    ["en"] = "❌ Failed to mark attendance. Check the code and try again."
                },

                ["admin_stats.title"] = new()
                {
                    ["ru"] = "📊 Статистика бота",
                    ["en"] = "📊 Bot Statistics"
                },

                ["admin_users.title"] = new()
                {
                    ["ru"] = "👥 Активные пользователи",
                    ["en"] = "👥 Active Users"
                },

                ["admin_broadcast.instructions"] = new()
                {
                    ["ru"] = "📢 Используйте: /admin_broadcast [сообщение]\nдля рассылки всем пользователям",
                    ["en"] = "📢 Use: /admin_broadcast [message]\nto broadcast to all users"
                },

                ["admin_broadcast.sent"] = new()
                {
                    ["ru"] = "✅ Сообщение отправлено:\n{message}",
                    ["en"] = "✅ Message sent:\n{message}"
                },

                ["search.instructions"] = new()
                {
                    ["ru"] = "🔍 Используйте: /search [запрос]\nдля поиска студентов, преподавателей или предметов",
                    ["en"] = "🔍 Use: /search [query]\nto search for students, teachers or subjects"
                },

                ["search.results"] = new()
                {
                    ["ru"] = "🔍 Результаты поиска для '{query}':",
                    ["en"] = "🔍 Search results for '{query}':"
                },

                ["export.instructions"] = new()
                {
                    ["ru"] = "📤 Используйте веб-приложение KipCalendar для экспорта данных",
                    ["en"] = "📤 Use KipCalendar web application for data export"
                },

                ["help.student.commands"] = new()
                {
                    ["ru"] = "📚 Основные команды:\n" +
                            "/schedule - Расписание (сегодня, завтра, неделя)\n" +
                            "/homework - Домашние задания\n" +
                            "/grades - Оценки\n" +
                            "/attendance - Посещаемость\n" +
                            "/calendar - События\n" +
                            "/profile - Профиль\n" +
                            "/scan - Отметить посещаемость по QR-коду",
                    ["en"] = "📚 Basic commands:\n" +
                            "/schedule - Schedule (today, tomorrow, week)\n" +
                            "/homework - Homework\n" +
                            "/grades - Grades\n" +
                            "/attendance - Attendance\n" +
                            "/calendar - Events\n" +
                            "/profile - Profile\n" +
                            "/scan - Mark attendance via QR code"
                },

                ["help.student.description"] = new()
                {
                    ["ru"] = "\n\n💡 Примеры:\n" +
                            "/schedule today - расписание на сегодня\n" +
                            "/grades recent 10 - последние 10 оценок\n" +
                            "/homework week - задания на неделю",
                    ["en"] = "\n\n💡 Examples:\n" +
                            "/schedule today - schedule for today\n" +
                            "/grades recent 10 - last 10 grades\n" +
                            "/homework week - assignments for the week"
                },

                ["help.teacher.commands"] = new()
                {
                    ["ru"] = "👨‍🏫 Команды преподавателя:\n" +
                            "/grade - Выставить оценку\n" +
                            "/attendance_mark - Отметить посещаемость\n" +
                            "/homework_assign - Назначить домашнее задание\n" +
                            "/qr_attendance - Сгенерировать QR-код\n" +
                            "/groups - Список групп\n" +
                            "/stats - Статистика по предмету",
                    ["en"] = "👨‍🏫 Teacher commands:\n" +
                            "/grade - Add grade\n" +
                            "/attendance_mark - Mark attendance\n" +
                            "/homework_assign - Assign homework\n" +
                            "/qr_attendance - Generate QR code\n" +
                            "/groups - List of groups\n" +
                            "/stats - Subject statistics"
                },

                ["help.teacher.description"] = new()
                {
                    ["ru"] = "\n\n💡 Примеры:\n" +
                            "/grade группа предмет студент оценка\n" +
                            "/qr_attendance - создать QR для отметки",
                    ["en"] = "\n\n💡 Examples:\n" +
                            "/grade group subject student grade\n" +
                            "/qr_attendance - create QR for marking"
                },

                ["help.admin.commands"] = new()
                {
                    ["ru"] = "🔧 Команды администратора:\n" +
                            "/admin_stats - Статистика использования\n" +
                            "/admin_users - Управление пользователями\n" +
                            "/admin_broadcast - Рассылка сообщений",
                    ["en"] = "🔧 Admin commands:\n" +
                            "/admin_stats - Usage statistics\n" +
                            "/admin_users - User management\n" +
                            "/admin_broadcast - Broadcast messages"
                },

                ["help.admin.description"] = new()
                {
                    ["ru"] = "\n\n💡 Примеры:\n" +
                            "/admin_broadcast Важное объявление\n" +
                            "/admin_stats - статистика бота",
                    ["en"] = "\n\n💡 Examples:\n" +
                            "/admin_broadcast Important announcement\n" +
                            "/admin_stats - bot statistics"
                },

                ["grade.instructions"] = new()
                {
                    ["ru"] = "⭐ Используйте: /grade [группа] [предмет] [студент] [оценка] [комментарий]\n" +
                            "Пример: /grade ИС-21 Математика Иванов 5 Отлично!",
                    ["en"] = "⭐ Use: /grade [group] [subject] [student] [grade] [comment]\n" +
                            "Example: /grade CS-21 Mathematics Ivanov 5 Excellent!"
                },

                ["attendance_mark.instructions"] = new()
                {
                    ["ru"] = "✅ Используйте веб-приложение или QR-код для отметки посещаемости",
                    ["en"] = "✅ Use web application or QR code for attendance marking"
                },

                ["homework_assign.instructions"] = new()
                {
                    ["ru"] = "📚 Используйте: /homework_assign [группа] [предмет] [описание задания]\n" +
                            "Пример: /homework_assign ИС-21 Математика Решить задачи 1-10",
                    ["en"] = "📚 Use: /homework_assign [group] [subject] [assignment description]\n" +
                            "Example: /homework_assign CS-21 Mathematics Solve problems 1-10"
                },

                ["groups.instructions"] = new()
                {
                    ["ru"] = "👥 Список ваших групп будет отображен здесь",
                    ["en"] = "👥 List of your groups will be displayed here"
                },

                ["stats.instructions"] = new()
                {
                    ["ru"] = "📊 Статистика по вашим предметам будет отображена здесь",
                    ["en"] = "📊 Statistics for your subjects will be displayed here"
                }
            };
        }
    }
}