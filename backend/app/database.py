import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import get_settings

settings = get_settings()

DEFAULT_SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "medikiosk.db"))
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.replace(os.sep, '/')}"

db_url = settings.DATABASE_URL or DEFAULT_SQLITE_URL

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

# In local dev or if postgres is unreachable/driver missing, smoothly use SQLite
if not db_url.startswith("sqlite"):
    try:
        temp_engine = create_engine(db_url, connect_args=connect_args)
        with temp_engine.connect() as conn:
            pass
        engine = temp_engine
    except Exception:
        logging.warning("Database at %s is unreachable, falling back to SQLite: %s", db_url, DEFAULT_SQLITE_PATH)
        db_url = DEFAULT_SQLITE_URL
        engine = create_engine(DEFAULT_SQLITE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(db_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _ensure_sqlite_columns():
    """Safely adds missing columns to existing local SQLite database without data loss."""
    if db_url.startswith("sqlite"):
        try:
            import sqlite3
            db_path = db_url.replace("sqlite:///", "")
            if os.path.isfile(db_path):
                conn = sqlite3.connect(db_path)
                c = conn.cursor()
                c.execute("PRAGMA table_info(patients)")
                p_cols = [r[1] for r in c.fetchall()]
                if p_cols and "phone_hash" not in p_cols:
                    c.execute("ALTER TABLE patients ADD COLUMN phone_hash VARCHAR")
                c.execute("PRAGMA table_info(documents)")
                d_cols = [r[1] for r in c.fetchall()]
                if d_cols and "sha256_hash" not in d_cols:
                    c.execute("ALTER TABLE documents ADD COLUMN sha256_hash VARCHAR")
                conn.commit()
                conn.close()
        except Exception:
            pass

_ensure_sqlite_columns()


def get_db():
    """FastAPI dependency: yields a scoped DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
