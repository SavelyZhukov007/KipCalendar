"""
KipCalendar Telegram Bot - Full Featured Version
Поддерживает: уведомления, расписание, управление
"""

import logging
import requests
import time
import asyncio
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    CallbackQueryHandler,
)

# Настройки
BOT_TOKEN = "8203438312:AAEN9v-l6WqatovB6JxHjU2iCzbLn_TikN8"
BACKEND_URL = "http://127.0.0.1:5000"

# Логирование
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Хранилище связанных пользователей
linked_users = {}  # telegram_id -> user_id


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    telegram_id = str(update.effective_user.id)
    username = update.effective_user.username or "User"

    message = f"""
👋 Привет, {username}!

Я бот KipCalendar. Я могу:
📚 Присылать уведомления о новых оценках
📝 Напоминать о домашних заданиях  
📅 Показывать твоё расписание
💬 Уведомлять о новых сообщениях

🔗 Для начала работы привяжите свой аккаунт:

1. Войдите в KipCalendar на сайте
2. Откройте Профиль
3. Нажмите "Подключить Telegram"
4. Скопируйте 6-значный код
5. Отправьте мне: /link КОД

Доступные команды:
/link <код> - привязать аккаунт
/unlink - отвязать аккаунт
/status - проверить статус
/schedule - моё расписание
/grades - мои оценки
/homework - домашние задания
/help - помощь
"""

    await update.message.reply_text(message)


