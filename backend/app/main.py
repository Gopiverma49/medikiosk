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
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # In production, use `alembic upgrade head` instead of create_all().
    # create_all() is kept here too so `docker compose up` works out of the box
    # even before migrations have been run.
    Base.metadata.create_all(bind=engine)
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
    allow_origins=settings.CORS_ORIGINS,
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
