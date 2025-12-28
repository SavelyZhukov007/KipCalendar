import sqlite3
import csv
from collections import defaultdict
import random
import re

# Schema
schema = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
"""


def main():
    conn = sqlite3.connect("kipcalendar.db")
    cursor = conn.cursor()
    # Comment out schema execution since DB is already created
    # cursor.executescript(schema)
    # conn.commit()

    # Dictionaries for IDs
    building_ids = {}
    room_ids = {}
    subject_ids = {}
    teacher_ids = {}
    group_ids = {}
    template_ids = defaultdict(
        dict
    )  # group_id -> (week_type, day_of_week) -> template_id

    # Parse group name to components
    def parse_group_name(name):
        match = re.match(r"(\d)([А-ЯА-Я]+)-(\d+)(\d{2})", name)
        if match:
            course = int(match.group(1))
            specialty = match.group(2)
            group_number = int(match.group(3))
            admission_year = int(match.group(4))
            return course, specialty, group_number, admission_year
        raise ValueError(f"Invalid group name: {name}")

    # Read CSV
    with open("input.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        data = list(reader)

    # Collect uniques
    buildings = set(row["BuildingName"] for row in data)
    rooms_by_building = defaultdict(set)
    subjects = set(row["Subject"] for row in data)
    teachers = set(row["TeacherFullName"] for row in data)
    groups = set(row["Group"] for row in data)
    group_buildings = defaultdict(list)
    teacher_subjects_dict = defaultdict(set)
    group_subjects_dict = defaultdict(set)

    for row in data:
        group_buildings[row["Group"]].append(row["BuildingName"])
        rooms_by_building[row["BuildingName"]].add(row["RoomName"])
        teacher_subjects_dict[row["TeacherFullName"]].add(row["Subject"])
        group_subjects_dict[row["Group"]].add(row["Subject"])

    # Insert buildings if not exist
    for b in buildings:
        cursor.execute("SELECT id FROM buildings WHERE name = ?", (b,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute("INSERT INTO buildings (name) VALUES (?)", (b,))
            building_ids[b] = cursor.lastrowid
        else:
            building_ids[b] = row[0]

    # Insert rooms
    for b, rs in rooms_by_building.items():
        b_id = building_ids[b]
        for r in rs:
            cursor.execute(
                "SELECT id FROM rooms WHERE building_id = ? AND name = ?", (b_id, r)
            )
            row = cursor.fetchone()
            if row is None:
                max_groups = random.randint(1, 3)
                cursor.execute(
                    "INSERT INTO rooms (building_id, name, max_groups) VALUES (?, ?, ?)",
                    (b_id, r, max_groups),
                )
                room_ids[(b, r)] = cursor.lastrowid
            else:
                room_ids[(b, r)] = row[0]

    # Insert subjects
    for s in subjects:
        cursor.execute("SELECT id FROM subjects WHERE name = ?", (s,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute("INSERT INTO subjects (name) VALUES (?)", (s,))
            subject_ids[s] = cursor.lastrowid
        else:
            subject_ids[s] = row[0]

    # Insert teachers (users)
    for t in teachers:
        # Assume name is "Last First Middle" or simplify
        parts = t.split()
        last_name = parts[0]
        first_name = parts[1] if len(parts) > 1 else ""
        middle_name = parts[2] if len(parts) > 2 else ""
        username = t.lower().replace(" ", "_")
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute(
                """
                INSERT INTO users (username, password_hash, roles, current_role, first_name, last_name, middle_name)
                VALUES (?, 'dummy', 'teacher', 'teacher', ?, ?, ?)
            """,
                (username, first_name, last_name, middle_name),
            )
            teacher_id = cursor.lastrowid
        else:
            teacher_id = row[0]
        teacher_ids[t] = teacher_id

        # Teacher subjects
        for s in teacher_subjects_dict[t]:
            s_id = subject_ids[s]
            cursor.execute(
                "INSERT OR IGNORE INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
                (teacher_id, s_id),
            )

    # Insert groups
    for g in groups:
        course, specialty, group_number, admission_year = parse_group_name(g)
        # Primary building: most common
        common_building = max(set(group_buildings[g]), key=group_buildings[g].count)
        b_id = building_ids[common_building]
        cursor.execute("SELECT id FROM groups WHERE name = ?", (g,))
        row = cursor.fetchone()
        if row is None:
            cursor.execute(
                """
                INSERT INTO groups (name, specialty, course, group_number, admission_year, building_id)
                VALUES (?, ?, ?, ?, ?, ?)
            """,
                (g, specialty, course, group_number, admission_year, b_id),
            )
            group_id = cursor.lastrowid
        else:
            group_id = row[0]
        group_ids[g] = group_id

        # Group subjects with random hours
        for s in group_subjects_dict[g]:
            s_id = subject_ids[s]
            cursor.execute(
                "SELECT id FROM group_subjects WHERE group_id = ? AND subject_id = ?",
                (group_id, s_id),
            )
            if cursor.fetchone() is None:
                hours = random.randint(50, 100)
                cursor.execute(
                    "INSERT INTO group_subjects (group_id, subject_id, total_hours) VALUES (?, ?, ?)",
                    (group_id, s_id, hours),
                )

    # Insert term if not exist
    cursor.execute("SELECT id FROM terms WHERE name = 'Spring 2026'")
    row = cursor.fetchone()
    if row is None:
        cursor.execute(
            "INSERT INTO terms (name, start_date, end_date) VALUES ('Spring 2026', '2026-02-01', '2026-06-30')"
        )
        term_id = cursor.lastrowid
    else:
        term_id = row[0]

    # Day map
    day_map = {"Понедельник": 1, "Вторник": 2, "Среда": 3, "Четверг": 4, "Пятница": 5}

    # Insert templates and lessons
    for row in data:
        g = row["Group"]
        week_type = row["WeekType"]
        day_name = row["Day"]
        day_of_week = day_map[day_name]
        group_id = group_ids[g]

        # Template
        key = (week_type, day_of_week)
        if key not in template_ids[group_id]:
            cursor.execute(
                "SELECT id FROM schedule_templates WHERE group_id = ? AND term_id = ? AND week_type = ? AND day_of_week = ?",
                (group_id, term_id, week_type, day_of_week),
            )
            t_row = cursor.fetchone()
            if t_row is None:
                cursor.execute(
                    """
                    INSERT INTO schedule_templates (group_id, term_id, week_type, day_of_week)
                    VALUES (?, ?, ?, ?)
                """,
                    (group_id, term_id, week_type, day_of_week),
                )
                template_ids[group_id][key] = cursor.lastrowid
            else:
                template_ids[group_id][key] = t_row[0]

        template_id = template_ids[group_id][key]

        # Lesson
        s = row["Subject"]
        t = row["TeacherFullName"]
        r = row["RoomName"]
        b = row["BuildingName"]
        start = row["StartTime"]
        end = row["EndTime"]
        hw = row["Homework"]

        s_id = subject_ids[s]
        t_id = teacher_ids[t]
        r_id = room_ids[(b, r)]

        # Check if lesson already exists to avoid duplicates
        cursor.execute(
            """
            SELECT id FROM lessons WHERE template_id = ? AND start_time = ? AND end_time = ?
        """,
            (template_id, start, end),
        )
        if cursor.fetchone() is None:
            cursor.execute(
                """
                INSERT INTO lessons (template_id, subject_id, teacher_id, room_id, start_time, end_time, homework)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (template_id, s_id, t_id, r_id, start, end, hw),
            )

    conn.commit()
    conn.close()
    print("Data inserted successfully.")


if __name__ == "__main__":
    main()
#test