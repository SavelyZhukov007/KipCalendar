# starting commands
"""
kipcalendar_temple/backend/appvenv/Scripts/Activate.ps1
py kipcalendar_temple/backend/app_test.py
"""
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import sqlite3
import json
import hashlib
import jwt
import datetime
import time
from flask_mail import Mail, Message
from threading import Timer
from flask_socketio import SocketIO, emit
import secrets
import pandas as pd
from werkzeug.utils import secure_filename
import os

app = Flask(__name__)
CORS(
    app,
    origins=["*"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True,
)
app.config["MAIL_SERVER"] = (
    "smtp.gmail.com"  # Пример для Gmail; замените на ваш SMTP-сервер
)
password = "meqx mjtp zgxi padk"  # Ваш app password для Gmail
app.config["MAIL_PORT"] = 587  # Или 465 для SSL
app.config["MAIL_USE_TLS"] = True  # Или MAIL_USE_SSL = True
app.config["MAIL_USERNAME"] = "savely.zhukov.1583@gmail.com"  # Ваш email
app.config["MAIL_PASSWORD"] = password  # App password для Gmail (не основной пароль)
app.config["MAIL_DEFAULT_SENDER"] = "savely.zhukov.1583@gmail.com"  # От кого отправлять
mail = Mail(app)  # Инициализация Flask-Mail
socketio = SocketIO(app, cors_allowed_origins="*")

SECRET_KEY = "your_secret_key_change_me"
DATABASE = "kipcalendar.db"
# ============ HELPER FUNCTIONS ============


def generate_uuid():
    """Генерация UUID (16-значный ID)"""
    import secrets

    while True:
        new_id = "".join([str(secrets.randbelow(10)) for _ in range(16)])
        # Проверяем уникальность
        db = get_db()
        cur = db.cursor()
        # Проверяем во всех основных таблицах
        cur.execute("SELECT id FROM users WHERE id = ?", (new_id,))
        if not cur.fetchone():
            return new_id


def create_notification(user_id, notification_type, content):
    """Создание уведомления"""
    db = get_db()
    cur = db.cursor()
    notif_id = generate_uuid()
    timestamp = int(time.time())

    cur.execute(
        """INSERT INTO notifications (id, user_id, type, content, timestamp, is_read, sent_to_telegram)
           VALUES (?, ?, ?, ?, ?, 0, 0)""",
        (notif_id, user_id, notification_type, content, timestamp),
    )
    db.commit()

    # Emit через SocketIO для real-time
    socketio.emit(
        "notification",
        {
            "id": notif_id,
            "type": notification_type,
            "content": content,
            "timestamp": timestamp,
        },
        room=str(user_id),
    )

    return notif_id


def log_audit(user_id, action, entity_id=None, old_value=None, new_value=None):
    """Логирование действий пользователя"""
    db = get_db()
    cur = db.cursor()
    audit_id = generate_uuid()

    cur.execute(
        """INSERT INTO audit_logs (id, user_id, action, entity_id, old_value, new_value, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (audit_id, user_id, action, entity_id, old_value, new_value, int(time.time())),
    )
    db.commit()


def check_organization_permission(user_id, organization_id, required_role):
    """Проверка прав пользователя в организации"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT roles FROM organization_members 
           WHERE organization_id = ? AND user_id = ?""",
        (organization_id, user_id),
    )
    member = cur.fetchone()

    if not member:
        return False

    roles = json.loads(member["roles"])
    return required_role in roles or "admin" in roles


def get_user_organizations(user_id):
    """Получить список организаций пользователя"""
    db = get_db()
    cur = db.cursor()
    cur.execute(
        """SELECT o.*, om.roles, om.current_role 
           FROM organizations o
           JOIN organization_members om ON o.id = om.organization_id
           WHERE om.user_id = ?""",
        (user_id,),
    )
    return [dict(row) for row in cur.fetchall()]


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def send_email(to_email, subject, body, html_body=None):
    msg = Message(subject, recipients=[to_email])
    msg.body = body  # Текстовый вариант
    if html_body:
        msg.html = html_body  # HTML-вариант для красивого оформления
    try:
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()


def init_db():
    with app.app_context():
        db = get_db()
        db.executescript(
            """
        -- Users table (с UUID)
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            email_verified BOOLEAN DEFAULT 0,
            verification_code TEXT,
            verification_expires INTEGER,
            roles TEXT NOT NULL,
            current_role TEXT NOT NULL,
            logout_timestamp INTEGER,
            first_name TEXT,
            last_name TEXT,
            middle_name TEXT,
            telegram_id TEXT UNIQUE,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        -- Organizations
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            short_name TEXT,
            type TEXT NOT NULL DEFAULT 'education',
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            created_by TEXT,
            FOREIGN KEY(created_by) REFERENCES users(id)
        );

        -- Organization members
        CREATE TABLE IF NOT EXISTS organization_members (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            roles TEXT NOT NULL,
            current_role TEXT NOT NULL,
            joined_at INTEGER DEFAULT (strftime('%s', 'now')),
            profile_data TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(organization_id, user_id)
        );

        -- Invitations
        CREATE TABLE IF NOT EXISTS invitations (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            role TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            expires_at INTEGER NOT NULL,
            max_uses INTEGER DEFAULT -1,
            uses INTEGER DEFAULT 0,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );

        -- Buildings
        CREATE TABLE IF NOT EXISTS buildings (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            address TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );

        -- Rooms
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            building_id TEXT NOT NULL,
            name TEXT NOT NULL,
            max_groups INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE CASCADE
        );

        -- Groups
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            specialty TEXT,
            course INTEGER,
            group_number INTEGER,
            admission_year INTEGER,
            type TEXT,
            curator_id TEXT,
            building_id TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            FOREIGN KEY(curator_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE SET NULL
        );

        -- User-Group relationship
        CREATE TABLE IF NOT EXISTS user_groups (
            user_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            PRIMARY KEY(user_id, group_id)
        );

        -- Subjects
        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );

        -- Group-Subject relationship (with teacher and hours)
        CREATE TABLE IF NOT EXISTS group_subjects (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            teacher_id TEXT,
            total_hours INTEGER NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE(group_id, subject_id)
        );

        -- Schedule: Weekly lessons template
        CREATE TABLE IF NOT EXISTS lessons (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            teacher_id TEXT NOT NULL,
            room_id TEXT,
            day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            lesson_type TEXT,
            FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
            FOREIGN KEY(teacher_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE SET NULL
        );

        -- Actual lessons (specific date instances)
        CREATE TABLE IF NOT EXISTS actual_lessons (
            id TEXT PRIMARY KEY,
            lesson_id TEXT NOT NULL,
            date TEXT NOT NULL,
            topic TEXT,
            homework TEXT,
            notes TEXT,
            FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
        );

        -- Marks/Grades
        CREATE TABLE IF NOT EXISTS marks (
            id TEXT PRIMARY KEY,
            actual_lesson_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            value TEXT,
            comment TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(actual_lesson_id) REFERENCES actual_lessons(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Attendance
        CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY,
            actual_lesson_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
            note TEXT,
            FOREIGN KEY(actual_lesson_id) REFERENCES actual_lessons(id) ON DELETE CASCADE,
            FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Events (Calendar)
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            organization_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            end_date TEXT,
            end_time TEXT,
            event_type TEXT NOT NULL CHECK(event_type IN ('plan', 'task', 'lesson')),
            content TEXT,
            subtasks TEXT,
            recurring_options TEXT,
            privacy TEXT NOT NULL DEFAULT 'private',
            password_hash TEXT,
            expiration_days INTEGER,
            version INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL
        );

        -- Shared events
        CREATE TABLE IF NOT EXISTS shared_events (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            accepted BOOLEAN,
            reason TEXT,
            forbid_edit BOOLEAN DEFAULT 0,
            allow_comments BOOLEAN DEFAULT 0,
            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Event history
        CREATE TABLE IF NOT EXISTS event_history (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            field TEXT,
            old_value TEXT,
            new_value TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Comments on events
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Chats
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK(type IN ('direct', 'group')),
            name TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            organization_id TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE SET NULL
        );

        -- Chat members
        CREATE TABLE IF NOT EXISTS chat_members (
            chat_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            joined_at INTEGER DEFAULT (strftime('%s', 'now')),
            last_read_at INTEGER,
            FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY(chat_id, user_id)
        );

        -- Messages
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            subject TEXT,
            content TEXT NOT NULL,
            sent_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
            edited_at INTEGER,
            reply_to TEXT,
            FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE,
            FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(reply_to) REFERENCES messages(id) ON DELETE SET NULL
        );

        -- Message attachments
        CREATE TABLE IF NOT EXISTS message_attachments (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            filename TEXT NOT NULL,
            file_data BLOB NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT,
            uploaded_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        -- Notifications
        CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            is_read BOOLEAN DEFAULT 0,
            sent_to_telegram BOOLEAN DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Audit logs
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity_id TEXT,
            old_value TEXT,
            new_value TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_actual_lessons_date ON actual_lessons(date);
        CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
        CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
        """
        )
        db.commit()


init_db()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def get_auth_user():
    """Получить user_id из JWT токена"""
    token = request.headers.get("Authorization")
    if token:
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            return data.get("user_id")  # Возвращаем user_id (TEXT UUID)
        except:
            pass
    return None


def get_user_id(username):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    return row[0] if row else None


def get_user_role(user_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT current_role FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    return row["current_role"] if row else None


@app.route("/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS":
        return "", 200
    return jsonify({"status": "ok"})


def generate_verification_code():
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])


def get_user_id(username):
    """DEPRECATED - используйте get_auth_user напрямую для получения ID"""
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    return row["id"] if row else None


@app.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    username = data.get("username")
    password = data.get("password")
    email = data.get("email")

    if not username or not password or not email:
        return jsonify({"error": "All fields required"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверка существующих
    cur.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?", (username, email)
    )
    if cur.fetchone():
        return jsonify({"error": "Username or email exists"}), 400

    # Генерация UUID ID
    user_id = generate_uuid()
    code = generate_verification_code()
    expires = int(time.time()) + 600  # 10 минут

    hashed = hash_password(password)
    cur.execute(
        """
        INSERT INTO users (id, username, password_hash, email, verification_code, 
                          verification_expires, roles, current_role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            user_id,
            username,
            hashed,
            email,
            code,
            expires,
            json.dumps(["student"]),
            "student",
            int(time.time()),
        ),
    )
    db.commit()

    # Отправка email
    subject = "KipCalendar - Код подтверждения"
    body = f"Ваш код: {code}\nДействителен 10 минут."
    html_body = f"""
    <html><body style="font-family: Arial;">
        <h2 style="color: #6366f1;">Добро пожаловать в KipCalendar!</h2>
        <p>Ваш код подтверждения:</p>
        <h1 style="color: #6366f1; letter-spacing: 5px;">{code}</h1>
        <p>Действителен 10 минут.</p>
        <p>Ваш User ID: <code>{user_id}</code></p>
    </body></html>
    """
    send_email(email, subject, body, html_body)

    log_audit(user_id, "USER_REGISTERED")

    return jsonify({"message": "Code sent", "email": email, "user_id": user_id})


@app.route("/verify", methods=["POST", "OPTIONS"])
def verify_email():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    email = data.get("email")
    code = data.get("code")

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user["email_verified"]:
        return jsonify({"error": "Already verified"}), 400

    if user["verification_code"] != code:
        return jsonify({"error": "Invalid code"}), 400

    if user["verification_expires"] < int(time.time()):
        return jsonify({"error": "Code expired"}), 400

    cur.execute("UPDATE users SET email_verified = 1 WHERE email = ?", (email,))
    db.commit()

    # Генерация токена с user_id (TEXT)
    token = jwt.encode(
        {
            "user_id": user["id"],  # Теперь это TEXT (UUID)
            "username": user["username"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    log_audit(user["id"], "EMAIL_VERIFIED")

    return jsonify({"token": token, "user_id": user["id"]})


@app.route("/resend-code", methods=["POST", "OPTIONS"])
def resend_code():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    email = data.get("email")

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cur.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    if user["email_verified"]:
        return jsonify({"error": "Already verified"}), 400

    code = generate_verification_code()
    expires = int(time.time()) + 600

    cur.execute(
        "UPDATE users SET verification_code = ?, verification_expires = ? WHERE email = ?",
        (code, expires, email),
    )
    db.commit()

    subject = "KipCalendar - Новый код"
    body = f"Ваш новый код: {code}\nДействителен 10 минут."
    send_email(email, subject, body)

    return jsonify({"message": "Code sent"})


@app.route("/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    username = data.get("username")
    password = data.get("password")

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    user = cur.fetchone()

    if not user or user["password_hash"] != hash_password(password):
        return jsonify({"error": "Invalid credentials"}), 401

    if not user["email_verified"]:
        return jsonify({"error": "Email not verified", "email": user["email"]}), 403

    token = jwt.encode(
        {
            "user_id": user["id"],  # TEXT UUID
            "username": user["username"],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30),
        },
        SECRET_KEY,
        algorithm="HS256",
    )

    log_audit(user["id"], "USER_LOGIN")

    return jsonify({"token": token, "user_id": user["id"]})


@app.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return "", 200
    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET logout_timestamp = ? WHERE id = ?",
        (int(time.time()), user_id),
    )
    db.commit()

    log_audit(user_id, "USER_LOGOUT")

    return jsonify({"message": "Logged out"})


@app.route("/role", methods=["GET"])
def get_role():
    user_id = get_auth_user()  # Теперь возвращает user_id напрямую
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT roles, current_role FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify(
        {"roles": json.loads(user["roles"]), "currentRole": user["current_role"]}
    )


@app.route("/switch-role", methods=["POST"])
def switch_role():
    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    new_role = data.get("newRole")

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT roles FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()

    if not user:
        return jsonify({"error": "User not found"}), 404

    roles = json.loads(user["roles"])
    if new_role not in roles:
        return jsonify({"error": "Invalid role"}), 400

    cur.execute("UPDATE users SET current_role = ? WHERE id = ?", (new_role, user_id))
    db.commit()

    log_audit(
        user_id,
        "ROLE_SWITCHED",
        details={"old_role": user["current_role"], "new_role": new_role},
    )

    return jsonify({"message": "Role switched"})


@app.route("/events", methods=["GET", "OPTIONS"])
def get_events():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Собственные события
    cur.execute("SELECT * FROM events WHERE owner_id = ?", (user_id,))
    own_events = cur.fetchall()

    # Shared события
    cur.execute(
        """
    SELECT e.* FROM events e
    JOIN shared_events s ON e.id = s.event_id
    WHERE s.user_id = ? AND s.accepted = 1
    """,
        (user_id,),
    )
    shared_events = cur.fetchall()

    all_events = [dict(row) for row in own_events + shared_events]

    for ev in all_events:
        ev["recurring_options"] = (
            json.loads(ev["recurring_options"]) if ev["recurring_options"] else None
        )
        ev["subtasks"] = json.loads(ev["subtasks"]) if ev["subtasks"] else None
        ev["type"] = ev["privacy"]
        ev["name"] = str(ev["id"])
        ev["eventType"] = ev["event_type"]

    return jsonify(all_events)


@app.route("/api/events/create-plan", methods=["POST", "OPTIONS"])
def create_plan():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    db = get_db()
    cur = db.cursor()

    # Получаем username для URL
    cur.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    username = user["username"]

    recurring = (
        json.dumps(data.get("recurringOptions"))
        if data.get("recurringOptions")
        else None
    )
    password_hash = (
        hash_password(data["password"])
        if data.get("privacy") == "private" and data.get("password")
        else None
    )

    event_id = generate_uuid()

    cur.execute(
        """
    INSERT INTO events (id, owner_id, title, date, time, description, event_type, content, 
                       end_date, end_time, recurring_options, privacy, password_hash, 
                       expiration_days, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'plan', ?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            event_id,
            user_id,
            data["title"],
            data["date"],
            data["time"],
            data.get("description", ""),
            data.get("content", ""),
            data.get("endDate"),
            data.get("endTime"),
            recurring,
            data["privacy"],
            password_hash,
            data.get("expirationDays"),
            int(time.time()),
        ),
    )
    db.commit()

    log_audit(user_id, "EVENT_CREATED", event_id)

    url = f"http://localhost:3000/event/{username}/{data['privacy']}/{event_id}"
    return jsonify({"url": url, "event_id": event_id})


@app.route("/api/events/create-task", methods=["POST", "OPTIONS"])
def create_task():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()  # Получаем напрямую user_id
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    db = get_db()
    cur = db.cursor()

    # Получаем username для URL
    cur.execute("SELECT username FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    username = user["username"]

    raw_subtasks = data.get("subTasks")
    if raw_subtasks:
        subtasks = json.dumps(raw_subtasks)
    else:
        main_subtask = [
            {
                "name": data["title"],
                "description": data.get("description", ""),
                "deadline": "",
                "priority": "medium",
                "status": "open",
            }
        ]
        subtasks = json.dumps(main_subtask)

    password_hash = (
        hash_password(data["password"])
        if data.get("privacy") == "private" and data.get("password")
        else None
    )

    # Генерируем UUID для события
    event_id = generate_uuid()

    cur.execute(
        """
    INSERT INTO events (id, owner_id, title, date, time, description, event_type, 
                       subtasks, privacy, password_hash, expiration_days, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'task', ?, ?, ?, ?, ?)
    """,
        (
            event_id,
            user_id,  # Теперь это TEXT UUID
            data["title"],
            datetime.datetime.now().strftime("%Y-%m-%d"),
            datetime.datetime.now().strftime("%H:%M"),
            data.get("description", ""),
            subtasks,
            data["privacy"],
            password_hash,
            data.get("expirationDays"),
            int(time.time()),
        ),
    )
    db.commit()

    log_audit(user_id, "EVENT_CREATED", event_id)

    url = f"http://localhost:3000/event/{username}/{data['privacy']}/{event_id}"
    return jsonify({"url": url, "event_id": event_id})


@app.route("/event/<username>/<privacy>/<name>", methods=["GET", "OPTIONS"])
def view_event(username, privacy, name):
    if request.method == "OPTIONS":
        return "", 200

    event_id = name  # UUID string
    db = get_db()
    cur = db.cursor()

    # Получаем событие
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cur.fetchone()

    if not event:
        return jsonify({"error": "Event not found"}), 404

    # Получаем владельца
    cur.execute("SELECT id, username FROM users WHERE id = ?", (event["owner_id"],))
    owner = cur.fetchone()

    if not owner:
        return jsonify({"error": "Owner not found"}), 404

    # Проверяем права доступа
    auth_user_id = get_auth_user()
    is_owner = auth_user_id == event["owner_id"]

    # Проверяем shared access
    is_shared_user = False
    if auth_user_id and not is_owner:
        cur.execute(
            "SELECT * FROM shared_events WHERE event_id = ? AND user_id = ? AND accepted = 1",
            (event_id, auth_user_id),
        )
        if cur.fetchone():
            is_shared_user = True

    # Публичные события доступны всем
    if event["privacy"] == "public":
        pass  # Доступ разрешён
    elif event["privacy"] == "private":
        # Приватные события требуют либо ownership, либо shared access, либо пароль
        if not is_owner and not is_shared_user:
            # Проверяем пароль если есть
            if event["password_hash"]:
                password_param = request.args.get("password")
                if (
                    not password_param
                    or hash_password(password_param) != event["password_hash"]
                ):
                    return (
                        jsonify(
                            {"error": "Password required", "requires_password": True}
                        ),
                        403,
                    )
            else:
                # Приватное без пароля - только для owner и shared users
                return jsonify({"error": "Access denied"}), 403

        # Проверяем срок действия
        if event["expiration_days"]:
            event_created = event.get("created_at", 0)
            if int(time.time()) - event_created > (
                event["expiration_days"] * 24 * 60 * 60
            ):
                return jsonify({"error": "Event expired"}), 410

    # Формируем ответ
    ev_dict = dict(event)
    ev_dict["recurring_options"] = (
        json.loads(ev_dict["recurring_options"])
        if ev_dict["recurring_options"]
        else None
    )
    ev_dict["subtasks"] = (
        json.loads(ev_dict["subtasks"]) if ev_dict["subtasks"] else None
    )
    ev_dict["eventType"] = ev_dict["event_type"]
    ev_dict["type"] = privacy
    ev_dict["name"] = name

    # Дополнительная информация
    cur.execute(
        "SELECT COUNT(*) as count FROM shared_events WHERE event_id = ?", (event_id,)
    )
    ev_dict["shared"] = cur.fetchone()["count"] > 0

    cur.execute(
        "SELECT allow_comments FROM shared_events WHERE event_id = ? LIMIT 1",
        (event_id,),
    )
    share = cur.fetchone()
    ev_dict["allowComments"] = share["allow_comments"] if share else False

    # Добавляем информацию о владельце
    ev_dict["owner_username"] = owner["username"]
    ev_dict["is_owner"] = is_owner
    ev_dict["can_edit"] = is_owner or is_shared_user

    # Скрываем чувствительные данные
    ev_dict.pop("password_hash", None)

    return jsonify(ev_dict)


@app.route("/event/<privacy>/<name>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_event(privacy, name):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    event_id = name
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cur.fetchone()

    if not event:
        return jsonify({"error": "Not found"}), 404

    can_edit = event["owner_id"] == user_id
    if not can_edit:
        cur.execute(
            "SELECT forbid_edit FROM shared_events WHERE event_id = ? AND user_id = ?",
            (event_id, user_id),
        )
        share = cur.fetchone()
        if share and not share["forbid_edit"]:
            can_edit = True

    if not can_edit:
        return jsonify({"error": "No permission"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM events WHERE id = ?", (event_id,))
        db.commit()
        log_audit(user_id, "EVENT_DELETED", event_id)
        return jsonify({"message": "Deleted"})
    else:
        data = request.json
        old_version = event["version"]
        updates = []
        update_fields = ["title", "date", "time", "description"]
        if event["event_type"] == "plan":
            update_fields += ["content", "end_date", "end_time", "recurring_options"]
        elif event["event_type"] == "task":
            update_fields += ["subtasks"]

        updated_event = dict(event)
        for field in update_fields:
            if field in data:
                old_val = event[field]
                new_val = (
                    json.dumps(data[field])
                    if field in ["recurring_options", "subtasks"]
                    else data[field]
                )
                if old_val != new_val:
                    updates.append((field, old_val, new_val))
                    updated_event[field] = new_val

        if "password" in data and data["password"]:
            updated_event["password_hash"] = hash_password(data["password"])

        set_clause = ", ".join(
            [f"{field} = ?" for field in update_fields if field in data]
        )
        if "password" in data:
            set_clause += ", password_hash = ?"
        set_clause += ", version = version + 1"

        params = [updated_event[field] for field in update_fields if field in data]
        if "password" in data:
            params.append(updated_event["password_hash"])
        params.extend([event_id, old_version])

        cur.execute(
            f"UPDATE events SET {set_clause} WHERE id = ? AND version = ?", params
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Conflict"}), 409
        db.commit()

        timestamp = int(time.time())
        for field, old, new in updates:
            history_id = generate_uuid()
            cur.execute(
                "INSERT INTO event_history (id, event_id, user_id, field, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (history_id, event_id, user_id, field, old, new, timestamp),
            )
        db.commit()

        # Notify через SocketIO
        cur.execute(
            "SELECT user_id FROM shared_events WHERE event_id = ? AND accepted = 1",
            (event_id,),
        )
        for row in cur.fetchall():
            socketio.emit(
                "event_update", {"event_id": event_id}, room=str(row["user_id"])
            )
        if event["owner_id"] != user_id:
            socketio.emit(
                "event_update", {"event_id": event_id}, room=str(event["owner_id"])
            )

        log_audit(user_id, "EVENT_UPDATED", event_id)

        return jsonify({"message": "Updated"})


@app.route("/api/events/<event_id>/share", methods=["POST", "OPTIONS"])
def share_event(event_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    users = data["users"]  # list of usernames
    forbid_edit = data.get("forbid_edit", False)
    allow_comments = data.get("allow_comments", False)

    db = get_db()
    cur = db.cursor()

    for username in users:
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cur.fetchone()
        if user:
            share_id = generate_uuid()
            cur.execute(
                "INSERT INTO shared_events (id, event_id, user_id, accepted, forbid_edit, allow_comments) VALUES (?, ?, ?, NULL, ?, ?)",
                (share_id, event_id, user["id"], forbid_edit, allow_comments),
            )
    db.commit()

    for username in users:
        cur.execute("SELECT id FROM users WHERE username = ?", (username,))
        user = cur.fetchone()
        if user:
            socketio.emit("new_share", {"event_id": event_id}, room=str(user["id"]))

    log_audit(user_id, "EVENT_SHARED", event_id)

    return jsonify({"message": "Shared"})


@app.route("/api/shares/pending", methods=["GET", "OPTIONS"])
def pending_shares():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
    SELECT s.id, e.title as name, e.event_type as type, e.date, e.time, u.username as sender
    FROM shared_events s
    JOIN events e ON s.event_id = e.id
    JOIN users u ON e.owner_id = u.id
    WHERE s.user_id = ? AND s.accepted IS NULL
    """,
        (user_id,),
    )
    return jsonify([dict(row) for row in cur.fetchall()])


@app.route("/api/shares/accept/<share_id>", methods=["POST", "OPTIONS"])
def accept_share(share_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE shared_events SET accepted = 1 WHERE id = ? AND user_id = ?",
        (share_id, user_id),
    )
    db.commit()

    log_audit(user_id, "SHARE_ACCEPTED", share_id)

    return jsonify({"message": "Accepted"})


@app.route("/api/shares/decline/<share_id>", methods=["POST", "OPTIONS"])
def decline_share(share_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    reason = data.get("reason")

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE shared_events SET accepted = 0, reason = ? WHERE id = ? AND user_id = ?",
        (reason, share_id, user_id),
    )
    db.commit()

    cur.execute(
        "SELECT e.owner_id FROM events e JOIN shared_events s ON e.id = s.event_id WHERE s.id = ?",
        (share_id,),
    )
    row = cur.fetchone()
    if row:
        sender_id = row["owner_id"]
        socketio.emit(
            "share_declined",
            {"share_id": share_id, "reason": reason},
            room=str(sender_id),
        )

    log_audit(user_id, "SHARE_DECLINED", share_id)

    return jsonify({"message": "Declined"})


@app.route("/api/users/get-by-role", methods=["GET", "OPTIONS"])
def get_users_by_role():
    """Получить список пользователей по роли"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    role = request.args.get("role")
    organization_id = request.args.get("organization_id")

    if not role:
        return jsonify({"error": "role parameter required"}), 400

    db = get_db()
    cur = db.cursor()

    if organization_id:
        # Получаем пользователей организации с определенной ролью
        cur.execute(
            """SELECT u.id, u.username, u.email, u.first_name, u.last_name,
                      om.roles, om.current_role
               FROM users u
               JOIN organization_members om ON u.id = om.user_id
               WHERE om.organization_id = ? AND om.roles LIKE ?
               ORDER BY u.last_name, u.first_name""",
            (organization_id, f'%"{role}"%'),
        )
    else:
        # Получаем всех пользователей с этой ролью в системе
        cur.execute(
            """SELECT id, username, email, first_name, last_name, roles, current_role
               FROM users
               WHERE roles LIKE ?
               ORDER BY last_name, first_name""",
            (f'%"{role}"%',),
        )

    users = []
    for row in cur.fetchall():
        user_dict = dict(row)
        user_dict["roles"] = (
            json.loads(user_dict["roles"])
            if isinstance(user_dict["roles"], str)
            else user_dict["roles"]
        )
        users.append(user_dict)

    return jsonify(users)


@app.route("/api/users/search", methods=["GET", "OPTIONS"])
def search_users_advanced():
    """Расширенный поиск пользователей"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    query = request.args.get("q", "").strip()
    organization_id = request.args.get("organization_id")
    role = request.args.get("role")
    limit = int(request.args.get("limit", 20))

    if len(query) < 2:
        return jsonify({"error": "Query too short (min 2 characters)"}), 400

    db = get_db()
    cur = db.cursor()

    # Формируем запрос
    if organization_id:
        sql = """
            SELECT u.id, u.username, u.email, u.first_name, u.last_name,
                   om.roles, om.current_role
            FROM users u
            JOIN organization_members om ON u.id = om.user_id
            WHERE om.organization_id = ?
            AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)
        """
        params = [
            organization_id,
            f"%{query}%",
            f"%{query}%",
            f"%{query}%",
            f"%{query}%",
        ]

        if role:
            sql += " AND om.roles LIKE ?"
            params.append(f'%"{role}"%')

        sql += " ORDER BY u.last_name, u.first_name LIMIT ?"
        params.append(limit)

        cur.execute(sql, params)
    else:
        sql = """
            SELECT id, username, email, first_name, last_name, roles, current_role
            FROM users
            WHERE username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?
        """
        params = [f"%{query}%", f"%{query}%", f"%{query}%", f"%{query}%"]

        if role:
            sql += " AND roles LIKE ?"
            params.append(f'%"{role}"%')

        sql += " ORDER BY last_name, first_name LIMIT ?"
        params.append(limit)

        cur.execute(sql, params)

    users = []
    for row in cur.fetchall():
        user_dict = dict(row)
        user_dict["roles"] = (
            json.loads(user_dict["roles"])
            if isinstance(user_dict["roles"], str)
            else user_dict["roles"]
        )
        users.append(user_dict)

    return jsonify(users)


@app.route("/api/users/<target_user_id>/profile", methods=["GET", "OPTIONS"])
def get_user_profile(target_user_id):
    """Получить профиль пользователя"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Базовая информация
    cur.execute(
        """SELECT id, username, email, first_name, last_name, middle_name,
                  roles, current_role, created_at, telegram_id
           FROM users WHERE id = ?""",
        (target_user_id,),
    )

    user = cur.fetchone()
    if not user:
        return jsonify({"error": "User not found"}), 404

    user_dict = dict(user)
    user_dict["roles"] = json.loads(user_dict["roles"])

    # Скрываем чувствительные данные если не свой профиль
    if user_id != target_user_id:
        user_dict.pop("email", None)
        user_dict["telegram_linked"] = bool(user_dict.pop("telegram_id", None))
    else:
        user_dict["telegram_linked"] = bool(user_dict.get("telegram_id"))
        user_dict.pop("telegram_id", None)

    # Получаем организации пользователя
    cur.execute(
        """SELECT o.id, o.name, o.short_name, om.roles, om.current_role
           FROM organizations o
           JOIN organization_members om ON o.id = om.organization_id
           WHERE om.user_id = ?""",
        (target_user_id,),
    )

    organizations = []
    for row in cur.fetchall():
        org_dict = dict(row)
        org_dict["roles"] = json.loads(org_dict["roles"])
        organizations.append(org_dict)

    user_dict["organizations"] = organizations

    # Если студент - получаем группы
    if "student" in user_dict["roles"]:
        cur.execute(
            """SELECT g.id, g.name, g.specialty, g.course, o.name as organization_name
               FROM groups g
               JOIN user_groups ug ON g.id = ug.group_id
               JOIN organizations o ON g.organization_id = o.id
               WHERE ug.user_id = ?""",
            (target_user_id,),
        )
        user_dict["groups"] = [dict(row) for row in cur.fetchall()]

    # Если преподаватель - получаем предметы
    if "teacher" in user_dict["roles"]:
        cur.execute(
            """SELECT DISTINCT s.id, s.name, s.code, o.name as organization_name
               FROM subjects s
               JOIN group_subjects gs ON s.id = gs.subject_id
               JOIN groups g ON gs.group_id = g.id
               JOIN organizations o ON g.organization_id = o.id
               WHERE gs.teacher_id = ?""",
            (target_user_id,),
        )
        user_dict["subjects"] = [dict(row) for row in cur.fetchall()]

    return jsonify(user_dict)


@app.route("/api/users/me/update", methods=["PUT", "OPTIONS"])
def update_own_profile():
    """Обновить свой профиль"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json

    db = get_db()
    cur = db.cursor()

    # Разрешённые поля для обновления
    allowed_fields = ["first_name", "last_name", "middle_name", "email"]

    updates = []
    values = []

    for field in allowed_fields:
        if field in data:
            updates.append(f"{field} = ?")
            values.append(data[field])

    if not updates:
        return jsonify({"error": "No fields to update"}), 400

    # Проверяем уникальность email если обновляется
    if "email" in data:
        cur.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?", (data["email"], user_id)
        )
        if cur.fetchone():
            return jsonify({"error": "Email already in use"}), 400

    values.append(user_id)

    sql = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    cur.execute(sql, values)
    db.commit()

    log_audit(user_id, "PROFILE_UPDATED", user_id)

    return jsonify({"message": "Profile updated"})


@app.route("/api/telegram/link", methods=["POST", "OPTIONS"])
def link_telegram():
    """Привязать Telegram аккаунт"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    telegram_id = data.get("telegram_id")
    verification_code = data.get("verification_code")  # Для безопасности

    if not telegram_id:
        return jsonify({"error": "telegram_id required"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверяем, не занят ли telegram_id
    cur.execute(
        "SELECT id FROM users WHERE telegram_id = ? AND id != ?", (telegram_id, user_id)
    )
    if cur.fetchone():
        return jsonify({"error": "Telegram ID already linked to another account"}), 400

    # Обновляем
    cur.execute("UPDATE users SET telegram_id = ? WHERE id = ?", (telegram_id, user_id))
    db.commit()

    log_audit(user_id, "TELEGRAM_LINKED", user_id)

    return jsonify({"message": "Telegram linked successfully"})


@app.route("/api/telegram/unlink", methods=["POST", "OPTIONS"])
def unlink_telegram():
    """Отвязать Telegram аккаунт"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute("UPDATE users SET telegram_id = NULL WHERE id = ?", (user_id,))
    db.commit()

    log_audit(user_id, "TELEGRAM_UNLINKED", user_id)

    return jsonify({"message": "Telegram unlinked"})


@app.route("/api/organizations/<org_id>/members", methods=["GET", "OPTIONS"])
def get_organization_members(org_id):
    """Получить список участников организации"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Проверяем членство
    db = get_db()
    cur = db.cursor()

    cur.execute(
        "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
        (org_id, user_id),
    )
    if not cur.fetchone():
        return jsonify({"error": "Not a member"}), 403

    # Получаем всех участников
    role_filter = request.args.get("role")  # фильтр по роли

    query = """
        SELECT u.id, u.username, u.first_name, u.last_name, u.email,
               om.roles, om.current_role, om.joined_at
        FROM users u
        JOIN organization_members om ON u.id = om.user_id
        WHERE om.organization_id = ?
    """
    params = [org_id]

    if role_filter:
        query += " AND om.roles LIKE ?"
        params.append(f'%"{role_filter}"%')

    query += " ORDER BY u.last_name, u.first_name"

    cur.execute(query, params)

    members = []
    for row in cur.fetchall():
        member_dict = dict(row)
        member_dict["roles"] = json.loads(member_dict["roles"])
        members.append(member_dict)

    return jsonify(
        {"organization_id": org_id, "members": members, "total": len(members)}
    )


@app.route("/api/events/<event_id>/comments", methods=["GET", "POST", "OPTIONS"])
def event_comments(event_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    if request.method == "GET":
        cur.execute(
            "SELECT c.*, u.username FROM comments c JOIN users u ON c.user_id = u.id WHERE event_id = ? ORDER BY timestamp",
            (event_id,),
        )
        return jsonify([dict(row) for row in cur.fetchall()])
    else:
        data = request.json
        content = data["content"]
        timestamp = int(time.time())
        comment_id = generate_uuid()

        cur.execute(
            "INSERT INTO comments (id, event_id, user_id, content, timestamp) VALUES (?, ?, ?, ?, ?)",
            (comment_id, event_id, user_id, content, timestamp),
        )
        db.commit()

        cur.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        username = cur.fetchone()["username"]

        log_audit(user_id, "COMMENT_ADDED", event_id)

        return jsonify(
            {
                "id": comment_id,
                "content": content,
                "user": username,
                "timestamp": timestamp,
            }
        )


@app.route("/api/events/<event_id>/history", methods=["GET", "OPTIONS"])
def event_history(event_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT h.*, u.username FROM event_history h JOIN users u ON h.user_id = u.id WHERE event_id = ? ORDER BY timestamp",
        (event_id,),
    )
    return jsonify([dict(row) for row in cur.fetchall()])


@app.route("/api/marks/add", methods=["POST", "OPTIONS"])
def add_mark():
    """Добавить оценку студенту"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    actual_lesson_id = data.get("actual_lesson_id")
    student_id = data.get("student_id")
    mark_value = data.get("value")
    comment = data.get("comment")

    if not all([actual_lesson_id, student_id, mark_value]):
        return jsonify({"error": "Missing required fields"}), 400

    db = get_db()
    cur = db.cursor()

    # Добавляем оценку
    mark_id = generate_uuid()
    cur.execute(
        """INSERT INTO marks (id, actual_lesson_id, student_id, value, comment, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)""",
        (mark_id, actual_lesson_id, student_id, mark_value, comment, int(time.time())),
    )
    db.commit()

    # Получаем информацию о предмете для уведомления
    cur.execute(
        """SELECT s.name as subject_name
           FROM actual_lessons al
           JOIN lessons l ON al.lesson_id = l.id
           JOIN subjects s ON l.subject_id = s.id
           WHERE al.id = ?""",
        (actual_lesson_id,),
    )
    subject_info = cur.fetchone()
    subject_name = subject_info["subject_name"] if subject_info else "предмету"

    # Уведомление студенту
    notif_content = f"Новая оценка по {subject_name}: {mark_value}"
    if comment:
        notif_content += f". {comment}"

    create_notification(student_id, "grade", notif_content)

    # Email уведомление
    cur.execute("SELECT email, username FROM users WHERE id = ?", (student_id,))
    student = cur.fetchone()
    if student and student["email"]:
        subject = "Новая оценка в KipCalendar"
        body = f"Здравствуйте, {student['username']}!\n\n{notif_content}"
        send_email(student["email"], subject, body)

    log_audit(user_id, "MARK_ADDED", mark_id)

    return jsonify({"message": "Mark added", "mark_id": mark_id})


@app.route("/api/marks/<mark_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_mark(mark_id):
    """Изменить или удалить оценку"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT * FROM marks WHERE id = ?", (mark_id,))
    mark = cur.fetchone()

    if not mark:
        return jsonify({"error": "Mark not found"}), 404

    if request.method == "DELETE":
        cur.execute("DELETE FROM marks WHERE id = ?", (mark_id,))
        db.commit()
        log_audit(user_id, "MARK_DELETED", mark_id)
        return jsonify({"message": "Mark deleted"})

    else:  # PUT
        data = request.json
        cur.execute(
            "UPDATE marks SET value = ?, comment = ? WHERE id = ?",
            (
                data.get("value", mark["value"]),
                data.get("comment", mark["comment"]),
                mark_id,
            ),
        )
        db.commit()
        log_audit(user_id, "MARK_UPDATED", mark_id)
        return jsonify({"message": "Mark updated"})


@app.route(
    "/api/marks/student/<student_id>/subject/<subject_id>", methods=["GET", "OPTIONS"]
)
def get_student_marks(student_id, subject_id):
    """Получить все оценки студента по предмету"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        """SELECT m.*, al.date, al.topic, u.username as teacher_name
           FROM marks m
           JOIN actual_lessons al ON m.actual_lesson_id = al.id
           JOIN lessons l ON al.lesson_id = l.id
           JOIN users u ON l.teacher_id = u.id
           WHERE m.student_id = ? AND l.subject_id = ?
           ORDER BY al.date DESC""",
        (student_id, subject_id),
    )

    return jsonify([dict(row) for row in cur.fetchall()])


# ============ ATTENDANCE API ============


@app.route("/api/attendance/add", methods=["POST", "OPTIONS"])
def add_attendance():
    """Отметить посещаемость"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    actual_lesson_id = data.get("actual_lesson_id")
    student_id = data.get("student_id")
    status = data.get("status")  # present, absent, late
    note = data.get("note")

    if not all([actual_lesson_id, student_id, status]):
        return jsonify({"error": "Missing required fields"}), 400

    if status not in ["present", "absent", "late"]:
        return jsonify({"error": "Invalid status"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверяем существование записи
    cur.execute(
        "SELECT id FROM attendance WHERE actual_lesson_id = ? AND student_id = ?",
        (actual_lesson_id, student_id),
    )
    existing = cur.fetchone()

    if existing:
        # Обновляем
        cur.execute(
            "UPDATE attendance SET status = ?, note = ? WHERE id = ?",
            (status, note, existing["id"]),
        )
        attendance_id = existing["id"]
    else:
        # Создаем новую
        attendance_id = generate_uuid()
        cur.execute(
            "INSERT INTO attendance (id, actual_lesson_id, student_id, status, note) VALUES (?, ?, ?, ?, ?)",
            (attendance_id, actual_lesson_id, student_id, status, note),
        )

    db.commit()
    log_audit(user_id, "ATTENDANCE_MARKED", attendance_id)

    return jsonify({"message": "Attendance marked", "attendance_id": attendance_id})


@app.route("/api/attendance/<attendance_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_attendance(attendance_id):
    """Изменить или удалить отметку посещаемости"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    if request.method == "DELETE":
        cur.execute("DELETE FROM attendance WHERE id = ?", (attendance_id,))
        db.commit()
        log_audit(user_id, "ATTENDANCE_DELETED", attendance_id)
        return jsonify({"message": "Attendance deleted"})

    else:  # PUT
        data = request.json
        cur.execute(
            "UPDATE attendance SET status = ?, note = ? WHERE id = ?",
            (data.get("status"), data.get("note"), attendance_id),
        )
        db.commit()
        log_audit(user_id, "ATTENDANCE_UPDATED", attendance_id)
        return jsonify({"message": "Attendance updated"})


@app.route("/api/attendance/student/<student_id>", methods=["GET", "OPTIONS"])
def get_student_attendance(student_id):
    """Получить историю посещаемости студента"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        """SELECT a.*, al.date, s.name as subject_name, l.start_time, l.end_time
           FROM attendance a
           JOIN actual_lessons al ON a.actual_lesson_id = al.id
           JOIN lessons l ON al.lesson_id = l.id
           JOIN subjects s ON l.subject_id = s.id
           WHERE a.student_id = ?
           ORDER BY al.date DESC, l.start_time""",
        (student_id,),
    )

    return jsonify([dict(row) for row in cur.fetchall()])


# ============ JOURNAL SUMMARY API ============


@app.route("/api/journal/student/<student_id>/summary", methods=["GET", "OPTIONS"])
def get_student_journal_summary(student_id):
    """Получить сводку по журналу студента (все предметы, оценки, посещаемость)"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Проверяем права: либо сам студент, либо учитель/админ его группы
    if user_id != student_id:
        # TODO: добавить проверку прав учителя/админа
        pass

    db = get_db()
    cur = db.cursor()

    # Получаем группы студента
    cur.execute(
        """SELECT g.id, g.name, o.name as organization_name
           FROM user_groups ug
           JOIN groups g ON ug.group_id = g.id
           JOIN organizations o ON g.organization_id = o.id
           WHERE ug.user_id = ?""",
        (student_id,),
    )
    groups = [dict(row) for row in cur.fetchall()]

    summary = []

    for group in groups:
        # Получаем предметы группы
        cur.execute(
            """SELECT gs.*, s.name as subject_name
               FROM group_subjects gs
               JOIN subjects s ON gs.subject_id = s.id
               WHERE gs.group_id = ?""",
            (group["id"],),
        )
        subjects = cur.fetchall()

        for subject in subjects:
            # Получаем оценки
            cur.execute(
                """SELECT m.value, m.created_at, al.date
                   FROM marks m
                   JOIN actual_lessons al ON m.actual_lesson_id = al.id
                   JOIN lessons l ON al.lesson_id = l.id
                   WHERE m.student_id = ? AND l.subject_id = ?
                   ORDER BY al.date DESC""",
                (student_id, subject["subject_id"]),
            )
            marks = [dict(row) for row in cur.fetchall()]

            # Получаем посещаемость
            cur.execute(
                """SELECT a.status, al.date
                   FROM attendance a
                   JOIN actual_lessons al ON a.actual_lesson_id = al.id
                   JOIN lessons l ON al.lesson_id = l.id
                   WHERE a.student_id = ? AND l.subject_id = ?
                   ORDER BY al.date DESC""",
                (student_id, subject["subject_id"]),
            )
            attendance = [dict(row) for row in cur.fetchall()]

            # Подсчитываем статистику
            total_lessons = len(attendance)
            present_count = sum(1 for a in attendance if a["status"] == "present")
            absent_count = sum(1 for a in attendance if a["status"] == "absent")
            late_count = sum(1 for a in attendance if a["status"] == "late")

            # Средняя оценка (если оценки числовые)
            try:
                numeric_marks = [float(m["value"]) for m in marks if m["value"]]
                avg_mark = (
                    sum(numeric_marks) / len(numeric_marks) if numeric_marks else None
                )
            except:
                avg_mark = None

            summary.append(
                {
                    "group_name": group["name"],
                    "subject_name": subject["subject_name"],
                    "subject_id": subject["subject_id"],
                    "total_hours": subject["total_hours"],
                    "marks": marks,
                    "marks_count": len(marks),
                    "average_mark": round(avg_mark, 2) if avg_mark else None,
                    "attendance": {
                        "total": total_lessons,
                        "present": present_count,
                        "absent": absent_count,
                        "late": late_count,
                        "attendance_rate": (
                            round(present_count / total_lessons * 100, 1)
                            if total_lessons > 0
                            else None
                        ),
                    },
                }
            )

    return jsonify({"student_id": student_id, "groups": groups, "subjects": summary})


# ========== МЕССЕНДЖЕР API ==========


@app.route("/api/user/search", methods=["GET", "OPTIONS"])
def search_users():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    email = request.args.get("email")
    search_user_id = request.args.get("user_id")

    db = get_db()
    cur = db.cursor()

    if email:
        cur.execute("SELECT id, username, email FROM users WHERE email = ?", (email,))
    elif search_user_id:
        cur.execute(
            "SELECT id, username, email FROM users WHERE id = ?", (search_user_id,)
        )
    else:
        return jsonify({"error": "Provide email or user_id"}), 400

    user = cur.fetchone()
    if user:
        return jsonify(dict(user))
    return jsonify({"error": "User not found"}), 404


@app.route("/api/chats/create", methods=["POST", "OPTIONS"])
def create_chat():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    target_user_id = data.get("user_id")

    db = get_db()
    cur = db.cursor()

    # Проверяем существующий чат
    cur.execute(
        """
        SELECT c.id FROM chats c
        JOIN chat_members cm1 ON c.id = cm1.chat_id
        JOIN chat_members cm2 ON c.id = cm2.chat_id
        WHERE c.type = 'direct' 
        AND cm1.user_id = ? AND cm2.user_id = ?
    """,
        (user_id, target_user_id),
    )

    existing = cur.fetchone()
    if existing:
        return jsonify({"chat_id": existing["id"]})

    # Создаем новый чат
    chat_id = generate_uuid()
    cur.execute(
        "INSERT INTO chats (id, type, created_at) VALUES (?, 'direct', ?)",
        (chat_id, int(time.time())),
    )

    cur.execute(
        "INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)",
        (chat_id, user_id, int(time.time())),
    )
    cur.execute(
        "INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)",
        (chat_id, target_user_id, int(time.time())),
    )

    db.commit()
    return jsonify({"chat_id": chat_id})


@app.route("/api/chats", methods=["GET", "OPTIONS"])
def get_chats():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        """
        SELECT c.id, c.type, c.name, c.created_at,
               (SELECT u.username FROM users u 
                JOIN chat_members cm ON u.id = cm.user_id 
                WHERE cm.chat_id = c.id AND cm.user_id != ? LIMIT 1) as other_user,
               (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) as message_count
        FROM chats c
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE cm.user_id = ?
        ORDER BY c.created_at DESC
    """,
        (user_id, user_id),
    )

    chats = [dict(row) for row in cur.fetchall()]
    return jsonify(chats)


@app.route("/api/chats/<chat_id>/messages", methods=["GET", "POST", "OPTIONS"])
def chat_messages(chat_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем доступ
    cur.execute(
        "SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?",
        (chat_id, user_id),
    )
    if not cur.fetchone():
        return jsonify({"error": "Access denied"}), 403

    if request.method == "GET":
        cur.execute(
            """
            SELECT m.*, u.username as sender_name,
                   (SELECT COUNT(*) FROM message_attachments WHERE message_id = m.id) as attachment_count
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.chat_id = ?
            ORDER BY m.sent_at ASC
        """,
            (chat_id,),
        )
        messages = [dict(row) for row in cur.fetchall()]
        return jsonify(messages)

    else:  # POST
        data = request.json
        content = data.get("content", "")
        subject = data.get("subject")
        reply_to = data.get("reply_to")

        if not content.strip():
            return jsonify({"error": "Content required"}), 400

        message_id = generate_uuid()
        cur.execute(
            """
            INSERT INTO messages (id, chat_id, sender_id, subject, content, sent_at, reply_to)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                message_id,
                chat_id,
                user_id,
                subject,
                content,
                int(time.time()),
                reply_to,
            ),
        )
        db.commit()

        # Emit через SocketIO
        cur.execute(
            "SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ?",
            (chat_id, user_id),
        )
        for member in cur.fetchall():
            socketio.emit(
                "new_message",
                {"chat_id": chat_id, "message_id": message_id, "content": content},
                room=str(member["user_id"]),
            )

        return jsonify({"message_id": message_id, "sent_at": int(time.time())})


@app.route("/api/messages/<int:message_id>/attach", methods=["POST", "OPTIONS"])
def attach_file(message_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    file = request.files["file"]
    filename = file.filename
    file_data = file.read()
    file_size = len(file_data)
    mime_type = file.content_type

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
        INSERT INTO message_attachments (message_id, filename, file_data, file_size, mime_type, uploaded_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (message_id, filename, file_data, file_size, mime_type, int(time.time())),
    )
    db.commit()

    return jsonify({"attachment_id": cur.lastrowid})


@app.route("/api/attachments/<int:attachment_id>", methods=["GET", "OPTIONS"])
def get_attachment(attachment_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT filename, file_data, mime_type FROM message_attachments WHERE id = ?",
        (attachment_id,),
    )
    att = cur.fetchone()

    if not att:
        return jsonify({"error": "Not found"}), 404

    from flask import send_file
    import io

    return send_file(
        io.BytesIO(att["file_data"]),
        mimetype=att["mime_type"],
        download_name=att["filename"],
    )


# ========== ОРГАНИЗАЦИИ API ==========


@app.route("/api/organizations/create", methods=["POST", "OPTIONS"])
def create_organization():
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    name = data.get("name")
    short_name = data.get("short_name")
    org_type = data.get("type", "education")

    if not name:
        return jsonify({"error": "Name required"}), 400

    db = get_db()
    cur = db.cursor()

    org_id = generate_uuid()
    cur.execute(
        """
        INSERT INTO organizations (id, name, short_name, type, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (org_id, name, short_name, org_type, int(time.time()), user_id),
    )

    # Создатель становится администратором
    member_id = generate_uuid()
    cur.execute(
        """
        INSERT INTO organization_members (id, organization_id, user_id, roles, current_role, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (member_id, org_id, user_id, json.dumps(["admin"]), "admin", int(time.time())),
    )

    db.commit()

    log_audit(user_id, "ORGANIZATION_CREATED", org_id)

    return jsonify({"organization_id": org_id})


@app.route(
    "/api/organizations/<org_id>/invitations/create", methods=["POST", "OPTIONS"]
)
def create_invitation(org_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    role = data.get("role")
    max_uses = data.get("max_uses", -1)

    if role not in ["admin", "teacher", "student"]:
        return jsonify({"error": "Invalid role"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверяем права (только админы)
    cur.execute(
        """
        SELECT roles FROM organization_members 
        WHERE organization_id = ? AND user_id = ?
    """,
        (org_id, user_id),
    )
    member = cur.fetchone()
    if not member or "admin" not in json.loads(member["roles"]):
        return jsonify({"error": "Permission denied"}), 403

    # Генерируем токен
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + (7 * 24 * 60 * 60)  # 7 дней

    invite_id = generate_uuid()
    cur.execute(
        """
        INSERT INTO invitations (id, organization_id, role, token, created_at, expires_at, max_uses)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """,
        (invite_id, org_id, role, token, int(time.time()), expires_at, max_uses),
    )
    db.commit()

    invite_url = f"http://localhost:3000/invite/{token}"

    log_audit(user_id, "INVITATION_CREATED", invite_id)

    return jsonify({"invite_url": invite_url, "token": token})


@app.route("/api/invitations/<token>", methods=["GET", "OPTIONS"])
def get_invitation(token):
    if request.method == "OPTIONS":
        return "", 200

    db = get_db()
    cur = db.cursor()
    cur.execute(
        """
        SELECT i.*, o.name as org_name, o.short_name as org_short_name
        FROM invitations i
        JOIN organizations o ON i.organization_id = o.id
        WHERE i.token = ?
    """,
        (token,),
    )
    invite = cur.fetchone()

    if not invite:
        return jsonify({"error": "Invalid invitation"}), 404

    if invite["expires_at"] < int(time.time()):
        return jsonify({"error": "Invitation expired"}), 410

    if invite["max_uses"] != -1 and invite["uses"] >= invite["max_uses"]:
        return jsonify({"error": "Invitation limit reached"}), 410

    return jsonify(dict(invite))


@app.route("/api/invitations/<token>/accept", methods=["POST", "OPTIONS"])
def accept_invitation(token):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    profile_data = data.get("profile_data", {})

    db = get_db()
    cur = db.cursor()

    # Проверяем приглашение
    cur.execute("SELECT * FROM invitations WHERE token = ?", (token,))
    invite = cur.fetchone()

    if not invite:
        return jsonify({"error": "Invalid invitation"}), 404

    if invite["expires_at"] < int(time.time()):
        return jsonify({"error": "Invitation expired"}), 410

    if invite["max_uses"] != -1 and invite["uses"] >= invite["max_uses"]:
        return jsonify({"error": "Invitation limit reached"}), 410

    org_id = invite["organization_id"]
    role = invite["role"]

    # Проверяем существующее членство
    cur.execute(
        """
        SELECT roles FROM organization_members 
        WHERE organization_id = ? AND user_id = ?
    """,
        (org_id, user_id),
    )
    existing = cur.fetchone()

    if existing:
        # Добавляем роль к существующим
        roles = json.loads(existing["roles"])
        if role not in roles:
            roles.append(role)
            cur.execute(
                """
                UPDATE organization_members 
                SET roles = ?, profile_data = ?
                WHERE organization_id = ? AND user_id = ?
            """,
                (json.dumps(roles), json.dumps(profile_data), org_id, user_id),
            )
    else:
        # Создаем новое членство
        member_id = generate_uuid()
        cur.execute(
            """
            INSERT INTO organization_members 
            (id, organization_id, user_id, roles, current_role, joined_at, profile_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
            (
                member_id,
                org_id,
                user_id,
                json.dumps([role]),
                role,
                int(time.time()),
                json.dumps(profile_data),
            ),
        )

    # Увеличиваем счетчик использований
    cur.execute("UPDATE invitations SET uses = uses + 1 WHERE id = ?", (invite["id"],))
    db.commit()

    log_audit(user_id, "INVITATION_ACCEPTED", invite["id"])

    return jsonify({"message": "Joined organization", "organization_id": org_id})


# ============ BUILDINGS & ROOMS API ============


@app.route("/api/organizations/<org_id>/buildings", methods=["GET", "POST", "OPTIONS"])
def manage_buildings(org_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем членство в организации
    if not check_organization_permission(user_id, org_id, "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "GET":
        # Получить список зданий
        cur.execute(
            "SELECT * FROM buildings WHERE organization_id = ? ORDER BY name", (org_id,)
        )
        buildings = [dict(row) for row in cur.fetchall()]

        # Для каждого здания получаем комнаты
        for building in buildings:
            cur.execute(
                "SELECT * FROM rooms WHERE building_id = ? ORDER BY name",
                (building["id"],),
            )
            building["rooms"] = [dict(row) for row in cur.fetchall()]

        return jsonify(buildings)

    else:  # POST - создание здания
        data = request.json
        name = data.get("name")
        address = data.get("address")

        if not name:
            return jsonify({"error": "Name required"}), 400

        building_id = generate_uuid()
        cur.execute(
            "INSERT INTO buildings (id, organization_id, name, address) VALUES (?, ?, ?, ?)",
            (building_id, org_id, name, address),
        )
        db.commit()

        log_audit(user_id, "BUILDING_CREATED", building_id)

        return jsonify({"building_id": building_id, "message": "Building created"}), 201


@app.route("/api/buildings/<building_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_building(building_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем здание и проверяем права
    cur.execute("SELECT * FROM buildings WHERE id = ?", (building_id,))
    building = cur.fetchone()

    if not building:
        return jsonify({"error": "Building not found"}), 404

    if not check_organization_permission(user_id, building["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM buildings WHERE id = ?", (building_id,))
        db.commit()
        log_audit(user_id, "BUILDING_DELETED", building_id)
        return jsonify({"message": "Building deleted"})

    else:  # PUT - обновление
        data = request.json
        name = data.get("name", building["name"])
        address = data.get("address", building["address"])

        cur.execute(
            "UPDATE buildings SET name = ?, address = ? WHERE id = ?",
            (name, address, building_id),
        )
        db.commit()

        log_audit(user_id, "BUILDING_UPDATED", building_id)

        return jsonify({"message": "Building updated"})


@app.route("/api/buildings/<building_id>/rooms", methods=["POST", "OPTIONS"])
def add_room(building_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем здание и права
    cur.execute("SELECT organization_id FROM buildings WHERE id = ?", (building_id,))
    building = cur.fetchone()

    if not building:
        return jsonify({"error": "Building not found"}), 404

    if not check_organization_permission(user_id, building["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    data = request.json
    name = data.get("name")
    max_groups = data.get("max_groups", 1)

    if not name:
        return jsonify({"error": "Name required"}), 400

    room_id = generate_uuid()
    cur.execute(
        "INSERT INTO rooms (id, building_id, name, max_groups) VALUES (?, ?, ?, ?)",
        (room_id, building_id, name, max_groups),
    )
    db.commit()

    log_audit(user_id, "ROOM_CREATED", room_id)

    return jsonify({"room_id": room_id, "message": "Room created"}), 201


@app.route("/api/rooms/<room_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_room(room_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем комнату и проверяем права
    cur.execute(
        """SELECT r.*, b.organization_id 
           FROM rooms r 
           JOIN buildings b ON r.building_id = b.id 
           WHERE r.id = ?""",
        (room_id,),
    )
    room = cur.fetchone()

    if not room:
        return jsonify({"error": "Room not found"}), 404

    if not check_organization_permission(user_id, room["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM rooms WHERE id = ?", (room_id,))
        db.commit()
        log_audit(user_id, "ROOM_DELETED", room_id)
        return jsonify({"message": "Room deleted"})

    else:  # PUT
        data = request.json
        name = data.get("name", room["name"])
        max_groups = data.get("max_groups", room["max_groups"])

        cur.execute(
            "UPDATE rooms SET name = ?, max_groups = ? WHERE id = ?",
            (name, max_groups, room_id),
        )
        db.commit()

        log_audit(user_id, "ROOM_UPDATED", room_id)

        return jsonify({"message": "Room updated"})


# ============ GROUPS API ============


@app.route("/api/organizations/<org_id>/groups", methods=["GET", "POST", "OPTIONS"])
def manage_groups(org_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем членство
    cur.execute(
        "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
        (org_id, user_id),
    )
    if not cur.fetchone():
        return jsonify({"error": "Not a member"}), 403

    if request.method == "GET":
        # Получить список групп
        cur.execute(
            """SELECT g.*, u.username as curator_name, b.name as building_name
               FROM groups g
               LEFT JOIN users u ON g.curator_id = u.id
               LEFT JOIN buildings b ON g.building_id = b.id
               WHERE g.organization_id = ?
               ORDER BY g.course, g.group_number""",
            (org_id,),
        )
        groups = [dict(row) for row in cur.fetchall()]

        # Для каждой группы получаем количество студентов
        for group in groups:
            cur.execute(
                "SELECT COUNT(*) as count FROM user_groups WHERE group_id = ?",
                (group["id"],),
            )
            group["student_count"] = cur.fetchone()["count"]

        return jsonify(groups)

    else:  # POST - создание группы
        if not check_organization_permission(user_id, org_id, "admin"):
            return jsonify({"error": "Permission denied"}), 403

        data = request.json
        name = data.get("name")
        specialty = data.get("specialty")
        course = data.get("course")
        group_number = data.get("group_number")
        admission_year = data.get("admission_year")
        group_type = data.get("type")
        curator_id = data.get("curator_id")
        building_id = data.get("building_id")

        if not name:
            return jsonify({"error": "Name required"}), 400

        group_id = generate_uuid()
        cur.execute(
            """INSERT INTO groups (id, organization_id, name, specialty, course, group_number, 
                                  admission_year, type, curator_id, building_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                group_id,
                org_id,
                name,
                specialty,
                course,
                group_number,
                admission_year,
                group_type,
                curator_id,
                building_id,
            ),
        )
        db.commit()

        log_audit(user_id, "GROUP_CREATED", group_id)

        return jsonify({"group_id": group_id, "message": "Group created"}), 201


@app.route("/api/groups/<group_id>", methods=["GET", "PUT", "DELETE", "OPTIONS"])
def manage_single_group(group_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем группу
    cur.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    # Проверяем членство в организации
    cur.execute(
        "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
        (group["organization_id"], user_id),
    )
    if not cur.fetchone():
        return jsonify({"error": "Not a member"}), 403

    if request.method == "GET":
        # Получить детали группы со студентами
        group_dict = dict(group)

        # Получаем студентов
        cur.execute(
            """SELECT u.id, u.username, u.email, u.first_name, u.last_name
               FROM users u
               JOIN user_groups ug ON u.id = ug.user_id
               WHERE ug.group_id = ?
               ORDER BY u.last_name, u.first_name""",
            (group_id,),
        )
        group_dict["students"] = [dict(row) for row in cur.fetchall()]

        # Получаем куратора
        if group["curator_id"]:
            cur.execute(
                "SELECT id, username, email, first_name, last_name FROM users WHERE id = ?",
                (group["curator_id"],),
            )
            group_dict["curator"] = dict(cur.fetchone() or {})

        return jsonify(group_dict)

    elif request.method == "DELETE":
        if not check_organization_permission(
            user_id, group["organization_id"], "admin"
        ):
            return jsonify({"error": "Permission denied"}), 403

        cur.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        db.commit()

        log_audit(user_id, "GROUP_DELETED", group_id)

        return jsonify({"message": "Group deleted"})

    else:  # PUT
        if not check_organization_permission(
            user_id, group["organization_id"], "admin"
        ):
            return jsonify({"error": "Permission denied"}), 403

        data = request.json

        cur.execute(
            """UPDATE groups 
               SET name = ?, specialty = ?, course = ?, group_number = ?, 
                   admission_year = ?, type = ?, curator_id = ?, building_id = ?
               WHERE id = ?""",
            (
                data.get("name", group["name"]),
                data.get("specialty", group["specialty"]),
                data.get("course", group["course"]),
                data.get("group_number", group["group_number"]),
                data.get("admission_year", group["admission_year"]),
                data.get("type", group["type"]),
                data.get("curator_id", group["curator_id"]),
                data.get("building_id", group["building_id"]),
                group_id,
            ),
        )
        db.commit()

        log_audit(user_id, "GROUP_UPDATED", group_id)

        return jsonify({"message": "Group updated"})


@app.route("/api/groups/<group_id>/students", methods=["POST", "DELETE", "OPTIONS"])
def manage_group_students(group_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем группу и права
    cur.execute("SELECT organization_id FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    if not check_organization_permission(user_id, group["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    data = request.json
    student_id = data.get("student_id")

    if not student_id:
        return jsonify({"error": "student_id required"}), 400

    if request.method == "POST":
        # Добавить студента
        try:
            cur.execute(
                "INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)",
                (student_id, group_id),
            )
            db.commit()
            log_audit(user_id, "STUDENT_ADDED_TO_GROUP", group_id)
            return jsonify({"message": "Student added"})
        except sqlite3.IntegrityError:
            return jsonify({"error": "Student already in group"}), 400

    else:  # DELETE
        cur.execute(
            "DELETE FROM user_groups WHERE user_id = ? AND group_id = ?",
            (student_id, group_id),
        )
        db.commit()
        log_audit(user_id, "STUDENT_REMOVED_FROM_GROUP", group_id)
        return jsonify({"message": "Student removed"})


# ============ SUBJECTS API ============


@app.route("/api/organizations/<org_id>/subjects", methods=["GET", "POST", "OPTIONS"])
def manage_subjects(org_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем членство
    cur.execute(
        "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
        (org_id, user_id),
    )
    if not cur.fetchone():
        return jsonify({"error": "Not a member"}), 403

    if request.method == "GET":
        cur.execute(
            "SELECT * FROM subjects WHERE organization_id = ? ORDER BY name", (org_id,)
        )
        return jsonify([dict(row) for row in cur.fetchall()])

    else:  # POST
        if not check_organization_permission(user_id, org_id, "admin"):
            return jsonify({"error": "Permission denied"}), 403

        data = request.json
        name = data.get("name")
        code = data.get("code")
        description = data.get("description")

        if not name:
            return jsonify({"error": "Name required"}), 400

        subject_id = generate_uuid()
        cur.execute(
            "INSERT INTO subjects (id, organization_id, name, code, description) VALUES (?, ?, ?, ?, ?)",
            (subject_id, org_id, name, code, description),
        )
        db.commit()

        log_audit(user_id, "SUBJECT_CREATED", subject_id)

        return jsonify({"subject_id": subject_id, "message": "Subject created"}), 201


@app.route("/api/subjects/<subject_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_subject(subject_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute("SELECT * FROM subjects WHERE id = ?", (subject_id,))
    subject = cur.fetchone()

    if not subject:
        return jsonify({"error": "Subject not found"}), 404

    if not check_organization_permission(user_id, subject["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM subjects WHERE id = ?", (subject_id,))
        db.commit()
        log_audit(user_id, "SUBJECT_DELETED", subject_id)
        return jsonify({"message": "Subject deleted"})

    else:  # PUT
        data = request.json
        cur.execute(
            "UPDATE subjects SET name = ?, code = ?, description = ? WHERE id = ?",
            (
                data.get("name", subject["name"]),
                data.get("code", subject["code"]),
                data.get("description", subject["description"]),
                subject_id,
            ),
        )
        db.commit()
        log_audit(user_id, "SUBJECT_UPDATED", subject_id)
        return jsonify({"message": "Subject updated"})


# ============ GROUP-SUBJECT ASSIGNMENT ============


@app.route("/api/groups/<group_id>/subjects", methods=["GET", "POST", "OPTIONS"])
def manage_group_subjects(group_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем группу
    cur.execute("SELECT organization_id FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    if request.method == "GET":
        # Получить предметы группы
        cur.execute(
            """SELECT gs.*, s.name as subject_name, s.code as subject_code,
                      u.username as teacher_name, u.first_name, u.last_name
               FROM group_subjects gs
               JOIN subjects s ON gs.subject_id = s.id
               LEFT JOIN users u ON gs.teacher_id = u.id
               WHERE gs.group_id = ?
               ORDER BY s.name""",
            (group_id,),
        )
        return jsonify([dict(row) for row in cur.fetchall()])

    else:  # POST - назначить предмет группе
        if not check_organization_permission(
            user_id, group["organization_id"], "admin"
        ):
            return jsonify({"error": "Permission denied"}), 403

        data = request.json
        subject_id = data.get("subject_id")
        teacher_id = data.get("teacher_id")
        total_hours = data.get("total_hours", 0)

        if not subject_id:
            return jsonify({"error": "subject_id required"}), 400

        try:
            gs_id = generate_uuid()
            cur.execute(
                """INSERT INTO group_subjects (id, group_id, subject_id, teacher_id, total_hours)
                   VALUES (?, ?, ?, ?, ?)""",
                (gs_id, group_id, subject_id, teacher_id, total_hours),
            )
            db.commit()
            log_audit(user_id, "SUBJECT_ASSIGNED_TO_GROUP", gs_id)
            return jsonify({"id": gs_id, "message": "Subject assigned"}), 201
        except sqlite3.IntegrityError:
            return jsonify({"error": "Subject already assigned to group"}), 400


@app.route("/api/group-subjects/<gs_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_group_subject(gs_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем запись
    cur.execute(
        """SELECT gs.*, g.organization_id
           FROM group_subjects gs
           JOIN groups g ON gs.group_id = g.id
           WHERE gs.id = ?""",
        (gs_id,),
    )
    gs = cur.fetchone()

    if not gs:
        return jsonify({"error": "Not found"}), 404

    if not check_organization_permission(user_id, gs["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM group_subjects WHERE id = ?", (gs_id,))
        db.commit()
        log_audit(user_id, "SUBJECT_UNASSIGNED_FROM_GROUP", gs_id)
        return jsonify({"message": "Subject unassigned"})

    else:  # PUT
        data = request.json
        cur.execute(
            "UPDATE group_subjects SET teacher_id = ?, total_hours = ? WHERE id = ?",
            (data.get("teacher_id"), data.get("total_hours", gs["total_hours"]), gs_id),
        )
        db.commit()
        log_audit(user_id, "GROUP_SUBJECT_UPDATED", gs_id)
        return jsonify({"message": "Updated"})


# ============ LESSONS (SCHEDULE) API ============


@app.route("/api/groups/<group_id>/schedule", methods=["GET", "POST", "OPTIONS"])
def manage_schedule(group_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Проверяем группу
    cur.execute("SELECT organization_id FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    if request.method == "GET":
        # Получить расписание группы
        cur.execute(
            """SELECT l.*, s.name as subject_name, s.code as subject_code,
                      u.username as teacher_name, u.first_name as teacher_first_name,
                      u.last_name as teacher_last_name,
                      r.name as room_name, b.name as building_name
               FROM lessons l
               JOIN subjects s ON l.subject_id = s.id
               JOIN users u ON l.teacher_id = u.id
               LEFT JOIN rooms r ON l.room_id = r.id
               LEFT JOIN buildings b ON r.building_id = b.id
               WHERE l.group_id = ?
               ORDER BY l.day_of_week, l.start_time""",
            (group_id,),
        )
        lessons = [dict(row) for row in cur.fetchall()]

        # Группируем по дням недели
        schedule = {i: [] for i in range(7)}
        for lesson in lessons:
            schedule[lesson["day_of_week"]].append(lesson)

        return jsonify({"group_id": group_id, "schedule": schedule, "lessons": lessons})

    else:  # POST - создать урок
        if not check_organization_permission(
            user_id, group["organization_id"], "admin"
        ):
            return jsonify({"error": "Permission denied"}), 403

        data = request.json
        subject_id = data.get("subject_id")
        teacher_id = data.get("teacher_id")
        room_id = data.get("room_id")
        day_of_week = data.get("day_of_week")
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        lesson_type = data.get("lesson_type", "lecture")

        if not all(
            [subject_id, teacher_id, day_of_week is not None, start_time, end_time]
        ):
            return jsonify({"error": "Missing required fields"}), 400

        if day_of_week < 0 or day_of_week > 6:
            return jsonify({"error": "day_of_week must be 0-6"}), 400

        lesson_id = generate_uuid()
        cur.execute(
            """INSERT INTO lessons (id, group_id, subject_id, teacher_id, room_id,
                                   day_of_week, start_time, end_time, lesson_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                lesson_id,
                group_id,
                subject_id,
                teacher_id,
                room_id,
                day_of_week,
                start_time,
                end_time,
                lesson_type,
            ),
        )
        db.commit()

        log_audit(user_id, "LESSON_CREATED", lesson_id)

        return jsonify({"lesson_id": lesson_id, "message": "Lesson created"}), 201


@app.route("/api/lessons/<lesson_id>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_lesson(lesson_id):
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        """SELECT l.*, g.organization_id
           FROM lessons l
           JOIN groups g ON l.group_id = g.id
           WHERE l.id = ?""",
        (lesson_id,),
    )
    lesson = cur.fetchone()

    if not lesson:
        return jsonify({"error": "Lesson not found"}), 404

    if not check_organization_permission(user_id, lesson["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    if request.method == "DELETE":
        cur.execute("DELETE FROM lessons WHERE id = ?", (lesson_id,))
        db.commit()
        log_audit(user_id, "LESSON_DELETED", lesson_id)
        return jsonify({"message": "Lesson deleted"})

    else:  # PUT
        data = request.json
        cur.execute(
            """UPDATE lessons
               SET subject_id = ?, teacher_id = ?, room_id = ?,
                   day_of_week = ?, start_time = ?, end_time = ?, lesson_type = ?
               WHERE id = ?""",
            (
                data.get("subject_id", lesson["subject_id"]),
                data.get("teacher_id", lesson["teacher_id"]),
                data.get("room_id", lesson["room_id"]),
                data.get("day_of_week", lesson["day_of_week"]),
                data.get("start_time", lesson["start_time"]),
                data.get("end_time", lesson["end_time"]),
                data.get("lesson_type", lesson["lesson_type"]),
                lesson_id,
            ),
        )
        db.commit()
        log_audit(user_id, "LESSON_UPDATED", lesson_id)
        return jsonify({"message": "Lesson updated"})


# ============ SCHEDULE UPLOAD FROM EXCEL/CSV ============

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"xlsx", "xls", "csv"}

# Создаём папку для загрузок
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/api/schedules/upload", methods=["POST", "OPTIONS"])
def upload_schedule():
    """
    Загрузка расписания из Excel/CSV файла

    Ожидаемый формат файла:
    Columns: group_name, day_of_week, start_time, end_time, subject_name,
             teacher_username, room_name, lesson_type

    day_of_week: 0-6 (0=Monday) или текстом (Monday, Tuesday, etc)
    """
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Проверяем наличие файла
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type. Use .xlsx, .xls or .csv"}), 400

    # Получаем organization_id из параметров
    org_id = request.form.get("organization_id")
    if not org_id:
        return jsonify({"error": "organization_id required"}), 400

    # Проверяем права
    if not check_organization_permission(user_id, org_id, "admin"):
        return jsonify({"error": "Permission denied"}), 403

    # Сохраняем файл
    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, f"{generate_uuid()}_{filename}")
    file.save(filepath)

    try:
        # Читаем файл
        if filename.endswith(".csv"):
            df = pd.read_csv(filepath)
        else:
            df = pd.read_excel(filepath)

        # Проверяем обязательные колонки
        required_columns = [
            "group_name",
            "day_of_week",
            "start_time",
            "end_time",
            "subject_name",
            "teacher_username",
        ]

        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return (
                jsonify(
                    {
                        "error": f"Missing required columns: {', '.join(missing_columns)}",
                        "required_columns": required_columns,
                        "found_columns": list(df.columns),
                    }
                ),
                400,
            )

        db = get_db()
        cur = db.cursor()

        # Словари для кеширования ID
        groups_cache = {}
        subjects_cache = {}
        teachers_cache = {}
        rooms_cache = {}

        # Mapping дней недели
        day_mapping = {
            "monday": 0,
            "mon": 0,
            "понедельник": 0,
            "пн": 0,
            "tuesday": 1,
            "tue": 1,
            "вторник": 1,
            "вт": 1,
            "wednesday": 2,
            "wed": 2,
            "среда": 2,
            "ср": 2,
            "thursday": 3,
            "thu": 3,
            "четверг": 3,
            "чт": 3,
            "friday": 4,
            "fri": 4,
            "пятница": 4,
            "пт": 4,
            "saturday": 5,
            "sat": 5,
            "суббота": 5,
            "сб": 5,
            "sunday": 6,
            "sun": 6,
            "воскресенье": 6,
            "вс": 6,
        }

        created_count = 0
        errors = []

        for index, row in df.iterrows():
            try:
                # Получаем группу
                group_name = str(row["group_name"]).strip()
                if group_name not in groups_cache:
                    cur.execute(
                        "SELECT id FROM groups WHERE name = ? AND organization_id = ?",
                        (group_name, org_id),
                    )
                    group = cur.fetchone()
                    if not group:
                        errors.append(
                            f"Row {index + 2}: Group '{group_name}' not found"
                        )
                        continue
                    groups_cache[group_name] = group["id"]

                group_id = groups_cache[group_name]

                # Получаем предмет
                subject_name = str(row["subject_name"]).strip()
                if subject_name not in subjects_cache:
                    cur.execute(
                        "SELECT id FROM subjects WHERE name = ? AND organization_id = ?",
                        (subject_name, org_id),
                    )
                    subject = cur.fetchone()
                    if not subject:
                        errors.append(
                            f"Row {index + 2}: Subject '{subject_name}' not found"
                        )
                        continue
                    subjects_cache[subject_name] = subject["id"]

                subject_id = subjects_cache[subject_name]

                # Получаем учителя
                teacher_username = str(row["teacher_username"]).strip()
                if teacher_username not in teachers_cache:
                    cur.execute(
                        "SELECT id FROM users WHERE username = ?", (teacher_username,)
                    )
                    teacher = cur.fetchone()
                    if not teacher:
                        errors.append(
                            f"Row {index + 2}: Teacher '{teacher_username}' not found"
                        )
                        continue
                    teachers_cache[teacher_username] = teacher["id"]

                teacher_id = teachers_cache[teacher_username]

                # Получаем комнату (опционально)
                room_id = None
                if "room_name" in row and pd.notna(row["room_name"]):
                    room_name = str(row["room_name"]).strip()
                    if room_name not in rooms_cache:
                        cur.execute(
                            """SELECT r.id FROM rooms r
                               JOIN buildings b ON r.building_id = b.id
                               WHERE r.name = ? AND b.organization_id = ?""",
                            (room_name, org_id),
                        )
                        room = cur.fetchone()
                        if room:
                            rooms_cache[room_name] = room["id"]

                    if room_name in rooms_cache:
                        room_id = rooms_cache[room_name]

                # Парсим день недели
                day_raw = str(row["day_of_week"]).strip().lower()
                if day_raw.isdigit():
                    day_of_week = int(day_raw)
                else:
                    day_of_week = day_mapping.get(day_raw)
                    if day_of_week is None:
                        errors.append(
                            f"Row {index + 2}: Invalid day_of_week '{day_raw}'"
                        )
                        continue

                if day_of_week < 0 or day_of_week > 6:
                    errors.append(f"Row {index + 2}: day_of_week must be 0-6")
                    continue

                # Парсим время
                start_time = str(row["start_time"]).strip()
                end_time = str(row["end_time"]).strip()

                # Тип урока
                lesson_type = (
                    str(row.get("lesson_type", "lecture")).strip()
                    if "lesson_type" in row
                    else "lecture"
                )

                # Проверяем дублирование
                cur.execute(
                    """SELECT id FROM lessons 
                       WHERE group_id = ? AND day_of_week = ? AND start_time = ?""",
                    (group_id, day_of_week, start_time),
                )
                if cur.fetchone():
                    errors.append(f"Row {index + 2}: Lesson already exists")
                    continue

                # Создаём урок
                lesson_id = generate_uuid()
                cur.execute(
                    """INSERT INTO lessons (id, group_id, subject_id, teacher_id, room_id,
                                           day_of_week, start_time, end_time, lesson_type)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        lesson_id,
                        group_id,
                        subject_id,
                        teacher_id,
                        room_id,
                        day_of_week,
                        start_time,
                        end_time,
                        lesson_type,
                    ),
                )
                created_count += 1

            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")

        db.commit()

        # Удаляем загруженный файл
        os.remove(filepath)

        log_audit(
            user_id,
            "SCHEDULE_UPLOADED",
            org_id,
            details={"created": created_count, "errors": len(errors)},
        )

        return jsonify(
            {
                "message": f"Schedule uploaded: {created_count} lessons created",
                "created": created_count,
                "errors": errors if errors else None,
            }
        )

    except Exception as e:
        # Удаляем файл в случае ошибки
        if os.path.exists(filepath):
            os.remove(filepath)
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@app.route("/api/schedules/template", methods=["GET", "OPTIONS"])
def download_schedule_template():
    """Скачать шаблон Excel файла для загрузки расписания"""
    if request.method == "OPTIONS":
        return "", 200

    # Создаём шаблон
    template_data = {
        "group_name": ["ИС-101", "ИС-101", "ИС-102"],
        "day_of_week": [0, 0, 1],  # или 'Monday', 'Monday', 'Tuesday'
        "start_time": ["09:00", "10:45", "09:00"],
        "end_time": ["10:30", "12:15", "10:30"],
        "subject_name": ["Математика", "Программирование", "Физика"],
        "teacher_username": ["teacher1", "teacher2", "teacher3"],
        "room_name": ["101", "102", "201"],
        "lesson_type": ["lecture", "practice", "lecture"],
    }

    df = pd.DataFrame(template_data)

    # Сохраняем во временный файл
    template_path = os.path.join(UPLOAD_FOLDER, "schedule_template.xlsx")
    df.to_excel(template_path, index=False)

    from flask import send_file

    return send_file(
        template_path, as_attachment=True, download_name="schedule_template.xlsx"
    )


@app.route("/api/schedules/export/<group_id>", methods=["GET", "OPTIONS"])
def export_schedule(group_id):
    """Экспорт расписания группы в Excel"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем расписание
    cur.execute(
        """SELECT l.day_of_week, l.start_time, l.end_time, l.lesson_type,
                  s.name as subject_name, s.code as subject_code,
                  u.username as teacher_username, 
                  u.first_name as teacher_first_name, u.last_name as teacher_last_name,
                  r.name as room_name, b.name as building_name,
                  g.name as group_name
           FROM lessons l
           JOIN subjects s ON l.subject_id = s.id
           JOIN users u ON l.teacher_id = u.id
           JOIN groups g ON l.group_id = g.id
           LEFT JOIN rooms r ON l.room_id = r.id
           LEFT JOIN buildings b ON r.building_id = b.id
           WHERE l.group_id = ?
           ORDER BY l.day_of_week, l.start_time""",
        (group_id,),
    )

    lessons = [dict(row) for row in cur.fetchall()]

    if not lessons:
        return jsonify({"error": "No schedule found"}), 404

    # Конвертируем в DataFrame
    df = pd.DataFrame(lessons)

    # Добавляем читаемые названия дней
    day_names = [
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота",
        "Воскресенье",
    ]
    df["day_name"] = df["day_of_week"].apply(
        lambda x: day_names[x] if 0 <= x < 7 else ""
    )

    # Переупорядочиваем колонки
    df = df[
        [
            "group_name",
            "day_name",
            "day_of_week",
            "start_time",
            "end_time",
            "subject_name",
            "subject_code",
            "teacher_username",
            "teacher_first_name",
            "teacher_last_name",
            "room_name",
            "building_name",
            "lesson_type",
        ]
    ]

    # Сохраняем
    export_path = os.path.join(UPLOAD_FOLDER, f"schedule_{group_id}.xlsx")
    df.to_excel(export_path, index=False)

    from flask import send_file

    return send_file(
        export_path,
        as_attachment=True,
        download_name=f'schedule_{lessons[0]["group_name"]}.xlsx',
    )


# ============ NOTIFICATIONS API ============


@app.route("/api/notifications", methods=["GET", "OPTIONS"])
def get_notifications():
    """Получить список уведомлений пользователя"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Параметры фильтрации
    is_read = request.args.get("is_read")  # true/false/all
    notification_type = request.args.get("type")  # grade, homework, event, message
    limit = int(request.args.get("limit", 50))
    offset = int(request.args.get("offset", 0))

    db = get_db()
    cur = db.cursor()

    # Формируем запрос
    query = "SELECT * FROM notifications WHERE user_id = ?"
    params = [user_id]

    if is_read and is_read != "all":
        query += " AND is_read = ?"
        params.append(1 if is_read.lower() == "true" else 0)

    if notification_type:
        query += " AND type = ?"
        params.append(notification_type)

    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cur.execute(query, params)
    notifications = [dict(row) for row in cur.fetchall()]

    # Получаем общее количество непрочитанных
    cur.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0",
        (user_id,),
    )
    unread_count = cur.fetchone()["count"]

    return jsonify(
        {
            "notifications": notifications,
            "unread_count": unread_count,
            "total": len(notifications),
        }
    )


@app.route("/api/notifications/<notification_id>/read", methods=["PUT", "OPTIONS"])
def mark_notification_read(notification_id):
    """Отметить уведомление как прочитанное"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
        (notification_id, user_id),
    )

    if cur.rowcount == 0:
        return jsonify({"error": "Notification not found"}), 404

    db.commit()

    return jsonify({"message": "Marked as read"})


@app.route("/api/notifications/read-all", methods=["PUT", "OPTIONS"])
def mark_all_notifications_read():
    """Отметить все уведомления как прочитанные"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
        (user_id,),
    )

    updated_count = cur.rowcount
    db.commit()

    return jsonify(
        {
            "message": f"Marked {updated_count} notifications as read",
            "count": updated_count,
        }
    )


@app.route("/api/notifications/<notification_id>", methods=["DELETE", "OPTIONS"])
def delete_notification(notification_id):
    """Удалить уведомление"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        "DELETE FROM notifications WHERE id = ? AND user_id = ?",
        (notification_id, user_id),
    )

    if cur.rowcount == 0:
        return jsonify({"error": "Notification not found"}), 404

    db.commit()

    return jsonify({"message": "Notification deleted"})


@app.route("/api/notifications/clear", methods=["DELETE", "OPTIONS"])
def clear_all_notifications():
    """Удалить все прочитанные уведомления"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        "DELETE FROM notifications WHERE user_id = ? AND is_read = 1", (user_id,)
    )

    deleted_count = cur.rowcount
    db.commit()

    return jsonify(
        {"message": f"Deleted {deleted_count} notifications", "count": deleted_count}
    )


@app.route("/api/notifications/settings", methods=["GET", "PUT", "OPTIONS"])
def notification_settings():
    """Настройки уведомлений (сохраняются в profile_data пользователя)"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    if request.method == "GET":
        # Получаем настройки (для простоты храним в отдельной таблице или в users)
        # Здесь используем значения по умолчанию
        return jsonify(
            {
                "email_enabled": True,
                "telegram_enabled": False,
                "notification_types": {
                    "grade": True,
                    "homework": True,
                    "event": True,
                    "message": True,
                    "announcement": True,
                },
            }
        )

    else:  # PUT - обновление настроек
        data = request.json
        # TODO: Сохранить настройки в БД
        # Можно добавить таблицу notification_settings или использовать JSONB поле

        return jsonify({"message": "Settings updated"})


@app.route("/api/notifications/pending/<user_id_param>", methods=["GET", "OPTIONS"])
def get_pending_notifications_for_telegram(user_id_param):
    """
    Получить непрочитанные уведомления для отправки в Telegram
    Используется Telegram ботом
    """
    if request.method == "OPTIONS":
        return "", 200

    # Для бота: можно добавить API key проверку
    # В продакшене: требовать специальный токен для бота

    db = get_db()
    cur = db.cursor()

    # Получаем telegram_id пользователя
    cur.execute("SELECT telegram_id FROM users WHERE id = ?", (user_id_param,))
    user = cur.fetchone()

    if not user or not user["telegram_id"]:
        return jsonify({"notifications": []})

    # Получаем непрочитанные уведомления, которые еще не отправлены в Telegram
    cur.execute(
        """SELECT * FROM notifications 
           WHERE user_id = ? AND is_read = 0 AND sent_to_telegram = 0
           ORDER BY timestamp DESC
           LIMIT 10""",
        (user_id_param,),
    )

    notifications = [dict(row) for row in cur.fetchall()]

    return jsonify({"telegram_id": user["telegram_id"], "notifications": notifications})


@app.route("/api/notifications/mark-telegram-sent", methods=["POST", "OPTIONS"])
def mark_notifications_telegram_sent():
    """Отметить уведомления как отправленные в Telegram (для бота)"""
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    notification_ids = data.get("notification_ids", [])

    if not notification_ids:
        return jsonify({"error": "notification_ids required"}), 400

    db = get_db()
    cur = db.cursor()

    # Обновляем статус
    placeholders = ",".join(["?"] * len(notification_ids))
    cur.execute(
        f"UPDATE notifications SET sent_to_telegram = 1 WHERE id IN ({placeholders})",
        notification_ids,
    )

    db.commit()

    return jsonify({"message": f"Marked {cur.rowcount} notifications as sent"})


# ============ CALENDAR-JOURNAL INTEGRATION ============


def create_event_from_actual_lesson(actual_lesson_id):
    """
    Автоматическое создание события календаря из занятия
    Вызывается при создании actual_lesson
    """
    db = get_db()
    cur = db.cursor()

    # Получаем данные занятия
    cur.execute(
        """SELECT al.id, al.date, al.topic, al.homework,
                  l.start_time, l.end_time, l.group_id,
                  s.name as subject_name, s.id as subject_id,
                  u.id as teacher_id, u.username as teacher_name,
                  g.organization_id
           FROM actual_lessons al
           JOIN lessons l ON al.lesson_id = l.id
           JOIN subjects s ON l.subject_id = s.id
           JOIN users u ON l.teacher_id = u.id
           JOIN groups g ON l.group_id = g.id
           WHERE al.id = ?""",
        (actual_lesson_id,),
    )

    lesson = cur.fetchone()
    if not lesson:
        return None

    # Получаем студентов группы
    cur.execute(
        "SELECT user_id FROM user_groups WHERE group_id = ?", (lesson["group_id"],)
    )
    students = [row["user_id"] for row in cur.fetchall()]

    # Создаём событие для преподавателя
    teacher_event_id = generate_uuid()

    title = f"Занятие: {lesson['subject_name']}"
    description = (
        lesson["topic"]
        if lesson["topic"]
        else f"Занятие по предмету {lesson['subject_name']}"
    )
    if lesson["homework"]:
        description += f"\n\nДомашнее задание: {lesson['homework']}"

    cur.execute(
        """INSERT INTO events (id, owner_id, organization_id, title, description, 
                              date, time, end_time, event_type, privacy, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lesson', 'public', ?)""",
        (
            teacher_event_id,
            lesson["teacher_id"],
            lesson["organization_id"],
            title,
            description,
            lesson["date"],
            lesson["start_time"],
            lesson["end_time"],
            int(time.time()),
        ),
    )

    # Создаём события для студентов (как shared events)
    for student_id in students:
        share_id = generate_uuid()
        cur.execute(
            """INSERT INTO shared_events (id, event_id, user_id, accepted, forbid_edit, allow_comments)
               VALUES (?, ?, ?, 1, 1, 0)""",
            (share_id, teacher_event_id, student_id),
        )

    db.commit()

    return teacher_event_id


def update_event_from_actual_lesson(actual_lesson_id):
    """
    Обновление события календаря при изменении занятия
    """
    db = get_db()
    cur = db.cursor()

    # Находим связанное событие
    cur.execute(
        """SELECT e.id FROM events e
           JOIN actual_lessons al ON e.date = al.date 
           WHERE al.id = ? AND e.event_type = 'lesson'
           LIMIT 1""",
        (actual_lesson_id,),
    )

    event = cur.fetchone()
    if not event:
        # Если события нет - создаём
        return create_event_from_actual_lesson(actual_lesson_id)

    # Получаем обновлённые данные занятия
    cur.execute(
        """SELECT al.topic, al.homework, s.name as subject_name
           FROM actual_lessons al
           JOIN lessons l ON al.lesson_id = l.id
           JOIN subjects s ON l.subject_id = s.id
           WHERE al.id = ?""",
        (actual_lesson_id,),
    )

    lesson = cur.fetchone()
    if not lesson:
        return None

    # Обновляем событие
    title = f"Занятие: {lesson['subject_name']}"
    description = (
        lesson["topic"]
        if lesson["topic"]
        else f"Занятие по предмету {lesson['subject_name']}"
    )
    if lesson["homework"]:
        description += f"\n\nДомашнее задание: {lesson['homework']}"

    cur.execute(
        """UPDATE events 
           SET title = ?, description = ?, version = version + 1
           WHERE id = ?""",
        (title, description, event["id"]),
    )

    db.commit()

    return event["id"]


@app.route("/api/calendar/sync-lessons", methods=["POST", "OPTIONS"])
def sync_lessons_to_calendar():
    """
    Синхронизация всех занятий группы с календарём
    Создаёт события для всех actual_lessons, у которых нет событий
    """
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    group_id = data.get("group_id")
    start_date = data.get("start_date")  # опционально
    end_date = data.get("end_date")  # опционально

    if not group_id:
        return jsonify({"error": "group_id required"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверяем права
    cur.execute("SELECT organization_id FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    # Получаем все actual_lessons группы
    query = """SELECT al.id, al.date
               FROM actual_lessons al
               JOIN lessons l ON al.lesson_id = l.id
               WHERE l.group_id = ?"""

    params = [group_id]

    if start_date:
        query += " AND al.date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND al.date <= ?"
        params.append(end_date)

    cur.execute(query, params)
    actual_lessons = cur.fetchall()

    synced_count = 0

    for lesson in actual_lessons:
        # Проверяем, есть ли уже событие
        cur.execute(
            """SELECT e.id FROM events e
               WHERE e.date = ? AND e.event_type = 'lesson'
               LIMIT 1""",
            (lesson["date"],),
        )

        if not cur.fetchone():
            # Создаём событие
            create_event_from_actual_lesson(lesson["id"])
            synced_count += 1

    log_audit(user_id, "CALENDAR_SYNCED", group_id)

    return jsonify(
        {
            "message": f"Synced {synced_count} lessons to calendar",
            "synced_count": synced_count,
            "total_lessons": len(actual_lessons),
        }
    )


@app.route("/api/calendar/user/<user_id_param>", methods=["GET", "OPTIONS"])
def get_user_calendar(user_id_param):
    """
    Получить полный календарь пользователя:
    - Личные события
    - Shared события
    - События из занятий (для студентов и преподавателей)
    """
    if request.method == "OPTIONS":
        return "", 200

    auth_user_id = get_auth_user()
    if not auth_user_id:
        return jsonify({"error": "Unauthorized"}), 401

    # Проверяем права: либо свой календарь, либо админ
    if auth_user_id != user_id_param:
        # TODO: добавить проверку прав админа
        pass

    db = get_db()
    cur = db.cursor()

    start_date = request.args.get("start_date")  # YYYY-MM-DD
    end_date = request.args.get("end_date")

    # 1. Личные события
    query_own = "SELECT * FROM events WHERE owner_id = ?"
    params_own = [user_id_param]

    if start_date and end_date:
        query_own += " AND date BETWEEN ? AND ?"
        params_own.extend([start_date, end_date])

    query_own += " ORDER BY date, time"

    cur.execute(query_own, params_own)
    own_events = [dict(row) for row in cur.fetchall()]

    # 2. Shared события
    query_shared = """SELECT e.* FROM events e
                     JOIN shared_events s ON e.id = s.event_id
                     WHERE s.user_id = ? AND s.accepted = 1"""
    params_shared = [user_id_param]

    if start_date and end_date:
        query_shared += " AND e.date BETWEEN ? AND ?"
        params_shared.extend([start_date, end_date])

    query_shared += " ORDER BY e.date, e.time"

    cur.execute(query_shared, params_shared)
    shared_events = [dict(row) for row in cur.fetchall()]

    # Объединяем и форматируем
    all_events = own_events + shared_events

    for ev in all_events:
        ev["recurring_options"] = (
            json.loads(ev["recurring_options"]) if ev["recurring_options"] else None
        )
        ev["subtasks"] = json.loads(ev["subtasks"]) if ev["subtasks"] else None
        ev["eventType"] = ev["event_type"]
        ev["type"] = ev["privacy"]
        ev["name"] = ev["id"]
        ev["is_owner"] = ev["owner_id"] == user_id_param

    return jsonify(
        {
            "events": all_events,
            "total": len(all_events),
            "own_count": len(own_events),
            "shared_count": len(shared_events),
        }
    )


# Модифицируем функцию generate_actual_lessons для автоматического создания событий

# НАЙДИТЕ функцию generate_actual_lessons и ДОБАВЬТЕ в конце перед db.commit():
#
# # Создаём события календаря для новых занятий
# for lesson in lessons:
#     if lesson["day_of_week"] == day_of_week:
#         cur.execute(
#             "SELECT id FROM actual_lessons WHERE lesson_id = ? AND date = ?",
#             (lesson["id"], current_date.strftime("%Y-%m-%d"))
#         )
#         new_actual = cur.fetchone()
#         if new_actual:
#             create_event_from_actual_lesson(new_actual["id"])

# ============ ACTUAL LESSONS (Journal) ============


@app.route("/api/actual-lessons/generate", methods=["POST", "OPTIONS"])
def generate_actual_lessons():
    """Генерация actual_lessons из расписания для диапазона дат"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    group_id = data.get("group_id")
    start_date = data.get("start_date")  # YYYY-MM-DD
    end_date = data.get("end_date")

    if not all([group_id, start_date, end_date]):
        return jsonify({"error": "Missing required fields"}), 400

    db = get_db()
    cur = db.cursor()

    # Проверяем группу
    cur.execute("SELECT organization_id FROM groups WHERE id = ?", (group_id,))
    group = cur.fetchone()

    if not group:
        return jsonify({"error": "Group not found"}), 404

    if not check_organization_permission(user_id, group["organization_id"], "admin"):
        return jsonify({"error": "Permission denied"}), 403

    # Получаем расписание группы
    cur.execute("SELECT * FROM lessons WHERE group_id = ?", (group_id,))
    lessons = cur.fetchall()

    from datetime import datetime, timedelta

    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")

    created_count = 0
    current_date = start

    while current_date <= end:
        day_of_week = current_date.weekday()  # 0 = Monday

        # Находим уроки для этого дня недели
        for lesson in lessons:
            if lesson["day_of_week"] == day_of_week:
                # Проверяем, не существует ли уже
                cur.execute(
                    "SELECT id FROM actual_lessons WHERE lesson_id = ? AND date = ?",
                    (lesson["id"], current_date.strftime("%Y-%m-%d")),
                )
                if not cur.fetchone():
                    actual_id = generate_uuid()
                    cur.execute(
                        "INSERT INTO actual_lessons (id, lesson_id, date) VALUES (?, ?, ?)",
                        (actual_id, lesson["id"], current_date.strftime("%Y-%m-%d")),
                    )
                    created_count += 1

        current_date += timedelta(days=1)

    db.commit()
    log_audit(user_id, "ACTUAL_LESSONS_GENERATED", group_id)

    return jsonify(
        {"message": f"Generated {created_count} actual lessons", "count": created_count}
    )


@app.route(
    "/api/actual-lessons/date/<date>/group/<group_id>", methods=["GET", "OPTIONS"]
)
def get_actual_lessons_by_date(date, group_id):
    """Получить все занятия группы на определенную дату"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    cur.execute(
        """SELECT al.*, l.start_time, l.end_time, l.lesson_type,
                  s.name as subject_name, s.code as subject_code,
                  u.username as teacher_name, u.first_name as teacher_first_name,
                  u.last_name as teacher_last_name,
                  r.name as room_name, b.name as building_name
           FROM actual_lessons al
           JOIN lessons l ON al.lesson_id = l.id
           JOIN subjects s ON l.subject_id = s.id
           JOIN users u ON l.teacher_id = u.id
           LEFT JOIN rooms r ON l.room_id = r.id
           LEFT JOIN buildings b ON r.building_id = b.id
           WHERE al.date = ? AND l.group_id = ?
           ORDER BY l.start_time""",
        (date, group_id),
    )

    return jsonify([dict(row) for row in cur.fetchall()])


@app.route("/api/actual-lessons/<actual_lesson_id>", methods=["GET", "PUT", "OPTIONS"])
def manage_actual_lesson(actual_lesson_id):
    """Получить или обновить конкретное занятие"""
    if request.method == "OPTIONS":
        return "", 200

    user_id = get_auth_user()
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    if request.method == "GET":
        # Получить детали занятия с оценками и посещаемостью
        cur.execute(
            """SELECT al.*, l.start_time, l.end_time, l.lesson_type, l.group_id,
                      s.name as subject_name, s.id as subject_id,
                      u.username as teacher_name, u.id as teacher_id,
                      r.name as room_name
               FROM actual_lessons al
               JOIN lessons l ON al.lesson_id = l.id
               JOIN subjects s ON l.subject_id = s.id
               JOIN users u ON l.teacher_id = u.id
               LEFT JOIN rooms r ON l.room_id = r.id
               WHERE al.id = ?""",
            (actual_lesson_id,),
        )
        lesson = cur.fetchone()

        if not lesson:
            return jsonify({"error": "Lesson not found"}), 404

        lesson_dict = dict(lesson)

        # Получаем студентов группы с оценками и посещаемостью
        cur.execute(
            """SELECT u.id, u.username, u.first_name, u.last_name,
                      m.id as mark_id, m.value as mark_value, m.comment as mark_comment,
                      a.id as attendance_id, a.status as attendance_status
               FROM user_groups ug
               JOIN users u ON ug.user_id = u.id
               LEFT JOIN marks m ON m.student_id = u.id AND m.actual_lesson_id = ?
               LEFT JOIN attendance a ON a.student_id = u.id AND a.actual_lesson_id = ?
               WHERE ug.group_id = ?
               ORDER BY u.last_name, u.first_name""",
            (actual_lesson_id, actual_lesson_id, lesson["group_id"]),
        )

        lesson_dict["students"] = [dict(row) for row in cur.fetchall()]

        return jsonify(lesson_dict)

    else:  # PUT - обновить тему, ДЗ, заметки
        data = request.json

        cur.execute(
            """UPDATE actual_lessons
               SET topic = ?, homework = ?, notes = ?
               WHERE id = ?""",
            (
                data.get("topic"),
                data.get("homework"),
                data.get("notes"),
                actual_lesson_id,
            ),
        )
        db.commit()

        log_audit(user_id, "ACTUAL_LESSON_UPDATED", actual_lesson_id)

        # Если добавлено домашнее задание - уведомить студентов
        if data.get("homework"):
            cur.execute(
                """SELECT ug.user_id
                   FROM actual_lessons al
                   JOIN lessons l ON al.lesson_id = l.id
                   JOIN user_groups ug ON l.group_id = ug.group_id
                   WHERE al.id = ?""",
                (actual_lesson_id,),
            )
            for student in cur.fetchall():
                create_notification(
                    student["user_id"],
                    "homework",
                    f"Новое домашнее задание: {data.get('homework')[:100]}",
                )

        return jsonify({"message": "Lesson updated"})


# ============ TELEGRAM BOT SUPPORT ENDPOINTS ============


@app.route("/api/telegram/users-with-notifications", methods=["GET", "OPTIONS"])
def get_users_with_telegram_notifications():
    """
    Получить список пользователей с привязанным Telegram, у которых есть непрочитанные уведомления
    Для использования ботом
    """
    if request.method == "OPTIONS":
        return "", 200

    # В продакшене: добавить API key проверку для бота
    # bot_api_key = request.headers.get('X-Bot-API-Key')
    # if bot_api_key != 'YOUR_SECURE_BOT_KEY':
    #     return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    # Получаем пользователей с telegram_id и непрочитанными уведомлениями
    cur.execute(
        """SELECT DISTINCT u.id as user_id, u.telegram_id
           FROM users u
           JOIN notifications n ON u.id = n.user_id
           WHERE u.telegram_id IS NOT NULL
           AND n.is_read = 0
           AND n.sent_to_telegram = 0"""
    )

    users = [dict(row) for row in cur.fetchall()]

    return jsonify(users)


@app.route("/api/telegram/verify-user", methods=["POST", "OPTIONS"])
def verify_telegram_user():
    """Проверить существование пользователя по User ID (для бота)"""
    if request.method == "OPTIONS":
        return "", 200

    data = request.json
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    db = get_db()
    cur = db.cursor()

    cur.execute(
        "SELECT id, username, first_name, last_name FROM users WHERE id = ?", (user_id,)
    )

    user = cur.fetchone()

    if not user:
        return jsonify({"exists": False}), 404

    return jsonify(
        {
            "exists": True,
            "username": user["username"],
            "first_name": user["first_name"],
            "last_name": user["last_name"],
        }
    )


# ========== УДАЛЕНИЕ ПРОСРОЧЕННЫХ ПОЛЬЗОВАТЕЛЕЙ ==========
def check_expired_users():
    with app.app_context():
        db = get_db()
        cur = db.cursor()
        now = int(time.time())
        cur.execute(
            "SELECT id FROM users WHERE logout_timestamp IS NOT NULL AND ? - logout_timestamp > 604800",
            (now,),
        )
        for row in cur.fetchall():
            cur.execute("DELETE FROM marks WHERE student_id = ?", (row["id"],))
            cur.execute("DELETE FROM notifications WHERE user_id = ?", (row["id"],))
            cur.execute("DELETE FROM audit_logs WHERE user_id = ?", (row["id"],))
            cur.execute(
                "DELETE FROM actual_lessons WHERE lesson_id IN (SELECT id FROM lessons WHERE teacher_id = ?)",
                (row["id"],),
            )
            cur.execute("DELETE FROM lessons WHERE teacher_id = ?", (row["id"],))
            cur.execute("DELETE FROM user_groups WHERE user_id = ?", (row["id"],))
            cur.execute(
                "DELETE FROM groups WHERE curator_id = ?", (row["id"],)
            )  # Если куратор
            cur.execute("DELETE FROM users WHERE id = ?", (row["id"],))
        db.commit()
    Timer(86400, check_expired_users).start()


# Запускаем проверку просроченных пользователей при старте
check_expired_users()
if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True, host="0.0.0.0")

# Вы хоть почитайте что получилось в итоге