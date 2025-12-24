from flask import Flask, request, jsonify, g
from flask_cors import CORS
import sqlite3
import json
import hashlib
import jwt
import datetime
import time
from threading import Timer
from flask_socketio import SocketIO, emit

app = Flask(__name__)
CORS(
    app,
    origins=["*"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True,
)
socketio = SocketIO(app, cors_allowed_origins="*")

SECRET_KEY = "your_secret_key_change_me"
DATABASE = "kipcalendar.db"


def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                roles TEXT NOT NULL,  -- JSON array
                current_role TEXT NOT NULL,
                logout_timestamp INTEGER
            );
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT
            );
            CREATE TABLE IF NOT EXISTS user_groups (
                user_id INTEGER,
                group_id INTEGER,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(group_id) REFERENCES groups(id)
            );
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                description TEXT,
                event_type TEXT NOT NULL,  -- plan or task
                content TEXT,  -- for plan
                end_date TEXT,
                end_time TEXT,
                recurring_options TEXT,  -- JSON
                subtasks TEXT,  -- JSON for task
                privacy TEXT NOT NULL,  -- public/private
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
    role = data.get("role", "student")
    if not username or not password:
        return jsonify({"error": "Missing fields"}), 400
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM users WHERE username = ?", (username,))
    if cur.fetchone():
        return jsonify({"error": "Username exists"}), 400
    hashed = hash_password(password)
    cur.execute(
        "INSERT INTO users (username, password_hash, roles, current_role) VALUES (?, ?, ?, ?)",
        (username, hashed, json.dumps([role]), role),
    )
    db.commit()
    return jsonify({"message": "Registered"})


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
    cur.execute(
        "SELECT id, username FROM users WHERE JSON_CONTAINS(roles, ?) ",
        (json.dumps(role),),
    )
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
            cur.execute("DELETE FROM events WHERE owner_id = ?", (row["id"],))
            cur.execute(
                "DELETE FROM shared_events WHERE user_id = ? OR event_id IN (SELECT id FROM events WHERE owner_id = ?)",
                (row["id"], row["id"]),
            )
            cur.execute("DELETE FROM event_history WHERE user_id = ?", (row["id"],))
            cur.execute("DELETE FROM comments WHERE user_id = ?", (row["id"],))
            cur.execute("DELETE FROM users WHERE id = ?", (row["id"],))
        db.commit()
    Timer(86400, check_expired_users).start()


check_expired_users()

if __name__ == "__main__":
    socketio.run(app, port=5000, debug=True, host="0.0.0.0")
