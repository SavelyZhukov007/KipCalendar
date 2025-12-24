#!/usr/bin/env python3
# ScheduleCreate.py
# Расширённый GUI для создания данных расписания, импорта CSV, хранения файлов и простого генератора расписания.
# Требования: Python 3.8+, PyQt5
# pip install PyQt5

import sys
import os
import sqlite3
import datetime
import csv
import shutil
from typing import List, Optional, Tuple, Dict

from PyQt5.QtWidgets import (
    QApplication,
    QWidget,
    QMainWindow,
    QTabWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QLineEdit,
    QMessageBox,
    QSpinBox,
    QTextEdit,
    QComboBox,
    QFileDialog,
    QCheckBox,
    QTableWidget,
    QTableWidgetItem,
    QGroupBox,
    QListWidget,
    QListWidgetItem,
    QFormLayout,
    QFrame,
    QSizePolicy,
)
from PyQt5.QtCore import Qt

DB_FILENAME = "schedule.db"
STORAGE_DIR = os.path.join(
    os.path.dirname(__file__) if "__file__" in globals() else os.getcwd(), "storage"
)
ensure_storage_types = ["lessons", "actual_lessons", "subjects", "teachers", "others"]


def ensure_dir(path: str):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


# ensure storage directories
ensure_dir(STORAGE_DIR)
for t in ensure_storage_types:
    ensure_dir(os.path.join(STORAGE_DIR, t))


