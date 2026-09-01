"""
MediKiosk backend entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Run via Docker Compose (recommended — see repository root docker-compose.yml):
    docker compose up --build
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from . import models  # noqa: F401 - ensures models are registered on Base.metadata

from .routers import (
    auth, patients, history, clinical_facts, documents, timeline,
    contradictions, red_flags, summaries, fhir, evaluation, ayush, admin,
    tokens,
)

from .seed import seed

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Check and add any missing columns in existing SQLite database
    try:
        with engine.connect() as conn:
            if engine.dialect.name == "sqlite":
                res = conn.exec_driver_sql("PRAGMA table_info(treatment_records)").fetchall()
                cols = [r[1] for r in res] if res else []
                if cols and "prescribed_medicines" not in cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN prescribed_medicines JSON")
                if cols and "doctor_notes" not in cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN doctor_notes TEXT")
                if cols and "doctor_name" not in cols:
                    conn.exec_driver_sql("ALTER TABLE treatment_records ADD COLUMN doctor_name VARCHAR")
                conn.commit()
    except Exception as e:
        print("Schema migration notice:", e)

    try:
        seed()
    except Exception as e:
        print("Seed warning on startup:", e)
    yield


app = FastAPI(
    title="MediKiosk API",
    description=(
        "AI-assisted multilingual clinical history-taking and document intake "
        "platform. Prototype — does not diagnose, prescribe, or make autonomous "
        "clinical decisions. All AI output requires explicit human verification. "
        "Synthetic data only."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.ENV}


app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(history.router)
app.include_router(clinical_facts.router)
app.include_router(documents.router)
app.include_router(timeline.router)
app.include_router(contradictions.router)
app.include_router(red_flags.router)
app.include_router(red_flags.triage_router)
app.include_router(summaries.router)
app.include_router(fhir.router)
app.include_router(evaluation.router)
app.include_router(ayush.router)
app.include_router(admin.router)
app.include_router(tokens.router)

