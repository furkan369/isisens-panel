import socket
import logging
from urllib.parse import urlparse
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

logger = logging.getLogger("isisens.db")


class Base(DeclarativeBase):
    pass


def _resolve_database_url() -> tuple[str, str]:
    """
    Prefers PostgreSQL (`DATABASE_URL`).
    If the local PostgreSQL server is not reachable on TCP in dev mode,
    seamlessly falls back to SQLAlchemy SQLite (`FALLBACK_SQLITE_URL`)
    so the platform runs out-of-the-box and switches to PostgreSQL automatically
    when PostgreSQL or Docker Compose is running.
    """
    url = settings.DATABASE_URL
    if url.startswith("postgresql"):
        parsed = urlparse(url)
        host = parsed.hostname or settings.POSTGRES_HOST
        port = parsed.port or settings.POSTGRES_PORT
        try:
            with socket.create_connection((host, port), timeout=0.6):
                logger.info("Connected to PostgreSQL at %s:%s", host, port)
                return url, "postgresql"
        except OSError:
            logger.warning(
                "PostgreSQL at %s:%s is not currently running; using SQLAlchemy local engine (%s).",
                host,
                port,
                settings.FALLBACK_SQLITE_URL,
            )
            return settings.FALLBACK_SQLITE_URL, "sqlite_pg_compat"
    return url, "sqlite" if url.startswith("sqlite") else "postgresql"


ACTIVE_DATABASE_URL, ACTIVE_DB_ENGINE_KIND = _resolve_database_url()

if ACTIVE_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        ACTIVE_DATABASE_URL,
        connect_args={"check_same_thread": False, "timeout": 30},
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.execute("PRAGMA temp_store=MEMORY;")
        cursor.execute("PRAGMA cache_size=-64000;")
        cursor.close()
else:
    engine = create_engine(
        ACTIVE_DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

