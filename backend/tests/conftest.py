"""
Test configuration. Uses an in-memory SQLite database instead of PostgreSQL so
the suite runs anywhere with no external services — production deployments
still use PostgreSQL (see app/database.py / docker-compose.yml).
"""
import sys
import os
import tempfile
import shutil
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import get_settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import RedFlagRule, RedFlagRuleVersion  # noqa: E402
from app.seed import DEFAULT_RULES  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def isolate_upload_dir(monkeypatch):
    """Ensure test file uploads go to an isolated temporary directory and are cleaned up."""
    test_upload_dir = tempfile.mkdtemp(prefix="medikiosk_test_uploads_")
    settings = get_settings()
    monkeypatch.setattr(settings, "UPLOAD_DIR", test_upload_dir)
    yield test_upload_dir
    shutil.rmtree(test_upload_dir, ignore_errors=True)


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    for rule_data in DEFAULT_RULES:
        session.add(RedFlagRule(**rule_data))
        session.flush()
        session.add(RedFlagRuleVersion(rule_id=rule_data["rule_id"], version=rule_data["version"],
                                        conditions_snapshot=rule_data["conditions"]))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
