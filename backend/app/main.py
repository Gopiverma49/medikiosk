"""
MediKiosk backend entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Run via Docker Compose (recommended — see repository root docker-compose.yml):
    docker compose up --build
"""
import os
import json
import socket
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import engine, init_db
from .routers import (
    auth, patients, history, clinical_facts, documents, timeline,
    contradictions, red_flags, summaries, fhir, evaluation, ayush, admin,
    tokens,
)
from .seed import seed

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db(engine)
    except Exception as e:
        logger.warning("Database initialization notice: %s", e)

    try:
        seed()
    except Exception as e:
        logger.warning("Database seed notice: %s", e)
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
    tunnel_file = os.path.join(settings.BASE_DIR, "..", "scripts", ".tunnel-info.json")
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

