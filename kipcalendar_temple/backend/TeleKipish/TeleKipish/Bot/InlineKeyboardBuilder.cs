using System;
using System.Collections.Generic;
using Telegram.Bot.Types.ReplyMarkups;

namespace TeleKipish.Bot
{
    public class InlineKeyboardBuilder
    {
        public InlineKeyboardMarkup CreateLanguageKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("🇷🇺 Русский", "language_ru"),
                    InlineKeyboardButton.WithCallbackData("🇺🇸 English", "language_en")
                }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateSettingsKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[] { InlineKeyboardButton.WithCallbackData("🔔 Уведомления", "settings_notifications") },
                new[] { InlineKeyboardButton.WithCallbackData("🌐 Язык", "settings_language") },
                new[] { InlineKeyboardButton.WithCallbackData("📱 Формат", "settings_format") },
                new[] { InlineKeyboardButton.WithCallbackData("🔕 Тихий режим", "settings_quiet") }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateScheduleKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("📅 Сегодня", "schedule_today"),
                    InlineKeyboardButton.WithCallbackData("📅 Завтра", "schedule_tomorrow")
                },
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("📅 Неделя", "schedule_week"),
                    InlineKeyboardButton.WithCallbackData("📅 Дата...", "schedule_date")
                }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateHomeworkKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[] { InlineKeyboardButton.WithCallbackData("📚 Текущие", "homework_current") },
                new[] { InlineKeyboardButton.WithCallbackData("⏰ С дедлайном", "homework_deadline") },
                new[] { InlineKeyboardButton.WithCallbackData("📖 По предмету", "homework_subject") }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateGradesKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[] { InlineKeyboardButton.WithCallbackData("⭐ Последние", "grades_recent") },
                new[] { InlineKeyboardButton.WithCallbackData("📊 Средние", "grades_average") },
                new[] { InlineKeyboardButton.WithCallbackData("📖 По предмету", "grades_subject") }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateCalendarKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[] { InlineKeyboardButton.WithCallbackData("📅 Сегодня", "calendar_today") },
                new[] { InlineKeyboardButton.WithCallbackData("📅 Завтра", "calendar_tomorrow") },
                new[] { InlineKeyboardButton.WithCallbackData("📅 Неделя", "calendar_week") },
                new[] { InlineKeyboardButton.WithCallbackData("📅 Все события", "calendar_all") }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateTeacherKeyboard()
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[] { InlineKeyboardButton.WithCallbackData("⭐ Оценка", "teacher_grade") },
                new[] { InlineKeyboardButton.WithCallbackData("✅ Посещаемость", "teacher_attendance") },
                new[] { InlineKeyboardButton.WithCallbackData("📚 ДЗ", "teacher_homework") },
                new[] { InlineKeyboardButton.WithCallbackData("📱 QR-код", "teacher_qr") }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateYesNoKeyboard(string callbackPrefix)
        {
            var buttons = new List<InlineKeyboardButton[]>
            {
                new[]
                {
                    InlineKeyboardButton.WithCallbackData("✅ Да", $"{callbackPrefix}_yes"),
                    InlineKeyboardButton.WithCallbackData("❌ Нет", $"{callbackPrefix}_no")
                }
            };

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreatePaginationKeyboard(int currentPage, int totalPages, string callbackPrefix)
        {
            var buttons = new List<InlineKeyboardButton[]>();
            var row = new List<InlineKeyboardButton>();

            if (currentPage > 1)
            {
                row.Add(InlineKeyboardButton.WithCallbackData("◀️", $"{callbackPrefix}_page_{currentPage - 1}"));
            }

            row.Add(InlineKeyboardButton.WithCallbackData($"{currentPage}/{totalPages}", $"{callbackPrefix}_current"));

            if (currentPage < totalPages)
            {
                row.Add(InlineKeyboardButton.WithCallbackData("▶️", $"{callbackPrefix}_page_{currentPage + 1}"));
            }

            buttons.Add(row.ToArray());
            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateListKeyboard<T>(List<T> items, string callbackPrefix, int page = 1, int pageSize = 10)
        {
            var buttons = new List<InlineKeyboardButton[]>();
            var startIndex = (page - 1) * pageSize;
            var endIndex = Math.Min(startIndex + pageSize, items.Count);

            for (int i = startIndex; i < endIndex; i++)
            {
                var item = items[i];
                var buttonText = item?.ToString() ?? $"Элемент {i + 1}";
                var callbackData = $"{callbackPrefix}_{i}";

                buttons.Add(new[] { InlineKeyboardButton.WithCallbackData(buttonText, callbackData) });
            }

            // Add pagination if needed
            var totalPages = (int)Math.Ceiling((double)items.Count / pageSize);
            if (totalPages > 1)
            {
                var paginationRow = new List<InlineKeyboardButton>();

                if (page > 1)
                {
                    paginationRow.Add(InlineKeyboardButton.WithCallbackData("◀️", $"{callbackPrefix}_page_{page - 1}"));
                }

                paginationRow.Add(InlineKeyboardButton.WithCallbackData($"{page}/{totalPages}", $"{callbackPrefix}_current"));

                if (page < totalPages)
                {
                    paginationRow.Add(InlineKeyboardButton.WithCallbackData("▶️", $"{callbackPrefix}_page_{page + 1}"));
                }

                buttons.Add(paginationRow.ToArray());
            }

            return new InlineKeyboardMarkup(buttons);
        }

        public InlineKeyboardMarkup CreateMainMenuKeyboard(string userRole)
        {
            var buttons = new List<InlineKeyboardButton[]>();

            // Common buttons
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("📅 Расписание", "menu_schedule"),
                InlineKeyboardButton.WithCallbackData("📚 ДЗ", "menu_homework")
            });

            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("⭐ Оценки", "menu_grades"),
                InlineKeyboardButton.WithCallbackData("✅ Посещаемость", "menu_attendance")
            });

            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("📅 Календарь", "menu_calendar"),
                InlineKeyboardButton.WithCallbackData("👤 Профиль", "menu_profile")
            });

            // Role-specific buttons
            if (userRole == "teacher")
            {
                buttons.Add(new[] { InlineKeyboardButton.WithCallbackData("👨‍🏫 Панель преподавателя", "menu_teacher") });
            }
            else if (userRole == "admin")
            {
                buttons.Add(new[] { InlineKeyboardButton.WithCallbackData("🔧 Панель администратора", "menu_admin") });
            }

            // Settings and help
            buttons.Add(new[]
            {
                InlineKeyboardButton.WithCallbackData("⚙️ Настройки", "menu_settings"),
                InlineKeyboardButton.WithCallbackData("❓ Помощь", "menu_help")
            });

            return new InlineKeyboardMarkup(buttons);
        }
    }
}