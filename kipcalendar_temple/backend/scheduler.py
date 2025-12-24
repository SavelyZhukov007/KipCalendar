# scheduler.py
# Модуль генератора расписания (separate module)
# Версия: 1.0
# Простейший backtracking scheduler с валидатором и логированием причин отказа.

import datetime
import sqlite3
from typing import Dict, List, Tuple, Any, Optional


class GenerationLogEntry:
    def __init__(self, level: str, message: str, details: Optional[str] = None):
        self.timestamp = int(datetime.datetime.utcnow().timestamp())
        self.level = level  # INFO, WARN, ERROR
        self.message = message
        self.details = details


class Scheduler:
    def __init__(self, db_path_or_conn, days: int = 5, periods_per_day: int = 6):
        """
        db_path_or_conn: sqlite3.Connection or path string
        days: number of days per week to consider (1..7)
        periods_per_day: number of periods per day
        """
        if isinstance(db_path_or_conn, sqlite3.Connection):
            self.conn = db_path_or_conn
            self._own_conn = False
        else:
            self.conn = sqlite3.connect(db_path_or_conn)
            self._own_conn = True
        self.days = max(1, min(7, days))
        self.periods = max(1, periods_per_day)
        self.logs: List[GenerationLogEntry] = []

    def _log(self, level: str, message: str, details: Optional[str] = None):
        entry = GenerationLogEntry(level, message, details)
        self.logs.append(entry)
        # also persist to DB table schedule_generation_logs if exists
        try:
            cur = self.conn.cursor()
            cur.execute(
                "INSERT INTO schedule_generation_logs (timestamp, level, message, details) VALUES (?, ?, ?, ?)",
                (entry.timestamp, level, message, details),
            )
            self.conn.commit()
        except Exception:
            # do not raise from logger
            pass

    def ensure_log_table(self):
        cur = self.conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_generation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT
            );
            """
        )
        self.conn.commit()

    def validate_before_generation(self) -> Tuple[bool, List[str], List[str]]:
        """
        Выполняет жёсткую валидацию перед генерацией.
        Возвращает (ok: bool, errors: list[str], warnings: list[str]).
        """
        errors = []
        warnings = []

        cur = self.conn.cursor()
        # groups
        cur.execute("SELECT COUNT(*) FROM groups")
        if cur.fetchone()[0] == 0:
            errors.append("Нет групп в базе (table groups).")

        # subjects
        cur.execute("SELECT COUNT(*) FROM subjects")
        if cur.fetchone()[0] == 0:
            errors.append("Нет предметов (table subjects).")

        # group_subjects
        cur.execute("SELECT COUNT(*) FROM group_subjects")
        if cur.fetchone()[0] == 0:
            errors.append("Нет связей предметов с группами (table group_subjects).")

        # rooms
        cur.execute("SELECT COUNT(*) FROM rooms")
        if cur.fetchone()[0] == 0:
            warnings.append(
                "Нет аудиторий (rooms). Генератор попытается назначать без учёта вместимости."
            )

        # users - teachers
        cur.execute(
            "SELECT COUNT(*) FROM users WHERE roles LIKE '%teacher%' OR roles LIKE '%lecturer%'"
        )
        if cur.fetchone()[0] == 0:
            warnings.append(
                "Нет пользователей с ролью преподавателя (users.roles содержит 'teacher'). Будет использован fallback, если включён, иначе генерация может не назначать преподавателей."
            )

        # teacher_subjects
        cur.execute("SELECT COUNT(*) FROM teacher_subjects")
        if cur.fetchone()[0] == 0:
            warnings.append(
                "Нет привязок преподавателей к предметам (teacher_subjects). Без них задания могут остаться без преподавателя."
            )

        ok = len(errors) == 0
        # log validation results
        if errors:
            for e in errors:
                self._log("ERROR", "Validation error", e)
        if warnings:
            for w in warnings:
                self._log("WARN", "Validation warning", w)
        return ok, errors, warnings

    def _load_data(self):
        cur = self.conn.cursor()
        # groups
        cur.execute("SELECT id, name FROM groups ORDER BY id")
        groups = cur.fetchall()  # list of tuples (id, name)
        # group_subjects: group_id, subject_id, total_hours
        cur.execute(
            "SELECT gs.group_id, gs.subject_id, gs.total_hours, s.name FROM group_subjects gs JOIN subjects s ON gs.subject_id = s.id"
        )
        group_subjects = cur.fetchall()
        # teacher_subjects
        cur.execute("SELECT teacher_id, subject_id FROM teacher_subjects")
        ts = cur.fetchall()
        teacher_by_subject = {}
        for teacher_id, subject_id in ts:
            teacher_by_subject.setdefault(subject_id, []).append(teacher_id)
        # teacher_availability
        cur.execute(
            "SELECT teacher_id, day_of_week, available FROM teacher_availability"
        )
        av_rows = cur.fetchall()
        availability = {}
        for teacher_id, day_of_week, available in av_rows:
            availability.setdefault(teacher_id, {})[day_of_week] = bool(available)
        # rooms
        cur.execute("SELECT id, name, max_groups FROM rooms ORDER BY id")
        rooms = cur.fetchall()
        # schedule_templates (to honor week_type/day_of_week constraints)
        cur.execute("SELECT group_id, week_type, day_of_week FROM schedule_templates")
        templates = cur.fetchall()  # (group_id, week_type, day_of_week)
        templates_by_group = {}
        for gid, week_type, dow in templates:
            templates_by_group.setdefault(gid, []).append((week_type, dow))
        return {
            "groups": groups,
            "group_subjects": group_subjects,
            "teacher_by_subject": teacher_by_subject,
            "availability": availability,
            "rooms": rooms,
            "templates_by_group": templates_by_group,
        }

    def _allowed_slot_by_template(
        self, group_id: int, day: int, week_type: str, templates_by_group
    ) -> bool:
        """
        Если для группы есть записи в schedule_templates — позволяем только те day/week_type,
        которые присутствуют. Если для группы нет записей в templates — слот считается разрешённым.
        """
        tlist = templates_by_group.get(group_id)
        if not tlist:
            return True
        # If any template entry matches (week_type or 'both') and day matches, allow.
        for wtype, dow in tlist:
            if dow == day:
                # wtype stored as 'even' or 'odd' — we treat templates strictly
                if wtype == week_type or week_type == "both":
                    return True
        return False

    def generate(
        self,
        week_type: str = "both",
        allow_teacher_fallback: bool = False,
        max_attempts: int = 20000,
    ) -> Dict[int, Dict[Tuple[int, int], Dict[str, Any]]]:
        """
        Запустить генерацию расписания.

        week_type: 'even' | 'odd' | 'both' — если задано 'even' или 'odd', генератор будет учитывать schedule_templates (если они есть).
        allow_teacher_fallback: если True, при отсутствии teacher_subjects для предмета возьмёт любого учителя.
        Возвращает словарь: { group_id: { (day, period): {subject_id, subject_name, teacher_id, room_id, week_type} } }
        Также записывает логи в self.logs и в таблицу schedule_generation_logs.
        """
        self.ensure_log_table()
        self.logs.clear()
        ok, errors, warnings = self.validate_before_generation()
        if not ok:
            self._log(
                "ERROR",
                "Validation failed, aborting generation",
                details="; ".join(errors),
            )
            return {}

        data = self._load_data()
        groups = data["groups"]
        group_subjects = data["group_subjects"]
        teacher_by_subject = data["teacher_by_subject"]
        availability = data["availability"]
        rooms = data["rooms"]
        templates_by_group = data["templates_by_group"]

        # Build tasks list: each group_subject becomes total_hours independent tasks
        tasks = []
        for g_id, s_id, total_hours, s_name in group_subjects:
            for i in range(total_hours):
                tasks.append(
                    {"group_id": g_id, "subject_id": s_id, "subject_name": s_name}
                )

        # Precompute slots and schedule structures
        slots = [
            (d, p) for d in range(1, self.days + 1) for p in range(1, self.periods + 1)
        ]
        schedule = {g[0]: {} for g in groups}
        used_slots_for_group = {g[0]: set() for g in groups}

        # Helper: find room for group (choose first sufficient)
        def find_room_for_group(group_id: int) -> Optional[int]:
            if not rooms:
                return None
            # naive: choose first room
            return rooms[0][0]  # id

        # Helper: choose teacher for subject on day
        def find_teacher_for_subject(subject_id: int, day: int) -> Optional[int]:
            candidates = list(teacher_by_subject.get(subject_id, []))
            if not candidates:
                if allow_teacher_fallback:
                    # fallback to any teacher
                    cur = self.conn.cursor()
                    cur.execute(
                        "SELECT id FROM users WHERE roles LIKE '%teacher%' LIMIT 1"
                    )
                    row = cur.fetchone()
                    if row:
                        self._log(
                            "WARN",
                            f"Fallback teacher used for subject {subject_id}",
                            details=f"Teacher id {row[0]}",
                        )
                        return row[0]
                    else:
                        self._log(
                            "ERROR",
                            f"No teacher at all found to fallback for subject {subject_id}",
                        )
                        return None
                else:
                    self._log(
                        "WARN", f"No teacher associated with subject {subject_id}"
                    )
                    return None
            # prefer candidate who is available that day (or not specified => available)
            for t in candidates:
                day_map = availability.get(t)
                if day_map:
                    if day_map.get(day, True):
                        return t
                else:
                    return t
            # if none available (explicitly unavailable), return None
            self._log(
                "WARN",
                f"No teacher available on day {day} for subject {subject_id}",
                details=f"Candidates: {candidates}",
            )
            return None

        # Backtracking attempt counter
        attempts = 0
        max_attempts_local = max_attempts

        # Simple ordering: tasks sorted by group to reduce conflicts
        tasks.sort(key=lambda x: (x["group_id"], x["subject_id"]))

        def backtrack(idx: int) -> bool:
            nonlocal attempts
            attempts += 1
            if attempts > max_attempts_local:
                self._log(
                    "ERROR",
                    "Max attempts reached in backtracking",
                    details=f"attempts={attempts}",
                )
                return False
            if idx >= len(tasks):
                return True
            task = tasks[idx]
            gid = task["group_id"]
            sid = task["subject_id"]
            sname = task["subject_name"]

            # attempt all slots in deterministic order
            for d, p in slots:
                # respect templates if present for this group
                if not self._allowed_slot_by_template(
                    gid, d, week_type, templates_by_group
                ):
                    continue
                if (d, p) in used_slots_for_group[gid]:
                    continue
                teacher = find_teacher_for_subject(sid, d)
                if teacher is None:
                    # can't schedule this task in any slot where no teacher — but maybe other slots have teacher
                    # we continue to try other slots
                    continue
                room = find_room_for_group(gid)
                # assign tentatively
                schedule[gid][(d, p)] = {
                    "subject_id": sid,
                    "subject_name": sname,
                    "teacher_id": teacher,
                    "room_id": room,
                    "week_type": week_type,
                }
                used_slots_for_group[gid].add((d, p))
                if backtrack(idx + 1):
                    return True
                # undo
                used_slots_for_group[gid].remove((d, p))
                schedule[gid].pop((d, p), None)
            # if no slot found for this task, log and backtrack fail
            self._log(
                "WARN",
                f"Unable to place task for group {gid} subject {sid}",
                details=f"task_idx={idx}, subject_name={sname}",
            )
            return False

        ok = backtrack(0)
        if not ok:
            self._log(
                "WARN",
                "Generation finished but not all tasks were placed",
                details=f"attempts={attempts}",
            )
        else:
            self._log(
                "INFO",
                "Generation finished successfully",
                details=f"attempts={attempts}",
            )
        return schedule

    def close(self):
        if self._own_conn:
            self.conn.close()
