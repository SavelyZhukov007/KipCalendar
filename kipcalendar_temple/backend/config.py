import os
from datetime import timedelta


class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql://kipcalendar:kipcalendar123@localhost:5432/kipcalendar_db",
        # Для разработки можно использовать: 'sqlite:///kipcalendar.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Security
    SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_change_me_in_production")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt_secret_key_change_me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    # Mail settings
    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "savely.zhukov.1583@gmail.com")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "meqx mjtp zgxi padk")
    MAIL_DEFAULT_SENDER = os.getenv(
        "MAIL_DEFAULT_SENDER", "savely.zhukov.1583@gmail.com"
    )
    # SocketIO
    SOCKETIO_MESSAGE_QUEUE = os.getenv(
        "SOCKETIO_MESSAGE_QUEUE", None
    )  # Redis URL for production
    SOCKETIO_CORS_ALLOWED_ORIGINS = os.getenv("SOCKETIO_CORS_ALLOWED_ORIGINS", "*")
    # File uploads
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB max file size
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    # Session
    SESSION_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Rate limiting
    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URL = os.getenv("REDIS_URL", "memory://")


class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    # Override with production settings
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
