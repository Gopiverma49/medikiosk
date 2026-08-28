"""
Production provider stubs. These implement the same interfaces as the mock
providers but are NOT wired up by default (see app/config.py). Fill in a real
vendor SDK call in each method before switching SPEECH_PROVIDER / OCR_PROVIDER
/ etc. to "production" in your environment. Never hard-code API keys here —
read them from environment variables via app/config.py.
"""
import os
from .base import (
    SpeechToTextProvider, TextToSpeechProvider, OCRProvider,
    ClinicalNLPProvider, SummaryProvider, TranslationProvider, ProviderResult,
)


class ProductionSpeechProvider(SpeechToTextProvider):
    """Example target: an Indian-language ASR vendor (e.g. Bhashini, Google STT)."""
    def __init__(self):
        self.api_key = os.getenv("ASR_API_KEY")

    def transcribe(self, audio_ref: str, language: str) -> ProviderResult:
        if not self.api_key:
            return ProviderResult(ok=False, error="ASR_API_KEY not configured", provider_name="ProductionSpeechProvider")
        # TODO: call real vendor SDK here.
        raise NotImplementedError("Wire up a real ASR vendor before using production mode.")


class ProductionTTSProvider(TextToSpeechProvider):
    def __init__(self):
        self.api_key = os.getenv("TTS_API_KEY")

    def synthesize(self, text: str, language: str) -> ProviderResult:
        raise NotImplementedError("Wire up a real TTS vendor before using production mode.")


class ProductionOCRProvider(OCRProvider):
    def __init__(self):
        self.api_key = os.getenv("OCR_API_KEY")

    def extract_text(self, document_ref: str) -> ProviderResult:
        raise NotImplementedError("Wire up a real OCR vendor before using production mode.")


class ProductionClinicalNLPProvider(ClinicalNLPProvider):
    def __init__(self):
        self.api_key = os.getenv("NLP_API_KEY")

    def extract_entities(self, text: str, language: str) -> ProviderResult:
        raise NotImplementedError("Wire up a real clinical NLP vendor before using production mode.")


class ProductionSummaryProvider(SummaryProvider):
    def __init__(self):
        self.api_key = os.getenv("LLM_API_KEY")

    def generate_summary(self, structured_facts: list) -> ProviderResult:
        raise NotImplementedError("Wire up a real LLM vendor before using production mode.")


class ProductionTranslationProvider(TranslationProvider):
    def __init__(self):
        self.api_key = os.getenv("TRANSLATION_API_KEY")

    def to_canonical_concept(self, text: str, language: str) -> ProviderResult:
        raise NotImplementedError("Wire up a real translation vendor before using production mode.")
