import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import get_settings

settings = get_settings()

DEFAULT_SQLITE_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "medikiosk.db"))
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.replace(os.sep, '/')}"

db_url = settings.DATABASE_URL or DEFAULT_SQLITE_URL

# In local dev or if postgres driver isn't installed, smoothly use SQLite
if not db_url.startswith("sqlite"):
    try:
        import psycopg2  # noqa: F401
    except ImportError:
        db_url = DEFAULT_SQLITE_URL

connect_args = {}
engine_kwargs = {}

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    engine_kwargs["pool_pre_ping"] = True

try:
    engine = create_engine(db_url, connect_args=connect_args, **engine_kwargs)
except Exception:
    engine = create_engine(DEFAULT_SQLITE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a scoped DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
