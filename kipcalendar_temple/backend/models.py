from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime

db = SQLAlchemy()


# Helper function for UUID generation
def generate_uuid():
    return str(uuid.uuid4())


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    email_verified = db.Column(db.Boolean, default=False)
    verification_code = db.Column(db.String(10))
    verification_expires = db.Column(db.Integer)
    roles = db.Column(db.Text, nullable=False)  # JSON string
    current_role = db.Column(db.String(50), nullable=False)
    logout_timestamp = db.Column(db.Integer)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    middle_name = db.Column(db.String(100))
    telegram_id = db.Column(db.String(50), unique=True)
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class Organization(db.Model):
    __tablename__ = "organizations"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(255), nullable=False)
    short_name = db.Column(db.String(100))
    type = db.Column(db.String(50), nullable=False, default="education")
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"))


class OrganizationMember(db.Model):
    __tablename__ = "organization_members"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    organization_id = db.Column(
        db.String(36), db.ForeignKey("organizations.id"), nullable=False
    )
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    roles = db.Column(db.Text, nullable=False)  # JSON
    current_role = db.Column(db.String(50), nullable=False)
    joined_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
    profile_data = db.Column(db.Text)  # JSON

    __table_args__ = (db.UniqueConstraint("organization_id", "user_id"),)


class Invitation(db.Model):
    __tablename__ = "invitations"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    organization_id = db.Column(
        db.String(36), db.ForeignKey("organizations.id"), nullable=False
    )
    role = db.Column(db.String(50), nullable=False)
    token = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
    expires_at = db.Column(db.Integer, nullable=False)
    max_uses = db.Column(db.Integer, default=-1)
    uses = db.Column(db.Integer, default=0)


class Building(db.Model):
    __tablename__ = "buildings"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    organization_id = db.Column(
        db.String(36), db.ForeignKey("organizations.id"), nullable=False
    )
    name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.Text)


class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    building_id = db.Column(
        db.String(36), db.ForeignKey("buildings.id"), nullable=False
    )
    name = db.Column(db.String(100), nullable=False)
    max_groups = db.Column(db.Integer, default=1)


class Group(db.Model):
    __tablename__ = "groups"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    organization_id = db.Column(
        db.String(36), db.ForeignKey("organizations.id"), nullable=False
    )
    name = db.Column(db.String(255), nullable=False)
    specialty = db.Column(db.String(255))
    course = db.Column(db.Integer)
    group_number = db.Column(db.Integer)
    admission_year = db.Column(db.Integer)
    type = db.Column(db.String(50))
    curator_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    building_id = db.Column(db.String(36), db.ForeignKey("buildings.id"))


class UserGroup(db.Model):
    __tablename__ = "user_groups"

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    group_id = db.Column(db.String(36), db.ForeignKey("groups.id"), primary_key=True)


class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    organization_id = db.Column(
        db.String(36), db.ForeignKey("organizations.id"), nullable=False
    )
    name = db.Column(db.String(255), nullable=False)
    code = db.Column(db.String(50))
    description = db.Column(db.Text)


class GroupSubject(db.Model):
    __tablename__ = "group_subjects"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    group_id = db.Column(db.String(36), db.ForeignKey("groups.id"), nullable=False)
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey("users.id"))
    total_hours = db.Column(db.Integer, nullable=False)

    __table_args__ = (db.UniqueConstraint("group_id", "subject_id"),)


class Lesson(db.Model):
    __tablename__ = "lessons"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    group_id = db.Column(db.String(36), db.ForeignKey("groups.id"), nullable=False)
    subject_id = db.Column(db.String(36), db.ForeignKey("subjects.id"), nullable=False)
    teacher_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.String(36), db.ForeignKey("rooms.id"))
    day_of_week = db.Column(db.Integer, nullable=False)  # 0-6
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    lesson_type = db.Column(db.String(50))  # lecture, practice, lab


class ActualLesson(db.Model):
    __tablename__ = "actual_lessons"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    lesson_id = db.Column(db.String(36), db.ForeignKey("lessons.id"), nullable=False)
    date = db.Column(db.Date, nullable=False)
    topic = db.Column(db.Text)
    homework = db.Column(db.Text)
    notes = db.Column(db.Text)


class Mark(db.Model):
    __tablename__ = "marks"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    actual_lesson_id = db.Column(
        db.String(36), db.ForeignKey("actual_lessons.id"), nullable=False
    )
    student_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    value = db.Column(db.String(10))  # 5, 4, A, B, etc.
    comment = db.Column(db.Text)
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class Attendance(db.Model):
    __tablename__ = "attendance"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    actual_lesson_id = db.Column(
        db.String(36), db.ForeignKey("actual_lessons.id"), nullable=False
    )
    student_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # present, absent, late
    note = db.Column(db.Text)


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"))
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.Time, nullable=False)
    end_date = db.Column(db.Date)
    end_time = db.Column(db.Time)
    event_type = db.Column(db.String(50), nullable=False)  # plan, task, lesson
    content = db.Column(db.Text)  # markdown for plans
    subtasks = db.Column(db.Text)  # JSON for tasks
    recurring_options = db.Column(db.Text)  # JSON
    shared_with = db.Column(db.Text)  # JSON array of user_ids
    forbid_edit = db.Column(db.Boolean, default=False)
    allow_comments = db.Column(db.Boolean, default=False)
    password_hash = db.Column(db.String(255))
    version = db.Column(db.Integer, default=0)
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class EventHistory(db.Model):
    __tablename__ = "event_history"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    field_changed = db.Column(db.String(100))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    timestamp = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class EventComment(db.Model):
    __tablename__ = "event_comments"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    event_id = db.Column(db.String(36), db.ForeignKey("events.id"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class Chat(db.Model):
    __tablename__ = "chats"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    type = db.Column(db.String(20), nullable=False)  # private, group
    participants = db.Column(db.Text, nullable=False)  # JSON array
    name = db.Column(db.String(255))
    organization_id = db.Column(db.String(36), db.ForeignKey("organizations.id"))
    created_at = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    chat_id = db.Column(db.String(36), db.ForeignKey("chats.id"), nullable=False)
    sender_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
    edited = db.Column(db.Boolean, default=False)
    reply_to = db.Column(db.String(36), db.ForeignKey("messages.id"))
    file_url = db.Column(db.Text)
    file_type = db.Column(db.String(50))


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(50), nullable=False)  # grade, homework, event, message
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
    is_read = db.Column(db.Boolean, default=False)
    sent_to_telegram = db.Column(db.Boolean, default=False)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text)  # JSON
    timestamp = db.Column(db.Integer, default=lambda: int(datetime.now().timestamp()))
