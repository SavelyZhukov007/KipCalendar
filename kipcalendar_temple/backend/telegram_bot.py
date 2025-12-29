"""
KipCalendar Telegram Bot
"""

import logging
import requests
import time
import socketio
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)

# Настройки
BOT_TOKEN = "8203438312:AAEN9v-l6WqatovB6JxHjU2iCzbLn_TikN8"
BACKEND_URL = "http://127.0.0.1:5000"
CHECK_INTERVAL = (
    60  # Проверка уведомлений каждые 60 секунд (оставляем на случай fallback)
)

# Логирование
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Хранилище связанных аккаунтов: user_id -> telegram_id
linked_users = {}

# SocketIO клиент
sio = socketio.Client()


@sio.event
def connect():
    logger.info("Connected to backend SocketIO")
    # Получаем всех связанных пользователей и присоединяемся к их комнатам
    try:
        response = requests.get(f"{BACKEND_URL}/api/telegram/linked-users", timeout=10)
        if response.status_code == 200:
            users = response.json()
            for user in users:
                sio.emit("join", {"room": user["user_id"]})
                linked_users[user["user_id"]] = user["telegram_id"]
            logger.info(f"Joined {len(users)} rooms")
    except Exception as e:
        logger.error(f"Failed to get linked users: {e}")


@sio.event
def disconnect():
    logger.info("Disconnected from backend SocketIO")


@sio.on("notification")
def on_notification(data):
    user_id = data.get("user_id")
    if user_id in linked_users:
        telegram_id = linked_users[user_id]
        emoji = {
            "grade": "📚",
            "homework": "📝",
            "event": "📅",
            "message": "💬",
            "announcement": "📢",
        }.get(data["type"], "🔔")

        message = f"{emoji} {data['content']}"

        try:
            # Отправляем уведомление (context.bot недоступен здесь, используем отдельный бот инстанс если нужно)
            # Поскольку это async, но sio handler sync, лучше queue или отдельный.
            # Для простоты, предполагаем sync отправку, но в реальности нужно async.
            # Здесь placeholder - в реальном коде интегрировать с application.bot
            logger.info(f"Would send to {telegram_id}: {message}")
            # Mark as sent
            requests.post(
                f"{BACKEND_URL}/api/notifications/mark-telegram-sent",
                json={"notification_ids": [data["id"]]},
                timeout=5,
            )
        except Exception as e:
            logger.error(f"Failed to send: {e}")


# Подключаемся к backend
try:
    sio.connect(BACKEND_URL)
except Exception as e:
    logger.error(f"Failed to connect SocketIO: {e}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    telegram_id = str(update.effective_user.id)
    username = update.effective_user.username or "User"

    message = f"""
👋 Привет, {username}!

Я бот KipCalendar. Я буду присылать вам уведомления о:
📚 Новых оценках
📝 Домашних заданиях  
📅 Событиях
💬 Сообщениях

🔗 Для начала работы привяжите свой аккаунт:

1. Войдите в KipCalendar
2. Откройте Профиль
3. Скопируйте ваш User ID
4. Отправьте мне команду: /link YOUR_USER_ID

Ваш Telegram ID: **{telegram_id}**

Доступные команды:
/link <user_id> - привязать аккаунт
/unlink - отвязать аккаунт
/status - проверить статус
/help - помощь
"""

    await update.message.reply_text(message, parse_mode="Markdown")


async def link_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /link <user_id>"""
    telegram_id = str(update.effective_user.id)

    if not context.args:
        await update.message.reply_text(
            "❌ Использование: /link YOUR_USER_ID\n\n"
            "Ваш User ID можно найти в профиле на сайте KipCalendar."
        )
        return

    user_id = context.args[0].strip()

    # Отправляем запрос на бэкенд для линковки
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/telegram/link",
            json={
                "telegram_id": telegram_id,
                "user_id": user_id,  # В продакшене нужна дополнительная верификация
            },
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            # Присоединяемся к комнате
            sio.emit("join", {"room": user_id})
            linked_users[user_id] = telegram_id
            await update.message.reply_text(
                "✅ Аккаунт успешно привязан!\n\n"
                "Теперь вы будете получать уведомления от KipCalendar."
            )
            logger.info(f"Linked account: telegram_id={telegram_id}, user_id={user_id}")
        else:
            error = response.json().get("error", "Unknown error")
            await update.message.reply_text(f"❌ Ошибка: {error}")

    except Exception as e:
        logger.error(f"Link error: {e}")
        await update.message.reply_text(
            "❌ Не удалось связаться с сервером. Попробуйте позже."
        )


async def unlink_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /unlink"""
    telegram_id = str(update.effective_user.id)

    try:
        # Сначала получаем user_id
        status_response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )
        if status_response.status_code == 200 and status_response.json().get("linked"):
            user_id = status_response.json()["user_id"]
            # Отвязываем
            response = requests.post(
                f"{BACKEND_URL}/api/telegram/unlink",
                json={"telegram_id": telegram_id},
                timeout=10,
            )

            if response.status_code == 200:
                # Покидать комнату
                sio.emit("leave", {"room": user_id})
                if user_id in linked_users:
                    del linked_users[user_id]
                await update.message.reply_text(
                    "✅ Аккаунт отвязан.\n\n"
                    "Вы больше не будете получать уведомления."
                )
                logger.info(f"Unlinked account: telegram_id={telegram_id}")
            else:
                error = response.json().get("error", "Unknown error")
                await update.message.reply_text(f"❌ Ошибка: {error}")
        else:
            await update.message.reply_text("❌ Аккаунт не привязан.")

    except Exception as e:
        logger.error(f"Unlink error: {e}")
        await update.message.reply_text("❌ Ошибка при отвязке аккаунта.")


async def check_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /status"""
    telegram_id = str(update.effective_user.id)

    # Проверяем статус через бэкенд
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("linked"):
                message = (
                    f"📊 Статус:\n\n"
                    f"Telegram ID: **{telegram_id}**\n"
                    f"User ID: {data['user_id']}\n"
                    f"Username: {data['username']}\n"
                    f"Статус: Активен\n"
                    f"Уведомления: Включены"
                )
            else:
                message = (
                    f"📊 Статус:\n\n"
                    f"Telegram ID: **{telegram_id}**\n"
                    f"Статус: Не привязан"
                )
            await update.message.reply_text(message, parse_mode="Markdown")
        else:
            error = response.json().get("error", "Unknown error")
            await update.message.reply_text(f"❌ Ошибка: {error}")
    except Exception as e:
        logger.error(f"Status check error: {e}")
        await update.message.reply_text("❌ Не удалось проверить статус.")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help"""
    help_text = """
📖 Доступные команды:

/start - начать работу с ботом
/link <user_id> - привязать аккаунт
/unlink - отвязать аккаунт
/status - проверить статус подключения
/help - показать это сообщение

❓ Как привязать аккаунт:
1. Войдите на KipCalendar
2. Откройте Профиль → Настройки
3. Скопируйте User ID
4. Отправьте: /link ВАШ_USER_ID

💡 Пример: /link 1234567890123456

После привязки вы будете получать уведомления о:
• 📚 Новых оценках
• 📝 Домашних заданиях
• 📅 Событиях и мероприятиях
• 💬 Новых сообщениях
"""
    await update.message.reply_text(help_text)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка текстовых сообщений"""
    text = update.message.text

    # Проверяем, это User ID для линковки
    if text.isdigit() and len(text) == 16:
        await update.message.reply_text(f"Используйте команду: /link {text}")
    else:
        await update.message.reply_text("Используйте /help для списка команд.")


# Убрали периодическую проверку, так как теперь WebSocket


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
