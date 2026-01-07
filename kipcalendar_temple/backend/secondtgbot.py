import logging
import time
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, CallbackContext
from apscheduler.schedulers.background import BackgroundScheduler
import json

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация - замените на ваши значения
API_BASE_URL = 'http://localhost:5000/api/telegram'  # URL вашего Flask backend
BOT_TOKEN = "8203438312:AAEN9v-l6WqatovB6JxHjU2iCzbLn_TikN8" # Токен вашего бота Telegram

# Получите bot_token из базы, если нужно (из telegram_bot_config)
def get_bot_token():
    try:
        response = requests.get(f'{API_BASE_URL}/bot/config')
        if response.status_code == 200:
            config = response.json()
            return config.get('bot_token')
    except Exception as e:
        logger.error(f"Error getting bot config: {e}")
    return BOT_TOKEN  # Фallback

BOT_TOKEN = get_bot_token()

# Функция для связывания аккаунта
async def link_account(update: Update, context: CallbackContext) -> None:
    telegram_id = update.message.chat.id
    code = update.message.text.strip()

    # Проверяем, является ли это 6-значным кодом (как в документации)
    if not code.isdigit() or len(code) != 6:
        await update.message.reply_text('Пожалуйста, введите правильный 6-значный код связывания.')
        return

    try:
        response = requests.post(
            f'{API_BASE_URL}/link',
            json={'code': code, 'telegram_id': str(telegram_id)}
        )
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                await update.message.reply_text('Аккаунт успешно связан! Теперь вы будете получать уведомления.')
            else:
                await update.message.reply_text(data.get('error', 'Ошибка связывания.'))
        else:
            await update.message.reply_text('Ошибка связи с сервером.')
    except Exception as e:
        logger.error(f"Error linking account: {e}")
        await update.message.reply_text('Внутренняя ошибка. Попробуйте позже.')

# Команда /start
async def start(update: Update, context: CallbackContext) -> None:
    await update.message.reply_text(
        'Привет! Это бот для KipCalendar.\n'
        'Чтобы связать аккаунт, сгенерируйте код в веб-интерфейсе и отправьте его мне.\n'
        'После связывания вы будете получать уведомления.'
    )

# Функция для проверки и отправки уведомлений
def send_pending_notifications(bot):
    try:
        # Получаем все pending уведомления (предполагаем endpoint /notifications/all_pending)
        # Если нет, реализуйте в backend: SELECT * FROM notifications WHERE sent_to_telegram = 0 AND user_id IN (SELECT user_id FROM telegram_links WHERE is_active=1)
        # И join с telegram_links для telegram_id
        response = requests.get(f'{API_BASE_URL}/notifications/all_pending')
        if response.status_code == 200:
            notifications = response.json().get('notifications', [])
            
            # Группируем по telegram_id
            grouped = {}
            for notif in notifications:
                tg_id = notif.get('telegram_id')
                if tg_id:
                    if tg_id not in grouped:
                        grouped[tg_id] = []
                    grouped[tg_id].append(notif)
            
            # Отправляем
            sent_ids = []
            for tg_id, notifs in grouped.items():
                for notif in notifs:
                    message = f"[{notif['type'].upper()}] {notif['content']}\nВремя: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(notif['timestamp']))}"
                    try:
                        bot.send_message(chat_id=tg_id, text=message)
                        sent_ids.append(notif['id'])
                    except Exception as e:
                        logger.error(f"Error sending to {tg_id}: {e}")
            
            # Отмечаем как отправленные
            if sent_ids:
                requests.post(f'{API_BASE_URL}/notifications/mark-telegram-sent', json={'notification_ids': sent_ids})
    except Exception as e:
        logger.error(f"Error in send_pending_notifications: {e}")

# Основная функция
def main() -> None:
    application = Application.builder().token(BOT_TOKEN).build()

    # Хэндлеры
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, link_account))  # Любое текстовое сообщение - код

    # Scheduler для уведомлений (каждые 60 секунд)
    scheduler = BackgroundScheduler()
    scheduler.add_job(send_pending_notifications, 'interval', seconds=60, args=[application.bot])
    scheduler.start()

    # Запуск бота
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()