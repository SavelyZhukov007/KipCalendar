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
password = "PLACE YOUR PASSWORD HERE"
app.config["MAIL_PORT"] = 587  # Или 465 для SSL
app.config["MAIL_USE_TLS"] = True  # Или MAIL_USE_SSL = True
app.config["MAIL_USERNAME"] = "savely.zhukov.1583@gmail.com"  # Ваш email
app.config["MAIL_PASSWORD"] = password  # App password для Gmail (не основной пароль)
app.config["MAIL_DEFAULT_SENDER"] = "savely.zhukov.1583@gmail.com"  # От кого отправлять
mail = Mail(app)  # Инициализация Flask-Mail
socketio = SocketIO(app, cors_allowed_origins="*")

SECRET_KEY = "your_secret_key_change_me"
DATABASE = "kipcalendar.db"


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
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,  -- ИЗМЕНЕНО: было INTEGER, стало TEXT
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            roles TEXT NOT NULL,
            current_role TEXT NOT NULL,
            logout_timestamp INTEGER,
            first_name TEXT,
            last_name TEXT,
            middle_name TEXT
        );

        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT
        );

        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            max_groups INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY(building_id) REFERENCES buildings(id)
        );

        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT NOT NULL,
            course INTEGER NOT NULL,
            group_number INTEGER NOT NULL,
            admission_year INTEGER NOT NULL,
            type TEXT,
            curator_id INTEGER,
            building_id INTEGER,
            FOREIGN KEY(curator_id) REFERENCES users(id),
            FOREIGN KEY(building_id) REFERENCES buildings(id)
        );

        CREATE TABLE IF NOT EXISTS user_groups (
            user_id INTEGER,
            group_id INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(group_id) REFERENCES groups(id),
            PRIMARY KEY(user_id, group_id)
        );

        CREATE TABLE IF NOT EXISTS subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            code TEXT,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS group_subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            total_hours INTEGER NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            UNIQUE(group_id, subject_id)
        );

        CREATE TABLE IF NOT EXISTS teacher_subjects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            UNIQUE(teacher_id, subject_id)
        );

        CREATE TABLE IF NOT EXISTS teacher_availability (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            available BOOLEAN NOT NULL DEFAULT 1,
            notes TEXT,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            UNIQUE(teacher_id, day_of_week)
        );

        CREATE TABLE IF NOT EXISTS terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS schedule_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            term_id INTEGER NOT NULL,
            week_type TEXT NOT NULL CHECK (week_type IN ('even', 'odd')),
            day_of_week INTEGER NOT NULL,
            FOREIGN KEY(group_id) REFERENCES groups(id),
            FOREIGN KEY(term_id) REFERENCES terms(id)
        );

        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            subject_id INTEGER NOT NULL,
            teacher_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            homework TEXT,
            FOREIGN KEY(template_id) REFERENCES schedule_templates(id),
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(room_id) REFERENCES rooms(id)
        );

        CREATE TABLE IF NOT EXISTS actual_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            comments TEXT,
            FOREIGN KEY(lesson_id) REFERENCES lessons(id)
        );

        CREATE TABLE IF NOT EXISTS marks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actual_lesson_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            mark1 TEXT,
            mark2 TEXT,
            absence_type TEXT CHECK (absence_type IN ('Н', 'НБ', NULL)),
            comment TEXT CHECK (LENGTH(comment) BETWEEN 1 AND 255),
            timestamp INTEGER,
            FOREIGN KEY(actual_lesson_id) REFERENCES actual_lessons(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id INTEGER,
            actual_lesson_id INTEGER,
            file_path TEXT NOT NULL,
            description TEXT,
            timestamp INTEGER,
            FOREIGN KEY(lesson_id) REFERENCES lessons(id),
            FOREIGN KEY(actual_lesson_id) REFERENCES actual_lessons(id),
            CHECK (lesson_id IS NOT NULL OR actual_lesson_id IS NOT NULL)
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            description TEXT,
            event_type TEXT NOT NULL,
            content TEXT,
            end_date TEXT,
            end_time TEXT,
            recurring_options TEXT,
            subtasks TEXT,
            privacy TEXT NOT NULL,
            password_hash TEXT,
            expiration_days INTEGER,
            version INTEGER DEFAULT 0,
            FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS shared_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            accepted BOOLEAN,
            reason TEXT,
            forbid_edit BOOLEAN,
            allow_comments BOOLEAN,
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS event_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            field TEXT,
            old_value TEXT,
            new_value TEXT,
            timestamp INTEGER,
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER,
            FOREIGN KEY(event_id) REFERENCES events(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER,
            read BOOLEAN DEFAULT FALSE,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            entity_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            timestamp INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            short_name TEXT,
            type TEXT NOT NULL CHECK (type IN ('education')),
            created_at INTEGER,
            created_by INTEGER,
            FOREIGN KEY(created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS organization_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            roles TEXT NOT NULL,
            current_role TEXT NOT NULL,
            joined_at INTEGER,
            profile_data TEXT,
            FOREIGN KEY(organization_id) REFERENCES organizations(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            UNIQUE(organization_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS invitations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            organization_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at INTEGER,
            expires_at INTEGER,
            max_uses INTEGER DEFAULT -1,
            uses INTEGER DEFAULT 0,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        );

        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
            name TEXT,
            created_at INTEGER,
            organization_id INTEGER,
            FOREIGN KEY(organization_id) REFERENCES organizations(id)
        );

        CREATE TABLE IF NOT EXISTS chat_members (
            chat_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            joined_at INTEGER,
            last_read_at INTEGER,
            FOREIGN KEY(chat_id) REFERENCES chats(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            PRIMARY KEY(chat_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            subject TEXT,
            content TEXT NOT NULL,
            sent_at INTEGER NOT NULL,
            edited_at INTEGER,
            reply_to INTEGER,
            FOREIGN KEY(chat_id) REFERENCES chats(id),
            FOREIGN KEY(sender_id) REFERENCES users(id),
            FOREIGN KEY(reply_to) REFERENCES messages(id)
        );

        CREATE TABLE IF NOT EXISTS message_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            file_data BLOB NOT NULL,
            file_size INTEGER NOT NULL,
            mime_type TEXT,
            uploaded_at INTEGER,
            FOREIGN KEY(message_id) REFERENCES messages(id)
        );
        """
        )
        db.commit()


init_db()


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def get_auth_user():
    token = request.headers.get("Authorization")
    if token:
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            return data["username"]
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


@app.route("/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS":
        return "", 200
    data = request.json
    username = data.get("username")
    password = data.get("password")
    email = data.get("email", "")
    role = data.get("role", "student")

    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400

    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    if cur.fetchone():
        return jsonify({"error": "Username exists"}), 400

    # Генерируем уникальный 16-значный ID
    while True:
        user_id = "".join([str(secrets.randbelow(10)) for _ in range(16)])
        cur.execute("SELECT id FROM users WHERE id = ?", (user_id,))
        if not cur.fetchone():
            break

    hashed = hash_password(password)
    cur.execute(
        "INSERT INTO users (id, username, password_hash, email, roles, current_role) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, username, hashed, email, json.dumps([role]), role),
    )
    db.commit()

    if email:
        subject = "Добро пожаловать в KipCalendar!"
        body = f"Здравствуйте, {username}!\n\nВаш User ID: {user_id}\nВы успешно зарегистрировались в KipCalendar.\nВаша роль: {role}\n\nСпасибо за регистрацию!"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: #6366f1;">Добро пожаловать в KipCalendar!</h2>
                <p>Здравствуйте, <strong>{username}</strong>!</p>
                <p><strong>Ваш User ID:</strong> <code>{user_id}</code></p>
                <p>Вы успешно зарегистрировались в системе.</p>
                <p>Ваша роль: <strong>{role}</strong></p>
                <p>Спасибо за регистрацию!</p>
            </body>
        </html>
        """
        send_email(email, subject, body, html_body)

    return jsonify({"message": "Registered", "user_id": user_id})


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
    if user and user["password_hash"] == hash_password(password):
        cur.execute(
            "UPDATE users SET logout_timestamp = NULL WHERE id = ?", (user["id"],)
        )
        db.commit()
        token = jwt.encode(
            {
                "username": username,
                "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1),
            },
            SECRET_KEY,
            algorithm="HS256",
        )
        return jsonify({"token": token})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET logout_timestamp = ? WHERE username = ?",
        (int(time.time()), username),
    )
    db.commit()
    return jsonify({"message": "Logged out"})


@app.route("/role", methods=["GET"])
def get_role():
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT roles, current_role FROM users WHERE username = ?", (username,))
    user = cur.fetchone()
    return jsonify(
        {"roles": json.loads(user["roles"]), "currentRole": user["current_role"]}
    )


@app.route("/switch-role", methods=["POST"])
def switch_role():
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    new_role = data.get("newRole")
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT roles FROM users WHERE username = ?", (username,))
    roles = json.loads(cur.fetchone()["roles"])
    if new_role not in roles:
        return jsonify({"error": "Invalid role"}), 400
    cur.execute(
        "UPDATE users SET current_role = ? WHERE username = ?", (new_role, username)
    )
    db.commit()
    return jsonify({"message": "Role switched"})


@app.route("/events", methods=["GET", "OPTIONS"])
def get_events():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM events WHERE owner_id = ?", (user_id,))
    own_events = cur.fetchall()
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
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    user_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()
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
    cur.execute(
        """
    INSERT INTO events (owner_id, title, date, time, description, event_type, content, end_date, end_time, recurring_options, privacy, password_hash, expiration_days)
    VALUES (?, ?, ?, ?, ?, 'plan', ?, ?, ?, ?, ?, ?, ?)
    """,
        (
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
        ),
    )
    db.commit()
    event_id = cur.lastrowid
    url = f"http://localhost:3000/event/{username}/{data['privacy']}/{event_id}"
    return jsonify({"url": url})


@app.route("/api/events/create-task", methods=["POST", "OPTIONS"])
def create_task():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    user_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()
    raw_subtasks = data.get("subTasks")
    if raw_subtasks:
        subtasks = json.dumps(raw_subtasks)
    else:
        # если подзадачи не переданы, создаём одну "главную" подзадачу по названию задачи
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
    cur.execute(
        """
    INSERT INTO events (owner_id, title, date, time, description, event_type, subtasks, privacy, password_hash, expiration_days)
    VALUES (?, ?, ?, ?, ?, 'task', ?, ?, ?, ?)
    """,
        (
            user_id,
            data["title"],
            datetime.datetime.now().strftime("%Y-%m-%d"),
            datetime.datetime.now().strftime("%H:%M"),
            data.get("description", ""),
            subtasks,
            data["privacy"],
            password_hash,
            data.get("expirationDays"),
        ),
    )
    db.commit()
    event_id = cur.lastrowid
    url = f"http://localhost:3000/event/{username}/{data['privacy']}/{event_id}"
    return jsonify({"url": url})


@app.route("/event/<username>/<privacy>/<name>", methods=["GET", "OPTIONS"])
def view_event(username, privacy, name):
    if request.method == "OPTIONS":
        return "", 200
    event_id = int(name)
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cur.fetchone()
    if not event:
        return jsonify({"error": "Not found"}), 404
    owner_id = get_user_id(username)
    if event["owner_id"] != owner_id:
        auth_user = get_auth_user()
        auth_id = get_user_id(auth_user) if auth_user else None
        cur.execute(
            "SELECT * FROM shared_events WHERE event_id = ? AND user_id = ? AND accepted = 1",
            (event_id, auth_id),
        )
        if not cur.fetchone() and event["privacy"] == "private":
            return jsonify({"error": "Unauthorized"}), 401
    if event["privacy"] == "private":
        pass_param = request.args.get("password")
        if not pass_param or hash_password(pass_param) != event["password_hash"]:
            return jsonify({"error": "Wrong password"}), 403
        if event["expiration_days"]:
            create_time = datetime.datetime.strptime(
                event["date"] + " " + event["time"], "%Y-%m-%d %H:%M"
            )
            if datetime.datetime.now() - create_time > datetime.timedelta(
                days=event["expiration_days"]
            ):
                return jsonify({"error": "Expired"}), 403
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
    ev_dict["id"] = event_id
    ev_dict["shared"] = (
        True
        if cur.execute(
            "SELECT COUNT(*) FROM shared_events WHERE event_id = ?", (event_id,)
        ).fetchone()[0]
        > 0
        else False
    )
    cur.execute(
        "SELECT allow_comments FROM shared_events WHERE event_id = ? LIMIT 1",
        (event_id,),
    )
    share = cur.fetchone()
    ev_dict["allowComments"] = share["allow_comments"] if share else False
    return jsonify(ev_dict)


@app.route("/event/<privacy>/<name>", methods=["PUT", "DELETE", "OPTIONS"])
def modify_event(privacy, name):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    event_id = int(name)
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM events WHERE id = ?", (event_id,))
    event = cur.fetchone()
    if not event:
        return jsonify({"error": "Not found"}), 404
    user_id = get_user_id(username)
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
        set_clause = (
            ", ".join([f"{field} = ?" for field in update_fields if field in data])
            + ", password_hash = ?, version = version + 1"
        )
        params = [updated_event[field] for field in update_fields if field in data] + [
            updated_event["password_hash"],
            event_id,
            old_version,
        ]
        cur.execute(
            f"UPDATE events SET {set_clause} WHERE id = ? AND version = ?", params
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Conflict"}), 409
        db.commit()
        timestamp = int(time.time())
        for field, old, new in updates:
            cur.execute(
                "INSERT INTO event_history (event_id, user_id, field, old_value, new_value, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (event_id, user_id, field, old, new, timestamp),
            )
        db.commit()
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
        return jsonify({"message": "Updated"})


@app.route("/api/events/<int:event_id>/share", methods=["POST", "OPTIONS"])
def share_event(event_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    users = data["users"]  # list of usernames
    forbid_edit = data.get("forbid_edit", False)
    allow_comments = data.get("allow_comments", False)
    db = get_db()
    cur = db.cursor()
    for u in users:
        u_id = get_user_id(u)
        if u_id:
            cur.execute(
                "INSERT INTO shared_events (event_id, user_id, accepted, forbid_edit, allow_comments) VALUES (?, ?, NULL, ?, ?)",
                (event_id, u_id, forbid_edit, allow_comments),
            )
    db.commit()
    for u in users:
        u_id = get_user_id(u)
        if u_id:
            socketio.emit("new_share", {"event_id": event_id}, room=str(u_id))
    return jsonify({"message": "Shared"})


@app.route("/api/shares/pending", methods=["GET", "OPTIONS"])
def pending_shares():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = get_user_id(username)
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


@app.route("/api/shares/accept/<int:id>", methods=["POST", "OPTIONS"])
def accept_share(id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE shared_events SET accepted = 1 WHERE id = ? AND user_id = ?",
        (id, user_id),
    )
    db.commit()
    return jsonify({"message": "Accepted"})


@app.route("/api/shares/decline/<int:id>", methods=["POST", "OPTIONS"])
def decline_share(id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    data = request.json
    reason = data.get("reason")
    user_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "UPDATE shared_events SET accepted = 0, reason = ? WHERE id = ? AND user_id = ?",
        (reason, id, user_id),
    )
    db.commit()
    cur.execute(
        "SELECT owner_id FROM events WHERE id = (SELECT event_id FROM shared_events WHERE id = ?)",
        (id,),
    )
    sender_id = cur.fetchone()["owner_id"]
    socketio.emit(
        "share_declined", {"share_id": id, "reason": reason}, room=str(sender_id)
    )
    return jsonify({"message": "Declined"})


@app.route("/api/users/get-by-role", methods=["GET", "OPTIONS"])
def get_users_by_role():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    role = request.args.get("role")
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT id, username FROM users WHERE roles LIKE ?", (f'%"{role}"%',))
    return jsonify([dict(row) for row in cur.fetchall()])


@app.route("/api/events/<int:event_id>/comments", methods=["GET", "POST", "OPTIONS"])
def event_comments(event_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401
    user_id = get_user_id(username)
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
        cur.execute(
            "INSERT INTO comments (event_id, user_id, content, timestamp) VALUES (?, ?, ?, ?)",
            (event_id, user_id, content, timestamp),
        )
        db.commit()
        return jsonify(
            {
                "id": cur.lastrowid,
                "content": content,
                "user": username,
                "timestamp": timestamp,
            }
        )


@app.route("/api/events/<int:event_id>/history", methods=["GET", "OPTIONS"])
def event_history(event_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
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
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    actual_lesson_id = data.get("actual_lesson_id")
    student_id = data.get("student_id")
    mark1 = data.get("mark1")
    mark2 = data.get("mark2")
    absence_type = data.get("absence_type")
    comment = data.get("comment")

    db = get_db()
    cur = db.cursor()

    # Добавляем оценку
    cur.execute(
        """INSERT INTO marks (actual_lesson_id, student_id, mark1, mark2, absence_type, comment, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (
            actual_lesson_id,
            student_id,
            mark1,
            mark2,
            absence_type,
            comment,
            int(time.time()),
        ),
    )
    db.commit()

    # Получаем email студента и отправляем уведомление
    cur.execute("SELECT email, username FROM users WHERE id = ?", (student_id,))
    student = cur.fetchone()

    if student and student["email"]:
        subject = "Новая оценка в KipCalendar"
        body = f"Здравствуйте, {student['username']}!\n\nВам выставлена новая оценка:\n"
        if mark1:
            body += f"Оценка 1: {mark1}\n"
        if mark2:
            body += f"Оценка 2: {mark2}\n"
        if comment:
            body += f"Комментарий: {comment}\n"

        send_email(student["email"], subject, body)

    return jsonify({"message": "Mark added"})


# ========== МЕССЕНДЖЕР API ==========


@app.route("/api/user/search", methods=["GET", "OPTIONS"])
def search_users():
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    email = request.args.get("email")
    user_id = request.args.get("user_id")

    db = get_db()
    cur = db.cursor()

    if email:
        cur.execute("SELECT id, username, email FROM users WHERE email = ?", (email,))
    elif user_id:
        cur.execute("SELECT id, username, email FROM users WHERE id = ?", (user_id,))
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
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    target_user_id = data.get("user_id")
    my_id = get_user_id(username)

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
        (my_id, target_user_id),
    )

    existing = cur.fetchone()
    if existing:
        return jsonify({"chat_id": existing[0]})

    # Создаем новый чат
    cur.execute(
        "INSERT INTO chats (type, created_at) VALUES ('direct', ?)", (int(time.time()),)
    )
    chat_id = cur.lastrowid

    cur.execute(
        "INSERT INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)",
        (chat_id, my_id, int(time.time())),
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
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    my_id = get_user_id(username)
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
        (my_id, my_id),
    )

    chats = [dict(row) for row in cur.fetchall()]
    return jsonify(chats)


@app.route("/api/chats/<int:chat_id>/messages", methods=["GET", "POST", "OPTIONS"])
def chat_messages(chat_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    my_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()

    # Проверяем доступ
    cur.execute(
        "SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?", (chat_id, my_id)
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

        cur.execute(
            """
            INSERT INTO messages (chat_id, sender_id, subject, content, sent_at, reply_to)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (chat_id, my_id, subject, content, int(time.time()), reply_to),
        )
        message_id = cur.lastrowid
        db.commit()

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
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    name = data.get("name")
    short_name = data.get("short_name")
    org_type = data.get("type", "education")

    if not name:
        return jsonify({"error": "Name required"}), 400

    my_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()

    cur.execute(
        """
        INSERT INTO organizations (name, short_name, type, created_at, created_by)
        VALUES (?, ?, ?, ?, ?)
    """,
        (name, short_name, org_type, int(time.time()), my_id),
    )
    org_id = cur.lastrowid

    # Создатель становится администратором
    cur.execute(
        """
        INSERT INTO organization_members (organization_id, user_id, roles, current_role, joined_at)
        VALUES (?, ?, ?, ?, ?)
    """,
        (org_id, my_id, json.dumps(["admin"]), "admin", int(time.time())),
    )

    db.commit()
    return jsonify({"organization_id": org_id})


@app.route(
    "/api/organizations/<int:org_id>/invitations/create", methods=["POST", "OPTIONS"]
)
def create_invitation(org_id):
    if request.method == "OPTIONS":
        return "", 200
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    role = data.get("role")
    max_uses = data.get("max_uses", -1)

    if role not in ["admin", "teacher", "student"]:
        return jsonify({"error": "Invalid role"}), 400

    my_id = get_user_id(username)
    db = get_db()
    cur = db.cursor()

    # Проверяем права (только админы)
    cur.execute(
        """
        SELECT roles FROM organization_members 
        WHERE organization_id = ? AND user_id = ?
    """,
        (org_id, my_id),
    )
    member = cur.fetchone()
    if not member or "admin" not in json.loads(member[0]):
        return jsonify({"error": "Permission denied"}), 403

    # Генерируем токен
    token = secrets.token_urlsafe(32)
    expires_at = int(time.time()) + (7 * 24 * 60 * 60)  # 7 дней

    cur.execute(
        """
        INSERT INTO invitations (organization_id, role, token, created_at, expires_at, max_uses)
        VALUES (?, ?, ?, ?, ?, ?)
    """,
        (org_id, role, token, int(time.time()), expires_at, max_uses),
    )
    db.commit()

    invite_url = f"http://localhost:3000/invite/{token}"
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
    username = get_auth_user()
    if not username:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    profile_data = data.get("profile_data", {})

    my_id = get_user_id(username)
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
        (org_id, my_id),
    )
    existing = cur.fetchone()

    if existing:
        # Добавляем роль к существующим
        roles = json.loads(existing[0])
        if role not in roles:
            roles.append(role)
            cur.execute(
                """
                UPDATE organization_members 
                SET roles = ?, profile_data = ?
                WHERE organization_id = ? AND user_id = ?
            """,
                (json.dumps(roles), json.dumps(profile_data), org_id, my_id),
            )
    else:
        # Создаем новое членство
        cur.execute(
            """
            INSERT INTO organization_members 
            (organization_id, user_id, roles, current_role, joined_at, profile_data)
            VALUES (?, ?, ?, ?, ?, ?)
        """,
            (
                org_id,
                my_id,
                json.dumps([role]),
                role,
                int(time.time()),
                json.dumps(profile_data),
            ),
        )

    # Увеличиваем счетчик использований
    cur.execute("UPDATE invitations SET uses = uses + 1 WHERE id = ?", (invite["id"],))
    db.commit()

    return jsonify({"message": "Joined organization"})


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


check_expired_users()

if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True, host="0.0.0.0")