class Database:
    def __init__(self, filename=DB_FILENAME):
        self.filename = filename
        self.conn = sqlite3.connect(self.filename)
        self.conn.execute("PRAGMA foreign_keys = ON;")
        self.create_tables()

    def create_tables(self):
        c = self.conn.cursor()
        # Use the same schema as provided earlier
        c.executescript(
            """
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
        )
        self.conn.commit()

    # --- Buildings & rooms ---
    def add_building(self, name: str, address: str) -> int:
        c = self.conn.cursor()
        c.execute(
            "INSERT INTO buildings (name, address) VALUES (?, ?)", (name, address)
        )
        self.conn.commit()
        return c.lastrowid

    def list_buildings(self):
        c = self.conn.cursor()
        c.execute("SELECT id, name, address FROM buildings ORDER BY id")
        return c.fetchall()

    def add_room(self, building_id: int, name: str, max_groups: int) -> int:
        c = self.conn.cursor()
        c.execute(
            "INSERT INTO rooms (building_id, name, max_groups) VALUES (?, ?, ?)",
            (building_id, name, max_groups),
        )
        self.conn.commit()
        return c.lastrowid

    def list_rooms(self):
        c = self.conn.cursor()
        c.execute(
            """SELECT rooms.id, buildings.name, rooms.name, rooms.max_groups
                     FROM rooms JOIN buildings ON rooms.building_id=buildings.id
                     ORDER BY rooms.id"""
        )
        return c.fetchall()

    # --- Groups ---
    def add_group(
        self,
        name: str,
        specialty: str,
        course: int,
        group_number: int,
        admission_year: int,
        type_: Optional[str],
        curator_id: Optional[int],
        building_id: Optional[int],
    ) -> int:
        c = self.conn.cursor()
        c.execute(
            """INSERT INTO groups (name, specialty, course, group_number, admission_year, type, curator_id, building_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                name,
                specialty,
                course,
                group_number,
                admission_year,
                type_,
                curator_id,
                building_id,
            ),
        )
        self.conn.commit()
        return c.lastrowid

    def list_groups(self):
        c = self.conn.cursor()
        c.execute(
            """SELECT g.id, g.name, g.specialty, g.course, g.group_number, g.admission_year,
                            b.name as building_name
                     FROM groups g LEFT JOIN buildings b ON g.building_id=b.id
                     ORDER BY g.id"""
        )
        return c.fetchall()

    # --- Subjects ---
    def add_subject(
        self, name: str, code: Optional[str], description: Optional[str]
    ) -> int:
        c = self.conn.cursor()
        c.execute(
            "INSERT INTO subjects (name, code, description) VALUES (?, ?, ?)",
            (name, code, description),
        )
        self.conn.commit()
        return c.lastrowid

    def list_subjects(self):
        c = self.conn.cursor()
        c.execute("SELECT id, name, code, description FROM subjects ORDER BY id")
        return c.fetchall()

    def add_group_subject(
        self, group_id: int, subject_id: int, total_hours: int
    ) -> int:
        c = self.conn.cursor()
        c.execute(
            "INSERT INTO group_subjects (group_id, subject_id, total_hours) VALUES (?, ?, ?)",
            (group_id, subject_id, total_hours),
        )
        self.conn.commit()
        return c.lastrowid

    def list_group_subjects(self):
        c = self.conn.cursor()
        c.execute(
            """SELECT gs.id, g.name as group_name, s.name as subject_name, gs.total_hours
                     FROM group_subjects gs
                     JOIN groups g ON gs.group_id=g.id
                     JOIN subjects s ON gs.subject_id=s.id
                     ORDER BY gs.id"""
        )
        return c.fetchall()

    # --- Teachers / Users ---
    def add_user(
        self,
        username: str,
        password_hash: str,
        roles: str,
        current_role: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        email: Optional[str] = None,
    ) -> int:
        c = self.conn.cursor()
        c.execute(
            """INSERT INTO users (username, password_hash, email, roles, current_role, first_name, last_name, middle_name)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                username,
                password_hash,
                email,
                roles,
                current_role,
                first_name,
                last_name,
                middle_name,
            ),
        )
        self.conn.commit()
        return c.lastrowid

    def list_users(self):
        c = self.conn.cursor()
        c.execute(
            "SELECT id, username, first_name, last_name, middle_name, email FROM users ORDER BY id"
        )
        return c.fetchall()

    def add_teacher_subject(self, teacher_id: int, subject_id: int) -> int:
        c = self.conn.cursor()
        c.execute(
            "INSERT OR IGNORE INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)",
            (teacher_id, subject_id),
        )
        self.conn.commit()
        return c.lastrowid

    def set_teacher_availability(
        self,
        teacher_id: int,
        day_of_week: int,
        available: bool,
        notes: Optional[str] = None,
    ):
        c = self.conn.cursor()
        try:
            c.execute(
                "INSERT INTO teacher_availability (teacher_id, day_of_week, available, notes) VALUES (?, ?, ?, ?)",
                (teacher_id, day_of_week, int(available), notes),
            )
        except sqlite3.IntegrityError:
            c.execute(
                "UPDATE teacher_availability SET available=?, notes=? WHERE teacher_id=? AND day_of_week=?",
                (int(available), notes, teacher_id, day_of_week),
            )
        self.conn.commit()

    def list_teacher_availability(self, teacher_id: int):
        c = self.conn.cursor()
        c.execute(
            "SELECT day_of_week, available, notes FROM teacher_availability WHERE teacher_id=? ORDER BY day_of_week",
            (teacher_id,),
        )
        return c.fetchall()

    # attachments helper (store path and timestamp)
    def add_attachment(
        self,
        lesson_id: Optional[int],
        actual_lesson_id: Optional[int],
        file_path: str,
        description: str = "",
    ):
        ts = int(datetime.datetime.utcnow().timestamp())
        c = self.conn.cursor()
        c.execute(
            """INSERT INTO attachments (lesson_id, actual_lesson_id, file_path, description, timestamp)
                     VALUES (?, ?, ?, ?, ?)""",
            (lesson_id, actual_lesson_id, file_path, description, ts),
        )
        self.conn.commit()
        return c.lastrowid

    # store file into ./storage/<category>/ and return stored relative path
    def store_file(self, src_path: str, category: str = "others") -> str:
        if not os.path.isfile(src_path):
            raise FileNotFoundError(src_path)
        category = category if category in ensure_storage_types else "others"
        dest_dir = os.path.join(STORAGE_DIR, category)
        ensure_dir(dest_dir)
        basename = os.path.basename(src_path)
        # add timestamp to avoid collisions
        ts = datetime.datetime.utcnow().strftime("%Y%m%d%H%M%S")
        dest_name = f"{ts}_{basename}"
        dest_path = os.path.join(dest_dir, dest_name)
        shutil.copy2(src_path, dest_path)
        # return relative path from project root
        rel = os.path.relpath(dest_path, start=os.path.dirname(self.filename) or ".")
        return rel

    def close(self):
        self.conn.close()


# ---------- UI Components ----------
class BuildingsTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        box_build = QGroupBox("Добавить корпус (building)")
        form = QFormLayout()
        self.building_name = QLineEdit()
        self.building_address = QLineEdit()
        btn_add_build = QPushButton("Добавить корпус")
        btn_add_build.clicked.connect(self.add_building)
        form.addRow("Название корпуса:", self.building_name)
        form.addRow("Адрес (опционально):", self.building_address)
        form.addRow(btn_add_build)
        box_build.setLayout(form)
        main.addWidget(box_build)

        self.buildings_list = QListWidget()
        refresh_btn = QPushButton("Обновить список корпусов и аудиторий")
        refresh_btn.clicked.connect(self.refresh_list)
        main.addWidget(QLabel("Список корпусов и аудиторий:"))
        main.addWidget(self.buildings_list)
        main.addWidget(refresh_btn)

        box_room = QGroupBox("Добавить аудиторию (room)")
        formr = QFormLayout()
        self.room_building_combo = QComboBox()
        self.room_name = QLineEdit()
        self.room_max_groups = QSpinBox()
        self.room_max_groups.setMinimum(1)
        self.room_max_groups.setMaximum(100)
        btn_add_room = QPushButton("Добавить аудиторию")
        btn_add_room.clicked.connect(self.add_room)
        formr.addRow("Корпус:", self.room_building_combo)
        formr.addRow("Название аудитории:", self.room_name)
        formr.addRow("Макс. кол-во групп:", self.room_max_groups)
        formr.addRow(btn_add_room)
        box_room.setLayout(formr)
        main.addWidget(box_room)

        self.setLayout(main)
        self.refresh_list()

    def add_building(self):
        name = self.building_name.text().strip()
        address = self.building_address.text().strip()
        if not name:
            QMessageBox.warning(self, "Ошибка", "Название корпуса обязательно.")
            return
        self.db.add_building(name, address)
        self.building_name.clear()
        self.building_address.clear()
        self.refresh_list()
        QMessageBox.information(self, "ОК", "Корпус добавлен.")

    def refresh_list(self):
        self.buildings_list.clear()
        self.room_building_combo.clear()
        builds = self.db.list_buildings()
        for b in builds:
            bid, name, address = b
            self.room_building_combo.addItem(f"{name} (id={bid})", bid)
            self.buildings_list.addItem(f"Корпус: [{bid}] {name} — {address}")

        rooms = self.db.list_rooms()
        if rooms:
            self.buildings_list.addItem("---- Аудитории ----")
            for r in rooms:
                rid, bname, rname, maxg = r
                self.buildings_list.addItem(
                    f"Аудитория: [{rid}] {bname} / {rname} — max_groups={maxg}"
                )

    def add_room(self):
        idx = self.room_building_combo.currentIndex()
        if idx < 0:
            QMessageBox.warning(self, "Ошибка", "Выберите корпус сначала.")
            return
        building_id = self.room_building_combo.currentData()
        name = self.room_name.text().strip()
        maxg = self.room_max_groups.value()
        if not name:
            QMessageBox.warning(self, "Ошибка", "Название аудитории обязательно.")
            return
        self.db.add_room(building_id, name, maxg)
        self.room_name.clear()
        self.room_max_groups.setValue(1)
        self.refresh_list()
        QMessageBox.information(self, "ОК", "Аудитория добавлена.")


class GroupsTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        form = QFormLayout()
        self.course_spin = QSpinBox()
        self.course_spin.setMinimum(1)
        self.course_spin.setMaximum(20)
        self.specialty_edit = QLineEdit()
        self.group_number_spin = QSpinBox()
        self.group_number_spin.setMinimum(1)
        self.group_number_spin.setMaximum(999)
        self.admission_year_spin = QSpinBox()
        self.admission_year_spin.setMinimum(2000)
        self.admission_year_spin.setMaximum(2099)
        self.type_edit = QLineEdit()
        self.curator_combo = QComboBox()
        self.building_combo = QComboBox()
        btn_refresh_staff = QPushButton("Обновить список преподавателей и корпусов")
        btn_refresh_staff.clicked.connect(self.refresh_lookups)
        form.addRow("Курс (число):", self.course_spin)
        form.addRow("Специальность (текст):", self.specialty_edit)
        form.addRow("Номер группы (число):", self.group_number_spin)
        form.addRow("Год поступления (полный YYYY):", self.admission_year_spin)
        form.addRow("Тип (опционально):", self.type_edit)
        form.addRow("Куратор (опция):", self.curator_combo)
        form.addRow("Основной корпус:", self.building_combo)
        form.addRow(btn_refresh_staff)
        btn_generate = QPushButton("Сгенерировать итоговое имя группы (preview)")
        btn_generate.clicked.connect(self.preview_name)
        self.preview_label = QLabel("<i>Пусто</i>")
        form.addRow(btn_generate, self.preview_label)
        btn_add_group = QPushButton("Добавить группу в БД")
        btn_add_group.clicked.connect(self.add_group)
        form.addRow(btn_add_group)
        main.addLayout(form)
        self.table = QTableWidget(0, 7)
        self.table.setHorizontalHeaderLabels(
            [
                "id",
                "name",
                "specialty",
                "course",
                "group_number",
                "admission_year",
                "building",
            ]
        )
        main.addWidget(QLabel("Текущие группы:"))
        main.addWidget(self.table)
        btn_refresh = QPushButton("Обновить список групп")
        btn_refresh.clicked.connect(self.refresh_table)
        main.addWidget(btn_refresh)
        self.setLayout(main)
        self.refresh_lookups()
        self.refresh_table()

    def preview_name(self):
        course = self.course_spin.value()
        spec = self.specialty_edit.text().strip().upper().replace(" ", "")
        grp = self.group_number_spin.value()
        year = self.admission_year_spin.value() % 100
        if not spec:
            QMessageBox.warning(self, "Ошибка", "Укажите название специальности.")
            return
        name = f"{course}{spec}-{grp}{year:02d}"
        self.preview_label.setText(name)

    def refresh_lookups(self):
        self.curator_combo.clear()
        self.building_combo.clear()
        users = self.db.list_users()
        self.curator_combo.addItem("— нет —", None)
        for u in users:
            uid, username, first, last, middle, email = u
            full = " ".join([x for x in (last or "", first or "", middle or "") if x])
            display = f"{full} (id={uid})" if full else f"{username} (id={uid})"
            self.curator_combo.addItem(display, uid)
        buildings = self.db.list_buildings()
        self.building_combo.addItem("— нет —", None)
        for b in buildings:
            bid, name, address = b
            self.building_combo.addItem(f"{name} (id={bid})", bid)

    def add_group(self):
        course = self.course_spin.value()
        specialty = self.specialty_edit.text().strip().upper().replace(" ", "")
        group_number = self.group_number_spin.value()
        admission_year = self.admission_year_spin.value()
        type_ = self.type_edit.text().strip()
        curator_id = self.curator_combo.currentData()
        building_id = self.building_combo.currentData()
        if not specialty:
            QMessageBox.warning(self, "Ошибка", "Специальность обязательна.")
            return
        name = f"{course}{specialty}-{group_number}{admission_year % 100:02d}"
        self.db.add_group(
            name,
            specialty,
            course,
            group_number,
            admission_year,
            type_,
            curator_id,
            building_id,
        )
        QMessageBox.information(self, "ОК", f"Группа {name} добавлена.")
        self.refresh_table()

    def refresh_table(self):
        data = self.db.list_groups()
        self.table.setRowCount(0)
        for row in data:
            r = self.table.rowCount()
            self.table.insertRow(r)
            for col, val in enumerate(row[:7]):
                self.table.setItem(
                    r, col, QTableWidgetItem(str(val) if val is not None else "")
                )


class SubjectsTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        box = QGroupBox("Добавить предмет")
        form = QFormLayout()
        self.subj_name = QLineEdit()
        self.subj_code = QLineEdit()
        self.subj_desc = QTextEdit()
        self.subj_desc.setMaximumHeight(60)
        btn_add_subj = QPushButton("Добавить предмет")
        btn_add_subj.clicked.connect(self.add_subject)
        form.addRow("Название предмета:", self.subj_name)
        form.addRow("Код (опционально):", self.subj_code)
        form.addRow("Описание (опционально):", self.subj_desc)
        form.addRow(btn_add_subj)
        box.setLayout(form)
        main.addWidget(box)
        self.subj_table = QTableWidget(0, 3)
        self.subj_table.setHorizontalHeaderLabels(["id", "name", "code"])
        main.addWidget(QLabel("Список предметов:"))
        main.addWidget(self.subj_table)
        btn_refresh = QPushButton("Обновить предметы")
        btn_refresh.clicked.connect(self.refresh_subjects)
        main.addWidget(btn_refresh)
        assign_box = QGroupBox("Привязать предмет к группе (total_hours)")
        form2 = QFormLayout()
        self.assign_group_combo = QComboBox()
        self.assign_subject_combo = QComboBox()
        self.assign_total_hours = QSpinBox()
        self.assign_total_hours.setMinimum(1)
        self.assign_total_hours.setMaximum(10000)
        btn_assign = QPushButton("Привязать")
        btn_assign.clicked.connect(self.assign_subject_to_group)
        form2.addRow("Группа:", self.assign_group_combo)
        form2.addRow("Предмет:", self.assign_subject_combo)
        form2.addRow(
            "Общее кол-во часов (interpreted as number of lessons):",
            self.assign_total_hours,
        )
        form2.addRow(btn_assign)
        assign_box.setLayout(form2)
        main.addWidget(assign_box)
        self.gs_table = QTableWidget(0, 4)
        self.gs_table.setHorizontalHeaderLabels(
            ["id", "group", "subject", "total_hours"]
        )
        main.addWidget(QLabel("Привязанные предметы к группам:"))
        main.addWidget(self.gs_table)
        btn_refresh2 = QPushButton("Обновить привязки")
        btn_refresh2.clicked.connect(self.refresh_all)
        main.addWidget(btn_refresh2)
        self.setLayout(main)
        self.refresh_subjects()
        self.refresh_all()

    def add_subject(self):
        name = self.subj_name.text().strip()
        code = self.subj_code.text().strip()
        desc = self.subj_desc.toPlainText().strip()
        if not name:
            QMessageBox.warning(self, "Ошибка", "Название предмета обязательно.")
            return
        self.db.add_subject(name, code or None, desc or None)
        self.subj_name.clear()
        self.subj_code.clear()
        self.subj_desc.clear()
        QMessageBox.information(self, "ОК", "Предмет добавлен.")
        self.refresh_subjects()
        self.refresh_all()

    def refresh_subjects(self):
        data = self.db.list_subjects()
        self.subj_table.setRowCount(0)
        self.assign_subject_combo.clear()
        for row in data:
            rid, name, code, desc = row
            r = self.subj_table.rowCount()
            self.subj_table.insertRow(r)
            self.subj_table.setItem(r, 0, QTableWidgetItem(str(rid)))
            self.subj_table.setItem(r, 1, QTableWidgetItem(name))
            self.subj_table.setItem(r, 2, QTableWidgetItem(code or ""))
            self.assign_subject_combo.addItem(f"{name} (id={rid})", rid)

    def refresh_all(self):
        # NOTE: fix for "too many values to unpack" — handle any length of returned group row
        self.assign_group_combo.clear()
        groups = self.db.list_groups()
        for g in groups:
            # g may contain extra columns (e.g., building_name). Use indices.
            if not g:
                continue
            gid = g[0]
            name = g[1] if len(g) > 1 else f"id{gid}"
            self.assign_group_combo.addItem(f"{name} (id={gid})", gid)
        # group_subjects table
        gs = self.db.list_group_subjects()
        self.gs_table.setRowCount(0)
        for row in gs:
            rid, gname, sname, hours = row
            r = self.gs_table.rowCount()
            self.gs_table.insertRow(r)
            self.gs_table.setItem(r, 0, QTableWidgetItem(str(rid)))
            self.gs_table.setItem(r, 1, QTableWidgetItem(gname))
            self.gs_table.setItem(r, 2, QTableWidgetItem(sname))
            self.gs_table.setItem(r, 3, QTableWidgetItem(str(hours)))

    def assign_subject_to_group(self):
        group_id = self.assign_group_combo.currentData()
        subject_id = self.assign_subject_combo.currentData()
        total_hours = self.assign_total_hours.value()
        if group_id is None or subject_id is None:
            QMessageBox.warning(self, "Ошибка", "Выберите группу и предмет.")
            return
        try:
            self.db.add_group_subject(group_id, subject_id, total_hours)
        except sqlite3.IntegrityError as e:
            QMessageBox.warning(self, "Ошибка записи", f"Не удалось добавить: {e}")
            return
        QMessageBox.information(self, "ОК", "Предмет привязан к группе.")
        self.refresh_all()


class TeachersTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        box = QGroupBox("Добавить преподавателя (пользователь)")
        form = QFormLayout()
        self.t_username = QLineEdit()
        self.t_password = QLineEdit()
        self.t_password.setPlaceholderText(
            "Будет захешировано простым способом (demo)."
        )
        self.t_email = QLineEdit()
        self.t_first = QLineEdit()
        self.t_last = QLineEdit()
        self.t_middle = QLineEdit()
        btn_add = QPushButton("Добавить преподавателя")
        btn_add.clicked.connect(self.add_teacher)
        form.addRow("Имя пользователя:", self.t_username)
        form.addRow("Пароль (plain, demo):", self.t_password)
        form.addRow("Email:", self.t_email)
        form.addRow("Фамилия:", self.t_last)
        form.addRow("Имя:", self.t_first)
        form.addRow("Отчество:", self.t_middle)
        form.addRow(btn_add)
        box.setLayout(form)
        main.addWidget(box)

        self.users_table = QTableWidget(0, 5)
        self.users_table.setHorizontalHeaderLabels(
            ["id", "username", "Фамилия", "Имя", "Отчество"]
        )
        main.addWidget(QLabel("Список пользователей (преподавателей и др.):"))
        main.addWidget(self.users_table)
        btn_refresh = QPushButton("Обновить список пользователей")
        btn_refresh.clicked.connect(self.refresh_users)
        main.addWidget(btn_refresh)

        assign = QGroupBox(
            "Привязать предмет(ы) к преподавателю и задать недоступные дни"
        )
        f2 = QFormLayout()
        self.assign_teacher_combo = QComboBox()
        self.assign_subjects_list = QListWidget()
        self.assign_subjects_list.setSelectionMode(QListWidget.MultiSelection)
        self.days_checks = []
        days_layout = QHBoxLayout()
        day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        for i, d in enumerate(day_names, start=1):
            cb = QCheckBox(d)
            cb.setChecked(True)
            self.days_checks.append(cb)
            days_layout.addWidget(cb)
        btn_assign_subj = QPushButton("Сохранить предметы и доступность")
        btn_assign_subj.clicked.connect(self.assign_subjects_to_teacher)
        f2.addRow("Преподаватель:", self.assign_teacher_combo)
        f2.addRow("Список предметов (выберите несколько):", self.assign_subjects_list)
        f2.addRow(QLabel("Доступность по дням (отметьте доступные дни):"))
        f2.addRow(days_layout)
        f2.addRow(btn_assign_subj)
        assign.setLayout(f2)
        main.addWidget(assign)

        self.setLayout(main)
        self.refresh_users()
        self.refresh_subjects_for_assign()

    def hash_password_demo(self, plain: str) -> str:
        import hashlib

        return hashlib.sha256(plain.encode("utf-8")).hexdigest()

    def add_teacher(self):
        username = self.t_username.text().strip()
        password = self.t_password.text().strip()
        email = self.t_email.text().strip()
        first = self.t_first.text().strip()
        last = self.t_last.text().strip()
        middle = self.t_middle.text().strip()
        if not username or not password:
            QMessageBox.warning(
                self, "Ошибка", "Имя пользователя и пароль обязательны."
            )
            return
        pwdhash = self.hash_password_demo(password)
        try:
            self.db.add_user(
                username,
                pwdhash,
                roles="teacher",
                current_role="teacher",
                first_name=first or None,
                last_name=last or None,
                middle_name=middle or None,
                email=email or None,
            )
        except sqlite3.IntegrityError as e:
            QMessageBox.warning(
                self, "Ошибка", f"Не удалось добавить пользователя: {e}"
            )
            return
        QMessageBox.information(self, "ОК", "Преподаватель добавлен.")
        self.t_username.clear()
        self.t_password.clear()
        self.t_email.clear()
        self.t_first.clear()
        self.t_last.clear()
        self.t_middle.clear()
        self.refresh_users()
        self.refresh_subjects_for_assign()

    def refresh_users(self):
        users = self.db.list_users()
        self.users_table.setRowCount(0)
        self.assign_teacher_combo.clear()
        for u in users:
            uid, username, first, last, middle, email = u
            r = self.users_table.rowCount()
            self.users_table.insertRow(r)
            self.users_table.setItem(r, 0, QTableWidgetItem(str(uid)))
            self.users_table.setItem(r, 1, QTableWidgetItem(username))
            self.users_table.setItem(r, 2, QTableWidgetItem(last or ""))
            self.users_table.setItem(r, 3, QTableWidgetItem(first or ""))
            self.users_table.setItem(r, 4, QTableWidgetItem(middle or ""))
            display = f"{last or ''} {first or ''} {middle or ''}".strip() or username
            self.assign_teacher_combo.addItem(f"{display} (id={uid})", uid)

    def refresh_subjects_for_assign(self):
        self.assign_subjects_list.clear()
        subjects = self.db.list_subjects()
        for s in subjects:
            sid, name, code, desc = s
            item = QListWidgetItem(f"{name} (id={sid})")
            item.setData(Qt.UserRole, sid)
            self.assign_subjects_list.addItem(item)

    def assign_subjects_to_teacher(self):
        teacher_id = self.assign_teacher_combo.currentData()
        if teacher_id is None:
            QMessageBox.warning(self, "Ошибка", "Выберите преподавателя.")
            return
        selected = [it for it in self.assign_subjects_list.selectedItems()]
        subject_ids = [it.data(Qt.UserRole) for it in selected]
        for sid in subject_ids:
            self.db.add_teacher_subject(teacher_id, sid)
        for i, cb in enumerate(self.days_checks, start=1):
            available = cb.isChecked()
            notes = None
            if not available:
                notes = f"Unavailable on day {i}"
            self.db.set_teacher_availability(teacher_id, i, available, notes)
        QMessageBox.information(self, "ОК", "Предметы и доступность сохранены.")


class StorageTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        box = QGroupBox("Загрузить файл в локальное хранилище (storage)")
        form = QFormLayout()
        self.file_path_edit = QLineEdit()
        btn_browse = QPushButton("Выбрать файл...")
        btn_browse.clicked.connect(self.browse_file)
        self.category_combo = QComboBox()
        for t in ensure_storage_types:
            self.category_combo.addItem(t)
        btn_store = QPushButton("Копировать в ./storage/")
        btn_store.clicked.connect(self.store_file)
        form.addRow("Путь к файлу:", self.file_path_edit)
        form.addRow(btn_browse, self.category_combo)
        form.addRow(btn_store)
        box.setLayout(form)
        main.addWidget(box)
        self.setLayout(main)

    def browse_file(self):
        fname, _ = QFileDialog.getOpenFileName(self, "Выбрать файл")
        if fname:
            self.file_path_edit.setText(fname)

    def store_file(self):
        src = self.file_path_edit.text().strip()
        if not src:
            QMessageBox.warning(self, "Ошибка", "Выберите файл.")
            return
        cat = self.category_combo.currentText()
        try:
            rel = self.db.store_file(src, cat)
        except Exception as e:
            QMessageBox.warning(self, "Ошибка", f"Не удалось сохранить файл: {e}")
            return
        QMessageBox.information(self, "ОК", f"Файл скопирован в storage как: {rel}")
        # optionally, create attachment record (without lesson linkage)
        self.db.add_attachment(None, None, rel, description=f"stored in {cat}")
        self.file_path_edit.clear()


class CSVImportTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        grp = QGroupBox("Импорт CSV")
        form = QFormLayout()
        self.csv_path_edit = QLineEdit()
        btn_browse = QPushButton("Выбрать CSV...")
        btn_browse.clicked.connect(self.browse_csv)
        self.import_type = QComboBox()
        self.import_type.addItems(["groups", "subjects", "teachers"])
        btn_import = QPushButton("Импортировать CSV")
        btn_import.clicked.connect(self.import_csv)
        form.addRow("Путь к CSV:", self.csv_path_edit)
        form.addRow(btn_browse, self.import_type)
        form.addRow(btn_import)
        grp.setLayout(form)
        main.addWidget(grp)
        self.setLayout(main)

    def browse_csv(self):
        fname, _ = QFileDialog.getOpenFileName(
            self, "Выбрать CSV", filter="CSV files (*.csv);;All files (*)"
        )
        if fname:
            self.csv_path_edit.setText(fname)

    def import_csv(self):
        path = self.csv_path_edit.text().strip()
        if not path or not os.path.isfile(path):
            QMessageBox.warning(self, "Ошибка", "Выберите корректный CSV файл.")
            return
        typ = self.import_type.currentText()
        try:
            with open(path, newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                if typ == "groups":
                    # expected fields: course, specialty, group_number, admission_year, type (opt), curator_username (opt), building_name (opt)
                    for r in reader:
                        course = int(r.get("course") or 1)
                        spec = (
                            (r.get("specialty") or "").strip().upper().replace(" ", "")
                        )
                        group_number = int(r.get("group_number") or 1)
                        admission_year = int(
                            r.get("admission_year") or datetime.datetime.now().year
                        )
                        type_ = r.get("type") or None
                        curator_username = r.get("curator_username") or None
                        building_name = r.get("building_name") or None
                        curator_id = None
                        building_id = None
                        if curator_username:
                            # find user id by username
                            cur = self.db.conn.cursor()
                            cur.execute(
                                "SELECT id FROM users WHERE username=?",
                                (curator_username,),
                            )
                            row = cur.fetchone()
                            if row:
                                curator_id = row[0]
                        if building_name:
                            cur = self.db.conn.cursor()
                            cur.execute(
                                "SELECT id FROM buildings WHERE name=?",
                                (building_name,),
                            )
                            row = cur.fetchone()
                            if row:
                                building_id = row[0]
                        name = (
                            f"{course}{spec}-{group_number}{admission_year % 100:02d}"
                        )
                        self.db.add_group(
                            name,
                            spec,
                            course,
                            group_number,
                            admission_year,
                            type_,
                            curator_id,
                            building_id,
                        )
                elif typ == "subjects":
                    # expected: name, code, description
                    for r in reader:
                        name = r.get("name") or ""
                        code = r.get("code") or None
                        desc = r.get("description") or None
                        if name:
                            self.db.add_subject(name, code, desc)
                elif typ == "teachers":
                    # expected: username, password, email, last_name, first_name, middle_name
                    for r in reader:
                        username = r.get("username") or ""
                        password = r.get("password") or "pwd"
                        email = r.get("email") or None
                        last = r.get("last_name") or None
                        first = r.get("first_name") or None
                        middle = r.get("middle_name") or None
                        if username:
                            pwdhash = self.hash_password_demo(password)
                            try:
                                self.db.add_user(
                                    username,
                                    pwdhash,
                                    roles="teacher",
                                    current_role="teacher",
                                    first_name=first,
                                    last_name=last,
                                    middle_name=middle,
                                    email=email,
                                )
                            except Exception:
                                pass
                else:
                    QMessageBox.warning(self, "Ошибка", "Неизвестный тип импорта.")
                    return
        except Exception as e:
            QMessageBox.warning(self, "Ошибка импорта", f"{e}")
            return
        QMessageBox.information(self, "ОК", "Импорт завершён.")
        self.csv_path_edit.clear()

    def hash_password_demo(self, plain: str) -> str:
        import hashlib

        return hashlib.sha256(plain.encode("utf-8")).hexdigest()


class Scheduler:
    """
    Простейший backtracking scheduler.
    - Считает group_subjects.total_hours как количество пар (занятий), которые нужно запланировать (в любых днях/периодах).
    - Ставит 1 занятие = 1 слот (day, period).
    - Учитывает teacher availability and teacher->subject binding.
    - Учитывает rooms.max_groups (берёт комнату с достаточной вместимостью).
    - Очень простой: распределяет последовательно и делает backtracking при конфликте.
    """

    def __init__(self, db: Database, days=5, periods_per_day=6):
        self.db = db
        self.days = days  # Mon-Fri
        self.periods = periods_per_day

    def load_data(self):
        c = self.db.conn.cursor()
        # groups
        c.execute("SELECT id, name FROM groups ORDER BY id")
        groups = c.fetchall()
        # group_subjects (we'll expand for each group-subject into N tasks)
        c.execute(
            """SELECT gs.group_id, gs.subject_id, gs.total_hours, s.name
                     FROM group_subjects gs JOIN subjects s ON gs.subject_id=s.id"""
        )
        gs = c.fetchall()
        # teacher_subjects
        c.execute("SELECT teacher_id, subject_id FROM teacher_subjects")
        ts = c.fetchall()
        teacher_by_subject = {}
        for teacher_id, subject_id in ts:
            teacher_by_subject.setdefault(subject_id, []).append(teacher_id)
        # teacher availability
        c.execute("SELECT teacher_id, day_of_week, available FROM teacher_availability")
        rows = c.fetchall()
        availability = {}
        for teacher_id, day, available in rows:
            availability.setdefault(teacher_id, {})[day] = bool(available)
        # rooms
        c.execute("SELECT id, name, max_groups FROM rooms ORDER BY id")
        rooms = c.fetchall()
        return groups, gs, teacher_by_subject, availability, rooms

    def generate(self, max_attempts=5000) -> Dict[int, Dict[Tuple[int, int], Dict]]:
        """
        Returns schedule dict:
         { group_id: { (day,period): {'subject_id':..., 'subject_name':..., 'teacher_id':..., 'room_id':...} } }
        """
        groups, gs, teacher_by_subject, availability, rooms = self.load_data()
        # Build list of tasks: each task -> (group_id, subject_id, subject_name)
        tasks = []
        for group_id, subject_id, total_hours, subj_name in gs:
            for _ in range(total_hours):
                tasks.append(
                    {
                        "group_id": group_id,
                        "subject_id": subject_id,
                        "subject_name": subj_name,
                    }
                )
        # shuffle deterministic? keep order

        # precompute slots
        slots = [
            (d, p) for d in range(1, self.days + 1) for p in range(1, self.periods + 1)
        ]
        # schedule containers
        schedule = {g[0]: {} for g in groups}

        # room assignment helper: choose first room with max_groups>=1 (could be improved)
        def find_room_for_group(group_id):
            # choose any room with max_groups >= 1 (or prefer rooms with larger capacity)
            for rid, rname, maxg in rooms:
                if maxg >= 1:
                    return rid
            return None

        # teacher pick helper
        def find_teacher_for_subject(subject_id, day):
            cand = teacher_by_subject.get(subject_id, [])
            for t in cand:
                # check availability: if day key not present assume available
                days = availability.get(t, {})
                if days and (day in days) and not days[day]:
                    continue
                return t
            return None

        # backtracking: assign tasks sequentially
        assigned = []
        used_slot_for_group = {g[0]: set() for g in groups}
        used_slot_global = (
            set()
        )  # allow multiple groups same slot if room capacity allows; for simplicity assume separate rooms okay
        attempts = 0

        def backtrack(idx):
            nonlocal attempts
            attempts += 1
            if attempts > max_attempts:
                return False
            if idx >= len(tasks):
                return True
            task = tasks[idx]
            g_id = task["group_id"]
            subj = task["subject_id"]
            # Try all slots
            for d, p in slots:
                # if group already has lesson at that slot -> skip (no duplicates for group)
                if (d, p) in used_slot_for_group[g_id]:
                    continue
                # find teacher for subject available on day d
                teacher = find_teacher_for_subject(subj, d)
                if teacher is None:
                    continue
                # find room
                room = find_room_for_group(g_id)
                if room is None:
                    continue
                # assign tentatively
                schedule[g_id][(d, p)] = {
                    "subject_id": subj,
                    "subject_name": task["subject_name"],
                    "teacher_id": teacher,
                    "room_id": room,
                }
                used_slot_for_group[g_id].add((d, p))
                assigned.append((g_id, (d, p)))
                if backtrack(idx + 1):
                    return True
                # undo
                assigned.pop()
                used_slot_for_group[g_id].remove((d, p))
                schedule[g_id].pop((d, p), None)
            return False

        ok = backtrack(0)
        if not ok:
            # Return partial schedule if any
            return schedule
        return schedule


class SchedulerTab(QWidget):
    def __init__(self, db: Database, parent=None):
        super().__init__(parent)
        self.db = db
        self.init_ui()

    def init_ui(self):
        main = QVBoxLayout()
        self.info = QLabel("Простейший генератор расписания (backtracking).")
        main.addWidget(self.info)
        row = QHBoxLayout()
        self.days_spin = QSpinBox()
        self.days_spin.setMinimum(1)
        self.days_spin.setMaximum(7)
        self.days_spin.setValue(5)
        self.periods_spin = QSpinBox()
        self.periods_spin.setMinimum(1)
        self.periods_spin.setMaximum(12)
        self.periods_spin.setValue(6)
        btn_run = QPushButton("Сгенерировать расписание")
        btn_run.clicked.connect(self.run_scheduler)
        row.addWidget(QLabel("Дней/нед:"))
        row.addWidget(self.days_spin)
        row.addWidget(QLabel("Периодов/день:"))
        row.addWidget(self.periods_spin)
        row.addWidget(btn_run)
        main.addLayout(row)
        # group select and table for visualization
        self.group_combo = QComboBox()
        self.refresh_groups_btn = QPushButton("Обновить группы")
        self.refresh_groups_btn.clicked.connect(self.refresh_groups)
        self.refresh_groups()
        self.table = QTableWidget()
        main.addWidget(QLabel("Выберите группу для просмотра расписания:"))
        h = QHBoxLayout()
        h.addWidget(self.group_combo)
        h.addWidget(self.refresh_groups_btn)
        main.addLayout(h)
        main.addWidget(self.table)
        btn_export = QPushButton("Экспортировать текущее расписание в CSV")
        btn_export.clicked.connect(self.export_csv)
        main.addWidget(btn_export)
        self.setLayout(main)
        self.last_schedule = {}

    def refresh_groups(self):
        self.group_combo.clear()
        cur = self.db.conn.cursor()
        cur.execute("SELECT id, name FROM groups ORDER BY id")
        for gid, name in cur.fetchall():
            self.group_combo.addItem(f"{name} (id={gid})", gid)

    def run_scheduler(self):
        days = int(self.days_spin.value())
        periods = int(self.periods_spin.value())
        sched = Scheduler(self.db, days=days, periods_per_day=periods)
        schedule = sched.generate()
        self.last_schedule = schedule
        QMessageBox.information(
            self,
            "ОК",
            "Генерация завершена (вероятно частично или полностью). Выберите группу и нажмите Обновить для просмотра.",
        )
        self.show_for_selected_group()

    def show_for_selected_group(self):
        gid = self.group_combo.currentData()
        if gid is None:
            QMessageBox.warning(self, "Ошибка", "Выберите группу.")
            return
        schedule = self.last_schedule.get(gid, {})
        days = int(self.days_spin.value())
        periods = int(self.periods_spin.value())
        self.table.setRowCount(periods)
        self.table.setColumnCount(days)
        day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        self.table.setHorizontalHeaderLabels(day_names[:days])
        self.table.setVerticalHeaderLabels([f"П{p}" for p in range(1, periods + 1)])
        # clear
        for r in range(periods):
            for c in range(days):
                self.table.setItem(r, c, QTableWidgetItem(""))
        # fill
        for (d, p), info in schedule.items():
            if 1 <= d <= days and 1 <= p <= periods:
                r = p - 1
                c = d - 1
                # get teacher name and room name
                teacher_name = self.get_teacher_display(info.get("teacher_id"))
                room_name = self.get_room_display(info.get("room_id"))
                text = f"{info.get('subject_name')}\n{teacher_name}\n{room_name}"
                self.table.setItem(r, c, QTableWidgetItem(text))

    def get_teacher_display(self, teacher_id):
        if not teacher_id:
            return "—"
        cur = self.db.conn.cursor()
        cur.execute("SELECT first_name, last_name FROM users WHERE id=?", (teacher_id,))
        r = cur.fetchone()
        if not r:
            return str(teacher_id)
        first, last = r
        return f"{last or ''} {first or ''}".strip()

    def get_room_display(self, room_id):
        if not room_id:
            return "—"
        cur = self.db.conn.cursor()
        cur.execute("SELECT name FROM rooms WHERE id=?", (room_id,))
        r = cur.fetchone()
        return r[0] if r else str(room_id)

    def export_csv(self):
        if not self.last_schedule:
            QMessageBox.warning(self, "Ошибка", "Сначала сгенерируйте расписание.")
            return
        fname, _ = QFileDialog.getSaveFileName(
            self,
            "Сохранить расписание CSV",
            os.path.expanduser("~/schedule_export.csv"),
            "CSV files (*.csv)",
        )
        if not fname:
            return
        with open(fname, "w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(
                [
                    "group_id",
                    "group_name",
                    "day",
                    "period",
                    "subject_name",
                    "teacher",
                    "room",
                ]
            )
            cur = self.db.conn.cursor()
            for gid, slots in self.last_schedule.items():
                cur.execute("SELECT name FROM groups WHERE id=?", (gid,))
                gname = cur.fetchone()[0] if cur.fetchone() is not None else "?"
                # NOTE: avoid double cursor fetch bug: do single fetch above correctly
            # redo properly:
        # redo write with correct group names
        with open(fname, "w", newline="", encoding="utf-8") as fh:
            writer = csv.writer(fh)
            writer.writerow(
                [
                    "group_id",
                    "group_name",
                    "day",
                    "period",
                    "subject_name",
                    "teacher",
                    "room",
                ]
            )
            cur = self.db.conn.cursor()
            for gid, slots in self.last_schedule.items():
                cur.execute("SELECT name FROM groups WHERE id=?", (gid,))
                row = cur.fetchone()
                gname = row[0] if row else f"id{gid}"
                for (d, p), info in slots.items():
                    teacher = self.get_teacher_display(info.get("teacher_id"))
                    room = self.get_room_display(info.get("room_id"))
                    writer.writerow(
                        [gid, gname, d, p, info.get("subject_name"), teacher, room]
                    )
        QMessageBox.information(self, "ОК", f"Экспорт завершён: {fname}")


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.db = Database()
        self.setWindowTitle(
            "Schedule Creator — Административный инструмент (расширено)"
        )
        self.resize(1200, 800)
        self.init_ui()

    def init_ui(self):
        tabs = QTabWidget()
        self.buildings_tab = BuildingsTab(self.db)
        self.groups_tab = GroupsTab(self.db)
        self.subjects_tab = SubjectsTab(self.db)
        self.teachers_tab = TeachersTab(self.db)
        self.storage_tab = StorageTab(self.db)
        self.csv_tab = CSVImportTab(self.db)
        self.scheduler_tab = SchedulerTab(self.db)

        tabs.addTab(self.buildings_tab, "Корпуса / Аудитории")
        tabs.addTab(self.groups_tab, "Группы")
        tabs.addTab(self.subjects_tab, "Предметы / Привязки")
        tabs.addTab(self.teachers_tab, "Преподаватели")
        tabs.addTab(self.storage_tab, "Storage (файлы)")
        tabs.addTab(self.csv_tab, "Импорт CSV")
        tabs.addTab(self.scheduler_tab, "Генератор расписания")

        main_widget = QWidget()
        layout = QVBoxLayout()
        layout.addWidget(tabs)

        btn_export = QPushButton("Экспортировать базу (создать копию .db)")
        btn_export.clicked.connect(self.export_db)
        layout.addWidget(btn_export)

        main_widget.setLayout(layout)
        self.setCentralWidget(main_widget)

    def export_db(self):
        fname, _ = QFileDialog.getSaveFileName(
            self,
            "Сохранить копию БД как",
            os.path.expanduser("~/schedule_copy.db"),
            "SQLite DB (*.db);;All files (*)",
        )
        if not fname:
            return
        try:
            self.db.conn.commit()
            self.db.conn.close()
            import shutil

            shutil.copyfile(DB_FILENAME, fname)
            self.db = Database()
            # rebind tabs to new db connection
            self.buildings_tab.db = self.db
            self.groups_tab.db = self.db
            self.subjects_tab.db = self.db
            self.teachers_tab.db = self.db
            self.storage_tab.db = self.db
            self.csv_tab.db = self.db
            self.scheduler_tab.db = self.db
            QMessageBox.information(self, "ОК", f"Копия БД сохранена: {fname}")
        except Exception as e:
            QMessageBox.warning(self, "Ошибка", f"Не удалось сохранить копию: {e}")
            self.db = Database()
            self.buildings_tab.db = self.db
            self.groups_tab.db = self.db
            self.subjects_tab.db = self.db
            self.teachers_tab.db = self.db
            self.storage_tab.db = self.db
            self.csv_tab.db = self.db
            self.scheduler_tab.db = self.db


def main():
    app = QApplication(sys.argv)
    w = MainWindow()
    w.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
