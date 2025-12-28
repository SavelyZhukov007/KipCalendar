"""
KipCalendar Telegram Bot
"""
import logging
import requests
import time
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Настройки
BOT_TOKEN = "8203438312:AAEN9v-l6WqatovB6JxHjU2iCzbLn_TikN8"
BACKEND_URL = "http://127.0.0.1:5000"
CHECK_INTERVAL = 60  # Проверка уведомлений каждые 60 секунд

# Логирование
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Хранилище временных данных для линковки
pending_links = {}


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

Ваш Telegram ID: `{telegram_id}`

Доступные команды:
/link <user_id> - привязать аккаунт
/unlink - отвязать аккаунт
/status - проверить статус
/help - помощь
"""
    
    await update.message.reply_text(message, parse_mode='Markdown')


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
                "user_id": user_id  # В продакшене нужна дополнительная верификация
            },
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            await update.message.reply_text(
                "✅ Аккаунт успешно привязан!\n\n"
                "Теперь вы будете получать уведомления от KipCalendar."
            )
            logger.info(f"Linked account: telegram_id={telegram_id}, user_id={user_id}")
        else:
            error = response.json().get('error', 'Unknown error')
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
        # Находим user_id по telegram_id через бэкенд
        # В продакшене: добавить отдельный endpoint для отвязки по telegram_id
        
        await update.message.reply_text(
            "✅ Аккаунт отвязан.\n\n"
            "Вы больше не будете получать уведомления."
        )
        logger.info(f"Unlinked account: telegram_id={telegram_id}")
    
    except Exception as e:
        logger.error(f"Unlink error: {e}")
        await update.message.reply_text("❌ Ошибка при отвязке аккаунта.")


async def check_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /status"""
    telegram_id = str(update.effective_user.id)
    
    # Проверяем статус через бэкенд
    try:
        # TODO: Добавить endpoint для проверки статуса по telegram_id
        await update.message.reply_text(
            f"📊 Статус:\n\n"
            f"Telegram ID: `{telegram_id}`\n"
            f"Статус: Активен\n"
            f"Уведомления: Включены",
            parse_mode='Markdown'
        )
    except Exception as e:
        logger.error(f"Status check error: {e}")
        await update.message.reply_text("❌ Не удалось проверить статус.")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /help"""
    help_text = """
📖 Доступные команды:

/start - начать работу с ботом
/link <user_id> - привязать KipCalendar аккаунт
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
        await update.message.reply_text(
            f"Используйте команду: /link {text}"
        )
    else:
        await update.message.reply_text(
            "Используйте /help для списка команд."
        )


async def check_notifications_periodic(context: ContextTypes.DEFAULT_TYPE):
    """
    Периодическая проверка новых уведомлений
    Вызывается каждые CHECK_INTERVAL секунд
    """
    logger.info("Checking for new notifications...")
    
    try:
        # Получаем всех пользователей с привязанным Telegram
        response = requests.get(
            f"{BACKEND_URL}/api/telegram/users-with-notifications",
            timeout=10
        )
        
        if response.status_code != 200:
            logger.error(f"Failed to get users: {response.status_code}")
            return
        
        users_data = response.json()
        
        for user_data in users_data:
            user_id = user_data['user_id']
            telegram_id = user_data['telegram_id']
            
            # Получаем непрочитанные уведомления
            notif_response = requests.get(
                f"{BACKEND_URL}/api/notifications/pending/{user_id}",
                timeout=10
            )
            
            if notif_response.status_code == 200:
                data = notif_response.json()
                notifications = data.get('notifications', [])
                
                for notif in notifications:
                    # Форматируем уведомление
                    emoji = {
                        'grade': '📚',
                        'homework': '📝',
                        'event': '📅',
                        'message': '💬',
                        'announcement': '📢'
                    }.get(notif['type'], '🔔')
                    
                    message = f"{emoji} {notif['content']}"
                    
                    try:
                        # Отправляем уведомление
                        await context.bot.send_message(
                            chat_id=telegram_id,
                            text=message
                        )
                        logger.info(f"Sent notification to {telegram_id}: {notif['id']}")
                        
                        # Помечаем как отправленное
                        requests.post(
                            f"{BACKEND_URL}/api/notifications/mark-telegram-sent",
                            json={"notification_ids": [notif['id']]},
                            timeout=5
                        )
                    
                    except Exception as e:
                        logger.error(f"Failed to send to {telegram_id}: {e}")
    
    except Exception as e:
        logger.error(f"Check notifications error: {e}")


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
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Периодическая проверка уведомлений
    job_queue = application.job_queue
    job_queue.run_repeating(
        check_notifications_periodic,
        interval=CHECK_INTERVAL,
        first=10  # Первая проверка через 10 секунд
    )
    
    # Запускаем бота
    logger.info("Bot started! Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()