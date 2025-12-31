import logging
import requests
import time
from datetime import datetime, timedelta
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    KeyboardButton,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    CallbackQueryHandler,
    ConversationHandler,
)

# Настройки
BOT_TOKEN = "8203438312:AAEN9v-l6WqatovB6JxHjU2iCzbLn_TikN8"
BACKEND_URL = "http://127.0.0.1:5000"

# Состояния для ConversationHandler
WAITING_FOR_CODE, WAITING_FOR_DATE, WAITING_FOR_MESSAGE = range(3)

# Логирование
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# ============ КЛАВИАТУРЫ ============


def get_main_keyboard(is_linked=False):
    """Главная клавиатура"""
    if not is_linked:
        keyboard = [
            [KeyboardButton("🔗 Привязать аккаунт")],
            [KeyboardButton("❓ Помощь")],
        ]
    else:
        keyboard = [
            [KeyboardButton("📅 Расписание"), KeyboardButton("📚 Оценки")],
            [KeyboardButton("📝 Домашние задания"), KeyboardButton("💬 Сообщения")],
            [KeyboardButton("👤 Профиль"), KeyboardButton("⚙️ Настройки")],
            [KeyboardButton("❓ Помощь")],
        ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


def get_schedule_keyboard():
    """Клавиатура для расписания"""
    keyboard = [
        [
            InlineKeyboardButton("📆 Сегодня", callback_data="schedule_today"),
            InlineKeyboardButton("📆 Завтра", callback_data="schedule_tomorrow"),
        ],
        [
            InlineKeyboardButton("📅 Эта неделя", callback_data="schedule_week"),
            InlineKeyboardButton("📅 След. неделя", callback_data="schedule_next_week"),
        ],
        [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_settings_keyboard():
    """Клавиатура настроек"""
    keyboard = [
        [
            InlineKeyboardButton(
                "🔔 Уведомления", callback_data="settings_notifications"
            )
        ],
        [InlineKeyboardButton("🔓 Отвязать аккаунт", callback_data="unlink_confirm")],
        [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")],
    ]
    return InlineKeyboardMarkup(keyboard)


def get_confirm_keyboard(action):
    """Клавиатура подтверждения"""
    keyboard = [
        [
            InlineKeyboardButton("✅ Да", callback_data=f"confirm_{action}"),
            InlineKeyboardButton("❌ Нет", callback_data="back_to_main"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


# ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============


async def check_link_status(telegram_id: str) -> dict:
    """Проверка статуса привязки"""
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/telegram/status?telegram_id={telegram_id}", timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return {"linked": False}
    except Exception as e:
        logger.error(f"Error checking link status: {e}")
        return {"linked": False}


async def get_user_token(telegram_id: str) -> str:
    """Получить токен пользователя (здесь упрощенно - в продакшене нужна отдельная авторизация)"""
    # В реальности нужно хранить токен в БД после привязки
    # Здесь для простоты получаем user_id и используем его
    status = await check_link_status(telegram_id)
    if status.get("linked"):
        return status.get("user_id", "")
    return ""


# ============ ОБРАБОТЧИКИ КОМАНД ============


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /start"""
    telegram_id = str(update.effective_user.id)
    username = update.effective_user.username or update.effective_user.first_name

    status = await check_link_status(telegram_id)
    is_linked = status.get("linked", False)

    if is_linked:
        message = f"""
👋 С возвращением, {username}!

Ваш аккаунт привязан к: @{status.get('username', 'N/A')}

Используйте кнопки ниже для навигации:
"""
    else:
        message = f"""
👋 Привет, {username}!

Я бот KipCalendar. Помогу вам:
📚 Получать уведомления о новых оценках
📝 Напоминать о домашних заданиях  
📅 Показывать расписание
💬 Уведомлять о новых сообщениях

Для начала нужно привязать аккаунт. Нажмите кнопку "🔗 Привязать аккаунт" ниже.
"""

    await update.message.reply_text(message, reply_markup=get_main_keyboard(is_linked))


# ============ ОБРАБОТЧИКИ КНОПОК ============


async def handle_link_account(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка нажатия кнопки привязки"""
    message = """
🔗 **Привязка аккаунта**

Для привязки выполните следующие шаги:

1️⃣ Войдите в KipCalendar на сайте
2️⃣ Откройте **Профиль**
3️⃣ Нажмите **"Подключить Telegram"**
4️⃣ Скопируйте **6-значный код**
5️⃣ Отправьте мне этот код

⏱ Код действителен 10 минут

Отправьте код или /cancel для отмены:
"""
    await update.message.reply_text(message, parse_mode="Markdown")
    return WAITING_FOR_CODE


async def process_link_code(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кода привязки"""
    code = update.message.text.strip()
    telegram_id = str(update.effective_user.id)

    # Проверка формата
    if not (code.isdigit() and len(code) == 6):
        await update.message.reply_text(
            "❌ Неверный формат кода. Код должен содержать 6 цифр.\n\n"
            "Попробуйте еще раз или /cancel для отмены:"
        )
        return WAITING_FOR_CODE

    try:
        response = requests.post(
            f"{BACKEND_URL}/api/telegram/verify-code",
            json={"code": code, "telegram_id": telegram_id},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            username = data.get("username")

            await update.message.reply_text(
                f"✅ **Аккаунт успешно привязан!**\n\n"
                f"Пользователь: @{username}\n\n"
                f"Теперь вы будете получать уведомления от KipCalendar.\n"
                f"Используйте кнопки ниже для навигации.",
                parse_mode="Markdown",
                reply_markup=get_main_keyboard(True),
            )
            logger.info(f"Successfully linked: telegram_id={telegram_id}")
            return ConversationHandler.END
        else:
            error_data = response.json()
            error_msg = error_data.get("error", "Неизвестная ошибка")

            await update.message.reply_text(
                f"❌ Ошибка: {error_msg}\n\n"
                f"Попробуйте еще раз или /cancel для отмены:"
            )
            return WAITING_FOR_CODE

    except Exception as e:
        logger.error(f"Link error: {e}")
        await update.message.reply_text(
            "❌ Произошла ошибка при привязке аккаунта.\n\n" "Попробуйте еще раз позже."
        )
        return ConversationHandler.END


async def handle_schedule(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки расписания"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text(
            "❌ Сначала нужно привязать аккаунт!", reply_markup=get_main_keyboard(False)
        )
        return

    await update.message.reply_text(
        "📅 **Выберите период:**",
        parse_mode="Markdown",
        reply_markup=get_schedule_keyboard(),
    )


async def handle_grades(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки оценок"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text(
            "❌ Сначала нужно привязать аккаунт!", reply_markup=get_main_keyboard(False)
        )
        return

    user_id = status.get("user_id")

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/journal/student/{user_id}/summary", timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            subjects = data.get("subjects", [])

            if not subjects:
                await update.message.reply_text("📚 Оценки пока не выставлены.")
                return

            grades_text = "📚 **Мои оценки:**\n\n"

            for subject in subjects[:10]:  # Первые 10 предметов
                grades_text += f"**{subject['subject_name']}**\n"

                if subject["marks_count"] > 0:
                    marks = subject["marks"][-5:]  # Последние 5 оценок
                    marks_str = ", ".join([m["value"] for m in marks])
                    grades_text += f"  📊 Оценки: {marks_str}\n"

                    if subject["average_mark"]:
                        grades_text += f"  📈 Средняя: **{subject['average_mark']}**\n"

                    attendance = subject.get("attendance", {})
                    if attendance.get("total", 0) > 0:
                        rate = attendance.get("attendance_rate", 0)
                        grades_text += f"  ✅ Посещаемость: {rate}%\n"
                else:
                    grades_text += "  Оценок пока нет\n"

                grades_text += "\n"

            keyboard = [
                [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]
            ]

            await update.message.reply_text(
                grades_text,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
        else:
            await update.message.reply_text("❌ Ошибка получения оценок.")

    except Exception as e:
        logger.error(f"Grades error: {e}")
        await update.message.reply_text("❌ Ошибка получения оценок.")


async def handle_homework(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки домашних заданий"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text(
            "❌ Сначала нужно привязать аккаунт!", reply_markup=get_main_keyboard(False)
        )
        return

    user_id = status.get("user_id")
    today = datetime.now().strftime("%Y-%m-%d")

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/homework/student/{user_id}?from_date={today}",
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            homework_list = data.get("homework", [])

            if not homework_list:
                await update.message.reply_text("📝 Домашних заданий пока нет! 🎉")
                return

            hw_text = "📝 **Домашние задания:**\n\n"

            for i, hw in enumerate(homework_list[:10], 1):
                date_obj = datetime.strptime(hw["date"], "%Y-%m-%d")
                formatted_date = date_obj.strftime("%d.%m.%Y")

                hw_text += f"**{i}. {hw['subject_name']}**\n"
                hw_text += f"📄 {hw['homework']}\n"
                hw_text += f"📅 Срок: {formatted_date}\n"

                if hw.get("topic"):
                    hw_text += f"📖 Тема: {hw['topic']}\n"

                hw_text += "\n"

            keyboard = [
                [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]
            ]

            await update.message.reply_text(
                hw_text,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
        else:
            await update.message.reply_text("❌ Ошибка получения домашних заданий.")

    except Exception as e:
        logger.error(f"Homework error: {e}")
        await update.message.reply_text("❌ Ошибка получения домашних заданий.")


async def handle_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки сообщений"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text(
            "❌ Сначала нужно привязать аккаунт!", reply_markup=get_main_keyboard(False)
        )
        return

    user_id = status.get("user_id")

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/chats", headers={"Authorization": user_id}, timeout=10
        )

        if response.status_code == 200:
            chats = response.json()

            if not chats:
                await update.message.reply_text("💬 У вас пока нет чатов.")
                return

            msg_text = "💬 **Ваши чаты:**\n\n"

            for chat in chats[:10]:
                chat_name = chat.get("name") or chat.get("other_user", "Чат")
                msg_count = chat.get("message_count", 0)
                chat_type = "👥 Группа" if chat.get("type") == "group" else "👤 Личный"

                msg_text += f"{chat_type} **{chat_name}**\n"
                msg_text += f"📨 Сообщений: {msg_count}\n\n"

            msg_text += "\n💡 Для просмотра сообщений перейдите на сайт KipCalendar"

            keyboard = [
                [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]
            ]

            await update.message.reply_text(
                msg_text,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
        else:
            await update.message.reply_text("❌ Ошибка получения сообщений.")

    except Exception as e:
        logger.error(f"Messages error: {e}")
        await update.message.reply_text("❌ Ошибка получения сообщений.")


async def handle_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки профиля"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text(
            "❌ Сначала нужно привязать аккаунт!", reply_markup=get_main_keyboard(False)
        )
        return

    user_id = status.get("user_id")

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/users/{user_id}/profile", timeout=10
        )

        if response.status_code == 200:
            data = response.json()

            profile_text = "👤 **Ваш профиль:**\n\n"
            profile_text += f"🆔 Username: @{data.get('username', 'N/A')}\n"

            if data.get("first_name") or data.get("last_name"):
                name = (
                    f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
                )
                profile_text += f"👨‍🎓 ФИО: {name}\n"

            roles = data.get("roles", [])
            role_emoji = {"student": "🎓", "teacher": "👨‍🏫", "admin": "👑"}
            roles_str = ", ".join(
                [f"{role_emoji.get(r, '•')} {r.title()}" for r in roles]
            )
            profile_text += f"🏷 Роли: {roles_str}\n"
            profile_text += (
                f"⭐ Текущая роль: {data.get('current_role', 'N/A').title()}\n"
            )

            orgs = data.get("organizations", [])
            if orgs:
                profile_text += f"\n🏫 **Организации:**\n"
                for org in orgs:
                    profile_text += f"  • {org.get('name', 'N/A')}\n"

            groups = data.get("groups", [])
            if groups:
                profile_text += f"\n👥 **Группы:**\n"
                for group in groups:
                    profile_text += f"  • {group.get('name', 'N/A')}\n"

            telegram_linked = data.get("telegram_linked", False)
            profile_text += f"\n📱 Telegram: {'✅ Подключен' if telegram_linked else '❌ Не подключен'}\n"

            keyboard = [
                [InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]
            ]

            await update.message.reply_text(
                profile_text,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard),
            )
        else:
            await update.message.reply_text("❌ Ошибка получения профиля.")

    except Exception as e:
        logger.error(f"Profile error: {e}")
        await update.message.reply_text("❌ Ошибка получения профиля.")


async def handle_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки настроек"""
    await update.message.reply_text(
        "⚙️ **Настройки:**", parse_mode="Markdown", reply_markup=get_settings_keyboard()
    )


async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопки помощи"""
    help_text = """
📖 **Справка по боту KipCalendar**

**Основные функции:**

📅 **Расписание** - просмотр занятий на день/неделю
📚 **Оценки** - текущие оценки по предметам
📝 **Домашние задания** - список текущих ДЗ
💬 **Сообщения** - список чатов
👤 **Профиль** - информация о вашем аккаунте
⚙️ **Настройки** - управление уведомлениями

**Уведомления:**
После привязки аккаунта вы будете автоматически получать уведомления о:
- Новых оценках
- Новых домашних заданиях
- Новых сообщениях
- Изменениях в расписании

**Привязка аккаунта:**
1. Нажмите "🔗 Привязать аккаунт"
2. Войдите на сайт KipCalendar
3. Откройте Профиль → Подключить Telegram
4. Скопируйте 6-значный код
5. Отправьте код боту

**Поддержка:**
Если возникли проблемы, свяжитесь с администратором.
"""

    keyboard = [[InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]]

    await update.message.reply_text(
        help_text, parse_mode="Markdown", reply_markup=InlineKeyboardMarkup(keyboard)
    )


# ============ ОБРАБОТЧИКИ CALLBACK QUERIES ============


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик inline-кнопок"""
    query = update.callback_query
    await query.answer()

    telegram_id = str(query.from_user.id)
    status = await check_link_status(telegram_id)

    # Расписание
    if query.data.startswith("schedule_"):
        period = query.data.split("_")[1]
        await show_schedule(query, telegram_id, status, period)

    # Назад в главное меню
    elif query.data == "back_to_main":
        await query.message.edit_text("Используйте кнопки ниже:", reply_markup=None)

    # Настройки уведомлений
    elif query.data == "settings_notifications":
        keyboard = [
            [
                InlineKeyboardButton(
                    "🔔 Оценки: ВКЛ", callback_data="toggle_notif_grades"
                )
            ],
            [InlineKeyboardButton("🔔 ДЗ: ВКЛ", callback_data="toggle_notif_homework")],
            [
                InlineKeyboardButton(
                    "🔔 Сообщения: ВКЛ", callback_data="toggle_notif_messages"
                )
            ],
            [InlineKeyboardButton("🔙 Назад", callback_data="back_to_settings")],
        ]
        await query.message.edit_text(
            "🔔 **Настройки уведомлений:**\n\nВыберите, какие уведомления вы хотите получать:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard),
        )

    # Подтверждение отвязки
    elif query.data == "unlink_confirm":
        await query.message.edit_text(
            "⚠️ Вы уверены, что хотите отвязать аккаунт?\n\n"
            "Вы перестанете получать уведомления.",
            reply_markup=get_confirm_keyboard("unlink"),
        )

    # Отвязка аккаунта
    elif query.data == "confirm_unlink":
        await unlink_account_callback(query, telegram_id)

    # Назад к настройкам
    elif query.data == "back_to_settings":
        await query.message.edit_text(
            "⚙️ **Настройки:**",
            parse_mode="Markdown",
            reply_markup=get_settings_keyboard(),
        )


async def show_schedule(query, telegram_id: str, status: dict, period: str):
    """Показать расписание за период"""
    if not status.get("linked"):
        await query.message.edit_text("❌ Сначала нужно привязать аккаунт!")
        return

    user_id = status.get("user_id")
    today = datetime.now()

    # Определяем даты
    if period == "today":
        start_date = today.strftime("%Y-%m-%d")
        end_date = start_date
        title = "Расписание на сегодня"
    elif period == "tomorrow":
        tomorrow = today + timedelta(days=1)
        start_date = tomorrow.strftime("%Y-%m-%d")
        end_date = start_date
        title = "Расписание на завтра"
    elif period == "week":
        start_date = (today - timedelta(days=today.weekday())).strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=6 - today.weekday())).strftime("%Y-%m-%d")
        title = "Расписание на эту неделю"
    else:  # next_week
        next_monday = today + timedelta(days=7 - today.weekday())
        start_date = next_monday.strftime("%Y-%m-%d")
        end_date = (next_monday + timedelta(days=6)).strftime("%Y-%m-%d")
        title = "Расписание на следующую неделю"

    try:
        response = requests.get(
            f"{BACKEND_URL}/api/calendar/user/{user_id}?start_date={start_date}&end_date={end_date}",
            timeout=10,
        )

        if response.status_code == 200:
            data = response.json()
            events = data.get("events", [])

            # Фильтруем только занятия
            lessons = [e for e in events if e.get("event_type") == "lesson"]

            if not lessons:
                await query.message.edit_text(
                    f"📅 **{title}**\n\nЗанятий нет.",
                    parse_mode="Markdown",
                    reply_markup=get_schedule_keyboard(),
                )
                return

            # Группируем по дням
            schedule_text = f"📅 **{title}:**\n\n"

            days_dict = {}
            for lesson in lessons:
                date = lesson["date"]
                if date not in days_dict:
                    days_dict[date] = []
                days_dict[date].append(lesson)

            day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

            for date_str in sorted(days_dict.keys()):
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                day_name = day_names[date_obj.weekday()]

                schedule_text += f"**{day_name}, {date_obj.strftime('%d.%m')}**\n"

                for lesson in sorted(days_dict[date_str], key=lambda x: x["time"]):
                    time_str = lesson.get("time", "")
                    end_time = lesson.get("end_time", "")
                    title_str = lesson.get("title", "Занятие")

                    if end_time:
                        schedule_text += f"⏰ {time_str}-{end_time} • {title_str}\n"
                    else:
                        schedule_text += f"⏰ {time_str} • {title_str}\n"

                schedule_text += "\n"

            await query.message.edit_text(
                schedule_text,
                parse_mode="Markdown",
                reply_markup=get_schedule_keyboard(),
            )
        else:
            await query.message.edit_text(
                "❌ Ошибка получения расписания.", reply_markup=get_schedule_keyboard()
            )

    except Exception as e:
        logger.error(f"Schedule error: {e}")
        await query.message.edit_text(
            "❌ Ошибка получения расписания.", reply_markup=get_schedule_keyboard()
        )


async def unlink_account_callback(query, telegram_id: str):
    """Отвязка аккаунта через callback"""
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/telegram/unlink",
            json={"telegram_id": telegram_id},
            headers={"Content-Type": "application/json"},
            timeout=10,
        )

        if response.status_code == 200:
            await query.message.edit_text(
                "✅ Аккаунт успешно отвязан.\n\n"
                "Вы больше не будете получать уведомления.\n\n"
                "Для повторной привязки используйте кнопку ниже.",
                reply_markup=get_main_keyboard(False),
            )
            logger.info(f"Unlinked: telegram_id={telegram_id}")
        else:
            await query.message.edit_text(
                "❌ Ошибка отвязки аккаунта.\n\n" "Попробуйте позже.",
                reply_markup=get_settings_keyboard(),
            )
    except Exception as e:
        logger.error(f"Unlink error: {e}")
        await query.message.edit_text(
            "❌ Ошибка отвязки аккаунта.", reply_markup=get_settings_keyboard()
        )


# ============ УВЕДОМЛЕНИЯ ============
async def send_notification(user_id: str, notif_type: str, content: str):
    """Отправка уведомления пользователю"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/telegram/user/{user_id}", timeout=5)
        if response.status_code == 200:
            data = response.json()
            telegram_id = data.get("telegram_id")
            if telegram_id:
                await application.bot.send_message(
                    chat_id=telegram_id, text=content, parse_mode="Markdown"
                )
                logger.info(f"Notification sent to {telegram_id}: {notif_type}")
    except Exception as e:
        logger.error(f"Notification error: {e}")


# ============ ConversationHandler ============
link_handler = ConversationHandler(
    entry_points=[
        MessageHandler(filters.Regex("🔗 Привязать аккаунт"), handle_link_account)
    ],
    states={
        WAITING_FOR_CODE: [
            MessageHandler(filters.TEXT & ~filters.COMMAND, process_link_code)
        ]
    },
    fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)],
)

EVENT_TYPE, EVENT_DATE, EVENT_TIME, EVENT_DESC = range(4, 8)


async def add_event_entry(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Вход в conversation для создания события"""
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)

    if not status.get("linked"):
        await update.message.reply_text("❌ Сначала привяжите аккаунт!")
        return ConversationHandler.END

    await update.message.reply_text(
        "📅 **Создание события**\n\nВыберите тип события:",
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton("📖 Лекция", callback_data="event_type_lec"),
                    InlineKeyboardButton(
                        "📝 Практика", callback_data="event_type_prac"
                    ),
                ],
                [
                    InlineKeyboardButton("📚 Экзамен", callback_data="event_type_exam"),
                    InlineKeyboardButton("📌 Другое", callback_data="event_type_other"),
                ],
                [InlineKeyboardButton("❌ Отмена", callback_data="cancel_event")],
            ]
        ),
    )
    return EVENT_TYPE


async def add_event_type(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка типа события"""
    query = update.callback_query
    await query.answer()

    if query.data == "cancel_event":
        await query.message.edit_text("Создание события отменено.")
        return ConversationHandler.END

    context.user_data["event_type"] = query.data.split("_")[2]  # lec, prac, etc.

    await query.message.edit_text("📅 Введите дату события (формат: ДД.ММ.ГГГГ):")
    return EVENT_DATE


async def add_event_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка даты"""
    date_str = update.message.text.strip()
    try:
        date_obj = datetime.strptime(date_str, "%d.%m.%Y")
        context.user_data["event_date"] = date_obj.strftime("%Y-%m-%d")

        await update.message.reply_text("⏰ Введите время начала (формат: ЧЧ:ММ):")
        return EVENT_TIME
    except ValueError:
        await update.message.reply_text("❌ Неверный формат даты. Попробуйте еще раз:")
        return EVENT_DATE


async def add_event_time(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка времени"""
    time_str = update.message.text.strip()
    try:
        time_obj = datetime.strptime(time_str, "%H:%M")
        context.user_data["event_time"] = time_obj.strftime("%H:%M")

        await update.message.reply_text("📝 Введите описание события:")
        return EVENT_DESC
    except ValueError:
        await update.message.reply_text(
            "❌ Неверный формат времени. Попробуйте еще раз:"
        )
        return EVENT_TIME


async def add_event_desc(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка описания и создание события"""
    context.user_data["event_desc"] = update.message.text.strip()

    data = {
        "type": context.user_data["event_type"],
        "date": context.user_data["event_date"],
        "time": context.user_data["event_time"],
        "description": context.user_data["event_desc"],
    }

    user_id = (await check_link_status(str(update.effective_user.id))).get("user_id")

    try:
        response = requests.post(
            f"{BACKEND_URL}/api/events/create",
            json=data,
            headers={"Authorization": user_id},
            timeout=10,
        )

        if response.status_code == 200:
            await update.message.reply_text(
                "✅ Событие успешно создано!", reply_markup=get_main_keyboard(True)
            )
        else:
            await update.message.reply_text("❌ Ошибка создания события.")
    except Exception as e:
        logger.error(f"Add event error: {e}")
        await update.message.reply_text("❌ Ошибка создания события.")

    return ConversationHandler.END

EDIT_CHOICE, EDIT_FIELD = range(8, 10)

async def edit_event(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /edit_event <id>"""
    if not context.args:
        await update.message.reply_text("Использование: /edit_event <id>")
        return ConversationHandler.END
   
    event_id = context.args[0]
    context.user_data["edit_event_id"] = event_id
   
    # Fetch event from backend
    user_id = (await check_link_status(str(update.effective_user.id))).get("user_id")
   
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/events/{event_id}",
            headers={"Authorization": user_id},
            timeout=10
        )
       
        if response.status_code == 200:
            data = response.json()
            context.user_data["edit_event_data"] = data
           
            event_text = f"📅 **Редактирование события:**\n\n"
            event_text += f"Тип: {data.get('type')}\n"
            event_text += f"Дата: {data.get('date')}\n"
            event_text += f"Время: {data.get('time')}\n"
            event_text += f"Описание: {data.get('description')}\n\n"
            event_text += "Что изменить?"
           
            keyboard = [
                [InlineKeyboardButton("Тип", callback_data="edit_type")],
                [InlineKeyboardButton("Дата", callback_data="edit_date")],
                [InlineKeyboardButton("Время", callback_data="edit_time")],
                [InlineKeyboardButton("Описание", callback_data="edit_desc")],
                [InlineKeyboardButton("❌ Отмена", callback_data="cancel_edit")]
            ]
           
            await update.message.reply_text(
                event_text,
                parse_mode="Markdown",
                reply_markup=InlineKeyboardMarkup(keyboard)
            )
            return EDIT_CHOICE
        else:
            await update.message.reply_text("❌ Событие не найдено.")
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Edit event error: {e}")
        await update.message.reply_text("❌ Ошибка.")
        return ConversationHandler.END

async def edit_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Выбор поля для редактирования"""
    query = update.callback_query
    await query.answer()
   
    if query.data == "cancel_edit":
        await query.message.edit_text("Редактирование отменено.")
        return ConversationHandler.END
   
    context.user_data["edit_field"] = query.data.split("_")[1]
   
    field_names = {"type": "тип события (lec/prac/exam/other)", "date": "дату (ДД.ММ.ГГГГ)", 
                   "time": "время (ЧЧ:ММ)", "desc": "описание"}
   
    await query.message.edit_text(f"Введите новый {field_names[context.user_data['edit_field']]}:")
    return EDIT_FIELD

async def edit_field(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка нового значения"""
    value = update.message.text.strip()
    field = context.user_data["edit_field"]
   
    # Валидация
    if field == "date":
        try:
            datetime.strptime(value, "%d.%m.%Y")
        except:
            await update.message.reply_text("❌ Неверный формат. Попробуйте еще раз:")
            return EDIT_FIELD
    elif field == "time":
        try:
            datetime.strptime(value, "%H:%M")
        except:
            await update.message.reply_text("❌ Неверный формат. Попробуйте еще раз:")
            return EDIT_FIELD
   
    data = {field: value}
    event_id = context.user_data["edit_event_id"]
    user_id = (await check_link_status(str(update.effective_user.id))).get("user_id")
   
    try:
        response = requests.put(
            f"{BACKEND_URL}/api/events/{event_id}",
            json=data,
            headers={"Authorization": user_id},
            timeout=10
        )
       
        if response.status_code == 200:
            await update.message.reply_text(
                "✅ Событие обновлено!",
                reply_markup=get_main_keyboard(True)
            )
        else:
            await update.message.reply_text("❌ Ошибка обновления.")
    except Exception as e:
        logger.error(f"Edit error: {e}")
        await update.message.reply_text("❌ Ошибка.")
   
    return ConversationHandler.END

async def delete_event(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Использование: /delete_event <id>")
        return
   
    event_id = context.args[0]
    user_id = (await check_link_status(str(update.effective_user.id))).get("user_id")
   
    try:
        response = requests.delete(
            f"{BACKEND_URL}/api/events/{event_id}",
            headers={"Authorization": user_id},
            timeout=10
        )
       
        if response.status_code == 200:
            await update.message.reply_text("✅ Событие удалено.")
        else:
            await update.message.reply_text("❌ Ошибка удаления.")
    except Exception as e:
        logger.error(f"Delete event error: {e}")
        await update.message.reply_text("❌ Ошибка.")

# ============ /reminders ============
async def reminders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = str(update.effective_user.id)
    status = await check_link_status(telegram_id)
   
    if not status.get("linked"):
        await update.message.reply_text("❌ Привяжите аккаунт!")
        return
   
    user_id = status.get("user_id")
   
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/reminders/{user_id}",
            timeout=10
        )
       
        if response.status_code == 200:
            data = response.json()
            reminders_list = data.get("reminders", [])
           
            if not reminders_list:
                await update.message.reply_text("🔔 Нет активных напоминаний.")
                return
           
            text = "🔔 **Активные напоминания:**\n\n"
            for r in reminders_list:
                text += f"• {r['event']} - {r['time_before']} мин до начала\n"
           
            keyboard = [[InlineKeyboardButton("🔙 Назад", callback_data="back_to_main")]]
            await update.message.reply_text(text, reply_markup=InlineKeyboardMarkup(keyboard))
        else:
            await update.message.reply_text("❌ Ошибка.")
    except Exception as e:
        logger.error(f"Reminders error: {e}")
        await update.message.reply_text("❌ Ошибка.")

# /delete_event <id>
async def delete_event(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Подтверждение, запрос на backend
    pass


# /reminders
async def reminders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Список напоминаний, настройки
    pass


# /send <chat_id> <text>
async def send_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Отправка сообщения через backend
    pass


# /new_chat <user/email>
async def new_chat(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Создание чата
    pass


# /group_create <name> <users>
async def group_create(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Создание группы
    pass


# /upload_material <file>
async def upload_material(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Обработка файла, загрузка на backend
    pass


# /download <id>
async def download_material(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Скачивание файла
    pass


# /materials
async def list_materials(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Список материалов
    pass


# /attendance (для преподавателей)
async def attendance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Отметка посещаемости
    pass


# /change_role <role>
async def change_role(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Смена роли
    pass


# /org_info
async def org_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Инфо об организации
    pass


# /join_org <invite_code>
async def join_org(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Присоединение к организации
    pass


# /create_org_request
async def create_org_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Запрос на создание организации (ConversationHandler для данных)
    pass


# /groups
async def list_groups(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Список групп
    pass


# /join_group <id>
async def join_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Присоединение к группе
    pass


# /approve_request <id> <answer> (для админов)
async def approve_request(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Одобрение/отказ запроса
    pass


# /settings - Дополнительные настройки (язык, тема)
# Добавить в handle_settings


# Голосовой ввод - MessageHandler(filters.VOICE)
async def handle_voice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Распознавание речи (нужен API для speech-to-text, e.g., Google Speech)
    pass


# Мультиязычность - /lang <ru/en>
async def change_lang(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Смена языка (хранить в БД или контексте)
    pass


# Безопасность: Rate limiting - Использовать middleware
# Для групп: GroupHandler если нужно добавить бота в TG-группы


# ============ Запуск бота ============
application = Application.builder().token(BOT_TOKEN).build()

# Добавляем обработчики
application.add_handler(CommandHandler("start", start))
application.add_handler(MessageHandler(filters.Regex("📅 Расписание"), handle_schedule))
application.add_handler(MessageHandler(filters.Regex("📚 Оценки"), handle_grades))
application.add_handler(
    MessageHandler(filters.Regex("📝 Домашние задания"), handle_homework)
)
application.add_handler(MessageHandler(filters.Regex("💬 Сообщения"), handle_messages))
application.add_handler(MessageHandler(filters.Regex("👤 Профиль"), handle_profile))
application.add_handler(MessageHandler(filters.Regex("⚙️ Настройки"), handle_settings))
application.add_handler(MessageHandler(filters.Regex("❓ Помощь"), handle_help))
application.add_handler(link_handler)
application.add_handler(CallbackQueryHandler(callback_handler))

if __name__ == "__main__":
    logger.info("Bot started!")
    application.run_polling(allowed_updates=Update.ALL_TYPES)
