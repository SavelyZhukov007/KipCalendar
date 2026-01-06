namespace TeleKipish.Helpers
{
    public class DateTimeHelper
    {
        public static DateTime GetStartOfWeek(DateTime date)
        {
            var diff = date.DayOfWeek - DayOfWeek.Monday;
            if (diff < 0)
                diff += 7;
            return date.AddDays(-1 * diff).Date;
        }

        public static DateTime GetEndOfWeek(DateTime date)
        {
            return GetStartOfWeek(date).AddDays(6).AddHours(23).AddMinutes(59).AddSeconds(59);
        }

        public static string FormatDate(DateTime date, string language = "ru")
        {
            return language switch
            {
                "en" => date.ToString("dddd, MMMM d, yyyy"),
                _ => date.ToString("dddd, d MMMM yyyy", new System.Globalization.CultureInfo("ru-RU"))
            };
        }

        public static string FormatTime(DateTime date, string language = "ru")
        {
            return language switch
            {
                "en" => date.ToString("h:mm tt"),
                _ => date.ToString("HH:mm")
            };
        }

        public static string FormatDateTime(DateTime date, string language = "ru")
        {
            return $"{FormatDate(date, language)} {FormatTime(date, language)}";
        }

        public static string FormatTimeSpan(TimeSpan timeSpan, string language = "ru")
        {
            if (timeSpan.TotalDays >= 1)
            {
                var days = (int)timeSpan.TotalDays;
                return language == "en" ? $"{days} day{(days != 1 ? "s" : "")}" : $"{days} день{(GetRussianDayEnding(days))}";
            }
            else if (timeSpan.TotalHours >= 1)
            {
                var hours = (int)timeSpan.TotalHours;
                return language == "en" ? $"{hours} hour{(hours != 1 ? "s" : "")}" : $"{hours} час{(GetRussianHourEnding(hours))}";
            }
            else
            {
                var minutes = (int)timeSpan.TotalMinutes;
                return language == "en" ? $"{minutes} minute{(minutes != 1 ? "s" : "")}" : $"{minutes} минут{(GetRussianMinuteEnding(minutes))}";
            }
        }

        private static string GetRussianDayEnding(int days)
        {
            if (days % 10 == 1 && days % 100 != 11) return "";
            if (days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20)) return "а";
            return "ей";
        }

        private static string GetRussianHourEnding(int hours)
        {
            if (hours % 10 == 1 && hours % 100 != 11) return "";
            if (hours % 10 >= 2 && hours % 10 <= 4 && (hours % 100 < 10 || hours % 100 >= 20)) return "а";
            return "ов";
        }

        private static string GetRussianMinuteEnding(int minutes)
        {
            if (minutes % 10 == 1 && minutes % 100 != 11) return "а";
            if (minutes % 10 >= 2 && minutes % 10 <= 4 && (minutes % 100 < 10 || minutes % 100 >= 20)) return "ы";
            return "";
        }

        public static bool IsWithinQuietMode(TimeSpan? quietStart, TimeSpan? quietEnd)
        {
            if (!quietStart.HasValue || !quietEnd.HasValue)
                return false;

            var now = DateTime.Now.TimeOfDay;

            if (quietStart <= quietEnd)
            {
                // Quiet mode within same day
                return now >= quietStart && now <= quietEnd;
            }
            else
            {
                // Quiet mode spans midnight
                return now >= quietStart || now <= quietEnd;
            }
        }
    }
}