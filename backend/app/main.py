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

                doc_res = conn.exec_driver_sql("PRAGMA table_info(documents)").fetchall()
                doc_cols = [r[1] for r in doc_res] if doc_res else []
                if doc_cols and "extracted_data" not in doc_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN extracted_data JSON")
                if doc_cols and "pages" not in doc_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN pages JSON")
                if doc_cols and "patient_id" not in doc_cols:
                    conn.exec_driver_sql("ALTER TABLE documents ADD COLUMN patient_id VARCHAR")

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

cors_origins = settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"]
if "*" in cors_origins or not cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import socket
import os
import json

@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.ENV}


@app.get("/api/system/network-info")
def get_network_info():
    ip = "localhost"
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    tunnel_url = None
    tunnel_file = os.path.join(os.path.dirname(__file__), "..", "..", "scripts", ".tunnel-info.json")
    if os.path.exists(tunnel_file):
        try:
            with open(tunnel_file, "r") as f:
                data = json.load(f)
                tunnel_url = data.get("publicUrl")
        except Exception:
            pass

    return {
        "local_ip": ip,
        "local_url": f"http://{ip}:3000",
        "tunnel_url": tunnel_url,
        "frontend_port": 3000,
        "backend_port": 8000,
    }


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

