import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseModel):
    PROJECT_NAME: str = "IsıSens — Profesyonel Sistem Yönetim Paneli API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "isisens")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "isisens_secure_pass")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "127.0.0.1")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "isisens_db")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"postgresql+psycopg2://{os.getenv('POSTGRES_USER', 'isisens')}:{os.getenv('POSTGRES_PASSWORD', 'isisens_secure_pass')}@{os.getenv('POSTGRES_HOST', '127.0.0.1')}:{os.getenv('POSTGRES_PORT', '5432')}/{os.getenv('POSTGRES_DB', 'isisens_db')}",
    )
    FALLBACK_SQLITE_URL: str = os.getenv(
        "FALLBACK_SQLITE_URL",
        f"sqlite:///{os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'isisens_platform.db'))}",
    )

    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "isisens-konya-iot-jwt-secret-key-2026-change-in-prod"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    COLLECTOR_API_KEY: str = os.getenv(
        "COLLECTOR_API_KEY", "isisens-collector-rf-key-2026"
    )
    KEY_VAULT_SECRET: str = os.getenv(
        "KEY_VAULT_SECRET", "isisens-aes-key-vault-master-2026"
    )


settings = Settings()