async def link_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /link <код>"""
    telegram_id = str(update.effective_user.id)

    if not context.args:
        await update.message.reply_text(
            "❌ Использование: /link КОД\n\n"
            "Получите код в профиле на сайте KipCalendar."
        )
        return

    code = context.args[0].strip()

    # Проверяем формат кода
    if not (code.isdigit() and len(code) == 6):
        await update.message.reply_text(
            "❌ Неверный формат кода. Код должен содержать 6 цифр."
        )
        return

    try:
        response = requests.post(
            f"{BACKEND_URL}/api/telegram/verify-code",
            json={"code": code, "telegram_id": telegram_id},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            user_id = data.get("user_id")
            username = data.get("username")

            linked_users[telegram_id] = user_id

            await update.message.reply_text(
                f"✅ Аккаунт успешно привязан!\n\n"
                f"Пользователь: @{username}\n\n"
                f"Теперь вы будете получать уведомления от KipCalendar.\n\n"
                f"Используйте /schedule для просмотра расписания."
            )
            logger.info(f"Linked: telegram_id={telegram_id}, user_id={user_id}")
        else:
            error_data = response.json()
            error_msg = error_data.get("error", "Неизвестная ошибка")

            if "expired" in error_msg.lower():
                await update.message.reply_text(
                    "❌ Код истёк. Сгенерируйте новый код в профиле."
                )
            elif "invalid" in error_msg.lower():
                await update.message.reply_text(
                    "❌ Неверный код. Проверьте правильность ввода."
                )
            else:
                await update.message.reply_text(f"❌ Ошибка: {error_msg}")

    except requests.exceptions.Timeout:
        await update.message.reply_text(
            "❌ Превышено время ожидания. Попробуйте позже."
        )
    except requests.exceptions.ConnectionError:
        await update.message.reply_text(
            "❌ Не удалось связаться с сервером. Попробуйте позже."
        )
    except Exception as e:
        logger.error(f"Link error: {e}")
        await update.message.reply_text("❌ Произошла ошибка при привязке аккаунта.")


async def unlink_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /unlink"""
    telegram_id = str(update.effective_user.id)

    try:
        response = requests.post(
            f"{BACKEND_URL}/api/telegram/unlink",
            json={"telegram_id": telegram_id},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            if telegram_id in linked_users:
                del linked_users[telegram_id]

            await update.message.reply_text(
                "✅ Аккаунт отвязан.\n\n" "Вы больше не будете получать уведомления."
            )
            logger.info(f"Unlinked: telegram_id={telegram_id}")
        else:
            await update.message.reply_text("❌ Ошибка при отвязке аккаунта.")

    except Exception as e:
        logger.error(f"Unlink error: {e}")
        await update.message.reply_text("❌ Ошибка при отвязке аккаунта.")


async def check_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /status"""
    telegram_id = str(update.effective_user.id)

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("linked"):
                await update.message.reply_text(
                    f"📊 Статус:\n\n"
                    f"✅ Аккаунт привязан\n"
                    f"Пользователь: @{data['username']}\n"
                    f"User ID: `{data['user_id']}`\n"
                    f"Уведомления: Включены",
                    parse_mode="Markdown",
                )
            else:
                await update.message.reply_text(
                    "📊 Статус:\n\n"
                    "❌ Аккаунт не привязан\n\n"
                    "Используйте /link для привязки."
                )
        else:
            await update.message.reply_text("❌ Ошибка проверки статуса.")

    except Exception as e:
        logger.error(f"Status check error: {e}")
        await update.message.reply_text("❌ Не удалось проверить статус.")


async def get_schedule(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /schedule - показать расписание"""
    telegram_id = str(update.effective_user.id)

    try:
        # Проверяем привязку
        status_response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )

        if status_response.status_code != 200 or not status_response.json().get(
            "linked"
        ):
            await update.message.reply_text(
                "❌ Аккаунт не привязан. Используйте /link для привязки."
            )
            return

        user_id = status_response.json()["user_id"]

        # Получаем расписание на неделю
        today = datetime.now()
        start_date = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=6 - today.weekday())).strftime("%Y-%m-%d")

        response = requests.get(
            f"{BACKEND_URL}/api/calendar/user/{user_id}?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": context.user_data.get("token", "")},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            events = data.get("events", [])

            # Фильтруем только занятия
            lessons = [e for e in events if e.get("event_type") == "lesson"]

            if not lessons:
                await update.message.reply_text(
                    "📅 Расписание на эту неделю пока не загружено."
                )
                return

            # Группируем по дням
            schedule_text = "📅 **Расписание на неделю:**\n\n"

            days_dict = {}
            for lesson in lessons:
                date = lesson["date"]
                if date not in days_dict:
                    days_dict[date] = []
                days_dict[date].append(lesson)

            day_names = [
                "Понедельник",
                "Вторник",
                "Среда",
                "Четверг",
                "Пятница",
                "Суббота",
                "Воскресенье",
            ]

            for date_str in sorted(days_dict.keys()):
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                day_name = day_names[date_obj.weekday()]

                schedule_text += f"**{day_name}, {date_obj.strftime('%d.%m')}**\n"

                for lesson in sorted(days_dict[date_str], key=lambda x: x["time"]):
                    schedule_text += f"  ⏰ {lesson['time']} - {lesson['title']}\n"

                schedule_text += "\n"

            await update.message.reply_text(schedule_text, parse_mode="Markdown")
        else:
            await update.message.reply_text("❌ Ошибка получения расписания.")

    except Exception as e:
        logger.error(f"Schedule error: {e}")
        await update.message.reply_text("❌ Ошибка получения расписания.")


