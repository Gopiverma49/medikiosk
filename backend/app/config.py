"""
Application configuration, loaded from environment variables.
See .env.example at the repository root for all supported keys.
"""
import os
from functools import lru_cache

try:
    from dotenv import load_dotenv
    _repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    _env_file = os.path.join(_repo_root, ".env")
    if os.path.isfile(_env_file):
        load_dotenv(_env_file)
except ImportError:
    pass


class Settings:
    # --- Base paths ---
    BASE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")), "uploads", "documents"))

    # --- Database ---
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql+psycopg2://medikiosk:medikiosk@db:5432/medikiosk"
    )

    # --- Auth & Cryptography (DPDP Act 2023 Compliance) ---
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-.env")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))
    FIELD_ENCRYPTION_KEY: str = os.getenv("FIELD_ENCRYPTION_KEY", "")
    BLIND_INDEX_SALT: str = os.getenv("BLIND_INDEX_SALT", "")
    DOCUMENT_TOKEN_SECRET: str = os.getenv("DOCUMENT_TOKEN_SECRET", os.getenv("JWT_SECRET", "doc-token-secret-2026"))

    # --- CORS ---
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # --- AI provider selection ---
    # "mock" is the only mode guaranteed to work without external API keys.
    # Swap to "production" once real ASR/OCR/LLM vendor credentials are configured.
    SPEECH_PROVIDER: str = os.getenv("SPEECH_PROVIDER", "mock")
    OCR_PROVIDER: str = os.getenv("OCR_PROVIDER", "mock")
    NLP_PROVIDER: str = os.getenv("NLP_PROVIDER", "mock")
    SUMMARY_PROVIDER: str = os.getenv("SUMMARY_PROVIDER", "mock")
    TRANSLATION_PROVIDER: str = os.getenv("TRANSLATION_PROVIDER", "mock")

    # --- Integrations (mock/sandbox only in this prototype) ---
    FHIR_MODE: str = os.getenv("FHIR_MODE", "mock")
    ABDM_MODE: str = os.getenv("ABDM_MODE", "sandbox")
    HIS_MODE: str = os.getenv("HIS_MODE", "mock")

    ENV: str = os.getenv("ENV", "development")


@lru_cache
def get_settings() -> Settings:
    return Settings()
