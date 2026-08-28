"""
Provider interfaces. The rest of the application must depend only on these
abstractions, never on a specific vendor SDK — this is what lets MediKiosk
run with zero external API keys (MockProvider) and swap in real vendors later
(ProductionProvider) without touching business logic.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Any


@dataclass
class ProviderResult:
    ok: bool
    data: Optional[Any] = None
    confidence: Optional[float] = None
    error: Optional[str] = None
    provider_name: str = "unknown"
    model: Optional[str] = None


class SpeechToTextProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_ref: str, language: str) -> ProviderResult:
        ...


class TextToSpeechProvider(ABC):
    @abstractmethod
    def synthesize(self, text: str, language: str) -> ProviderResult:
        ...


class OCRProvider(ABC):
    @abstractmethod
    def extract_text(self, document_ref: str) -> ProviderResult:
        ...


class ClinicalNLPProvider(ABC):
    @abstractmethod
    def extract_entities(self, text: str, language: str) -> ProviderResult:
        """Returns language-neutral clinical concepts extracted from text."""
        ...


class SummaryProvider(ABC):
    @abstractmethod
    def generate_summary(self, structured_facts: list) -> ProviderResult:
        ...


class TranslationProvider(ABC):
    @abstractmethod
    def to_canonical_concept(self, text: str, language: str) -> ProviderResult:
        ...


class FallbackProvider:
    """
    Wraps any provider; on failure (or when the underlying provider is configured
    'down' for failure-simulation), routes to a safe fallback instead of raising.
    Callers should always go through a FallbackProvider, never call vendor
    providers directly, so failures degrade gracefully everywhere.
    """
    def __init__(self, primary, fallback_result: ProviderResult):
        self.primary = primary
        self.fallback_result = fallback_result

    def call(self, method_name: str, *args, **kwargs) -> ProviderResult:
        try:
            method = getattr(self.primary, method_name)
            result = method(*args, **kwargs)
            if not result.ok:
                return self.fallback_result
            return result
        except Exception as exc:  # noqa: BLE001 - deliberate: never let a provider crash the app
            fb = self.fallback_result
            fb.error = str(exc)
            return fb