async def get_grades(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /grades - показать последние оценки"""
    telegram_id = str(update.effective_user.id)

    try:
        # Проверяем привязку
        status_response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )

        if status_response.status_code != 200 or not status_response.json().get(
            "linked"
        ):
            await update.message.reply_text(
                "❌ Аккаунт не привязан. Используйте /link для привязки."
            )
            return

        user_id = status_response.json()["user_id"]

        # Получаем сводку журнала
        response = requests.get(
            f"{BACKEND_URL}/api/journal/student/{user_id}/summary",
            headers={"Authorization": context.user_data.get("token", "")},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            subjects = data.get("subjects", [])

            if not subjects:
                await update.message.reply_text("📚 Оценки пока не выставлены.")
                return

            grades_text = "📚 **Мои оценки:**\n\n"

            for subject in subjects:
                grades_text += f"**{subject['subject_name']}**\n"

                if subject["marks_count"] > 0:
                    marks = subject["marks"][-5:]  # Последние 5 оценок
                    marks_str = ", ".join([m["value"] for m in marks])
                    grades_text += f"  Оценки: {marks_str}\n"

                    if subject["average_mark"]:
                        grades_text += f"  Средняя: {subject['average_mark']}\n"
                else:
                    grades_text += "  Оценок пока нет\n"

                grades_text += "\n"

            await update.message.reply_text(grades_text, parse_mode="Markdown")
        else:
            await update.message.reply_text("❌ Ошибка получения оценок.")

    except Exception as e:
        logger.error(f"Grades error: {e}")
        await update.message.reply_text("❌ Ошибка получения оценок.")


async def get_homework(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /homework - показать домашние задания"""
    telegram_id = str(update.effective_user.id)

    try:
        # Проверяем привязку
        status_response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )

        if status_response.status_code != 200 or not status_response.json().get(
            "linked"
        ):
            await update.message.reply_text(
                "❌ Аккаунт не привязан. Используйте /link для привязки."
            )
            return

        user_id = status_response.json()["user_id"]

        # Получаем занятия с домашними заданиями
        today = datetime.now().strftime("%Y-%m-%d")

        response = requests.get(
            f"{BACKEND_URL}/api/homework/student/{user_id}?from_date={today}",
            headers={"Authorization": context.user_data.get("token", "")},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            homework_list = data.get("homework", [])

            if not homework_list:
                await update.message.reply_text("📝 Домашних заданий пока нет.")
                return

            hw_text = "📝 **Домашние задания:**\n\n"

            for hw in homework_list[:10]:  # Первые 10
                hw_text += f"**{hw['subject_name']}**\n"
                hw_text += f"  {hw['homework']}\n"
                hw_text += f"  📅 Срок: {hw['date']}\n\n"

            await update.message.reply_text(hw_text, parse_mode="Markdown")
        else:
            await update.message.reply_text("❌ Ошибка получения домашних заданий.")

    except Exception as e:
        logger.error(f"Homework error: {e}")
        await update.message.reply_text("❌ Ошибка получения домашних заданий.")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help"""
    help_text = """
📖 **Доступные команды:**

**Управление аккаунтом:**
/start - начать работу с ботом
/link <код> - привязать KipCalendar аккаунт
/unlink - отвязать аккаунт
/status - проверить статус подключения

**Информация:**
/schedule - моё расписание на неделю
/grades - мои оценки
/homework - домашние задания
/help - показать это сообщение

❓ **Как привязать аккаунт:**
1. Войдите на KipCalendar
2. Откройте Профиль
3. Нажмите "Подключить Telegram"
4. Скопируйте 6-значный код
5. Отправьте: /link КОД

💡 После привязки вы будете автоматически получать уведомления о:
• 📚 Новых оценках
• 📝 Домашних заданиях
• 📅 Событиях и мероприятиях
• 💬 Новых сообщениях
"""
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка текстовых сообщений"""
    text = update.message.text

    # Проверяем, это 6-значный код для линковки
    if text.isdigit() and len(text) == 6:
        await update.message.reply_text(f"Используйте команду: /link {text}")
    else:
        await update.message.reply_text("Используйте /help для списка команд.")


def main():
    """Запуск бота"""
    logger.info("Starting KipCalendar Telegram Bot...")

    # Создаём приложение
    application = Application.builder().token(BOT_TOKEN).build()

    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("link", link_account))
    application.add_handler(CommandHandler("unlink", unlink_account))
    application.add_handler(CommandHandler("status", check_status))
    application.add_handler(CommandHandler("schedule", get_schedule))
    application.add_handler(CommandHandler("grades", get_grades))
    application.add_handler(CommandHandler("homework", get_homework))
    application.add_handler(CommandHandler("help", help_command))

    # Обработчик текстовых сообщений
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    # Запускаем бота
    logger.info("Bot started! Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
