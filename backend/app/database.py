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


def init_db(target_engine=None):
    """
    Initializes database schema, verifies column integrity, drops obsolete tables,
    and ensures transparent encryption on legacy records.
    Called cleanly during application lifespan startup.
    """
    bind_engine = target_engine or engine
    Base.metadata.create_all(bind=bind_engine)

    if str(bind_engine.url).startswith("sqlite"):
        try:
            with bind_engine.connect() as conn:
                # 1. Clean up obsolete unused tables
                for tbl in ("ai_evaluations", "ai_provenance", "allergies",
                            "clinical_concepts", "lab_results", "medications"):
                    conn.exec_driver_sql(f"DROP TABLE IF EXISTS {tbl}")

                # 2. Ensure schema columns exist
                p_cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(patients)").fetchall()]
                if p_cols and "phone_hash" not in p_cols:
                    conn.exec_driver_sql("ALTER TABLE patients ADD COLUMN phone_hash VARCHAR")

                d_cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(documents)").fetchall()]
                if d_cols and "sha256_hash" not in d_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN sha256_hash VARCHAR")
                if d_cols and "extracted_data" not in d_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN extracted_data JSON")
                if d_cols and "pages" not in d_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN pages JSON")
                if d_cols and "patient_id" not in d_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN patient_id VARCHAR")

                tr_cols = [r[1] for r in conn.exec_driver_sql("PRAGMA table_info(treatment_records)").fetchall()]
                if tr_cols and "prescribed_medicines" not in tr_cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN prescribed_medicines JSON")
                if tr_cols and "doctor_notes" not in tr_cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN doctor_notes TEXT")
                if tr_cols and "doctor_name" not in tr_cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN doctor_name VARCHAR")

                conn.commit()

            # 3. Encrypt existing plain-text patient & user fields if needed
            from .services.crypto import encrypt_field, encrypt_deterministic
            with bind_engine.connect() as conn:
                p_rows = conn.exec_driver_sql("SELECT id, patient_id, age FROM patients").fetchall()
                for pid, pat_id, age in p_rows:
                    updates = []
                    params = {}
                    if pat_id and not str(pat_id).startswith("enc:aes256gcm:"):
                        updates.append("patient_id = :pat_id")
                        params["pat_id"] = encrypt_deterministic(str(pat_id))
                    if age is not None and not str(age).startswith("enc:aes256gcm:"):
                        updates.append("age = :age")
                        params["age"] = encrypt_field(str(age))
                    if updates:
                        params["pid"] = pid
                        conn.exec_driver_sql(f"UPDATE patients SET {', '.join(updates)} WHERE id = :pid", params)

                u_rows = conn.exec_driver_sql("SELECT id, username, full_name FROM users").fetchall()
                for uid, uname, fname in u_rows:
                    updates = []
                    params = {}
                    if uname and not str(uname).startswith("enc:aes256gcm:"):
                        updates.append("username = :uname")
                        params["uname"] = encrypt_deterministic(str(uname))
                    if fname and not str(fname).startswith("enc:aes256gcm:"):
                        updates.append("full_name = :fname")
                        params["fname"] = encrypt_field(str(fname))
                    if updates:
                        params["uid"] = uid
                        conn.exec_driver_sql(f"UPDATE users SET {', '.join(updates)} WHERE id = :uid", params)

                conn.commit()
        except Exception as e:
            logging.warning("Database schema init notice: %s", e)



def get_db():
    """FastAPI dependency: yields a scoped DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
