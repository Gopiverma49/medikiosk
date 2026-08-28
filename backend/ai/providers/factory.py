"""
Provider factory. Business logic should call get_speech_provider() etc. rather
than importing a vendor class directly, so provider swaps are a one-line config
change, and every call automatically goes through FallbackProvider so a vendor
outage degrades gracefully instead of crashing a request.
"""
from app.config import get_settings
from .base import ProviderResult, FallbackProvider
from . import mock_providers as mock
from . import production_providers as prod

settings = get_settings()

# Runtime-toggleable failure simulation (used by the admin "simulate AI failure" UI
# and by the failure-testing pytest suite). Kept in-process; reset on restart.
_FORCE_FAIL = {"asr": False, "ocr": False, "llm": False, "nlp": False, "tts": False, "translation": False}


def set_force_fail(provider: str, value: bool):
    _FORCE_FAIL[provider] = value


def get_speech_provider():
    primary = mock.MockSpeechProvider(force_fail=_FORCE_FAIL["asr"]) if settings.SPEECH_PROVIDER == "mock" else prod.ProductionSpeechProvider()
    fallback = ProviderResult(ok=False, error="ASR_UNAVAILABLE_FALLBACK_TO_TEXT_INPUT", provider_name="fallback")
    return FallbackProvider(primary, fallback)


def get_ocr_provider():
    primary = mock.MockOCRProvider(force_fail=_FORCE_FAIL["ocr"]) if settings.OCR_PROVIDER == "mock" else prod.ProductionOCRProvider()
    fallback = ProviderResult(ok=False, error="OCR_UNAVAILABLE_FALLBACK_TO_MANUAL_ENTRY", provider_name="fallback")
    return FallbackProvider(primary, fallback)


def get_nlp_provider():
    primary = mock.MockClinicalNLPProvider(force_fail=_FORCE_FAIL["nlp"]) if settings.NLP_PROVIDER == "mock" else prod.ProductionClinicalNLPProvider()
    fallback = ProviderResult(ok=False, error="NLP_UNAVAILABLE_FALLBACK_TO_RULE_BASED", provider_name="fallback")
    return FallbackProvider(primary, fallback)


def get_summary_provider():
    primary = mock.MockSummaryProvider(force_fail=_FORCE_FAIL["llm"]) if settings.SUMMARY_PROVIDER == "mock" else prod.ProductionSummaryProvider()
    fallback = ProviderResult(ok=False, error="LLM_UNAVAILABLE_FALLBACK_TO_TEMPLATE", provider_name="fallback")
    return FallbackProvider(primary, fallback)


def get_translation_provider():
    primary = mock.MockTranslationProvider(force_fail=_FORCE_FAIL["translation"]) if settings.TRANSLATION_PROVIDER == "mock" else prod.ProductionTranslationProvider()
    fallback = ProviderResult(ok=False, error="TRANSLATION_UNAVAILABLE", provider_name="fallback")
    return FallbackProvider(primary, fallback)


def raw_nlp_mock(force_fail: bool = False) -> mock.MockClinicalNLPProvider:
    """Direct (non-fallback-wrapped) access, used by the document extraction
    flow which needs `.extract_document_fields`, not part of the shared ABC."""
    return mock.MockClinicalNLPProvider(force_fail=force_fail or _FORCE_FAIL["ocr"])
