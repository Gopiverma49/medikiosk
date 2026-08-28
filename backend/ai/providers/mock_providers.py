"""
Mock providers: deterministic, offline, zero-API-key implementations used by
default (see app/config.py Settings.*_PROVIDER = "mock"). These let the whole
platform run end-to-end in a demo/CI environment with no vendor credentials.

A `force_fail` flag lets the failure-testing suite / admin UI simulate outages
of any provider on demand (see docs/EVALUATION.md "AI Failure Testing").
"""
from .base import (
    SpeechToTextProvider, TextToSpeechProvider, OCRProvider,
    ClinicalNLPProvider, SummaryProvider, TranslationProvider, ProviderResult,
)

CHIEF_COMPLAINT_TEXT = {
    "en": "I have had chest pain for two days.",
    "hi": "मुझे दो दिनों से सीने में दर्द है।",
    "kn": "ನನಗೆ ಎರಡು ದಿನಗಳಿಂದ ಎದೆ ನೋವು ಇದೆ.",
}

SAMPLE_DOCUMENTS = {
    "prescription": {
        "ocr_text": "Dr. S. Rao, MBBS MD | Rx: Tab. Metformin 500mg BD, Tab. Amlodipine 5mg OD | Pt: Ravi Kumar, 52M",
        "extraction": [
            {"concept": "medication", "label": "Metformin", "dose": "500 mg", "frequency": "twice_daily", "confidence": 0.94},
            {"concept": "medication", "label": "Amlodipine", "dose": "5 mg", "frequency": "once_daily", "confidence": 0.91},
        ],
    },
    "lab_report": {
        "ocr_text": "HbA1c: 8.2 % | Fasting Glucose: 162 mg/dL | Lab: City Diagnostics",
        "extraction": [
            {"concept": "hba1c", "label": "HbA1c", "value": 8.2, "unit": "%", "confidence": 0.97},
            {"concept": "fasting_glucose", "label": "Fasting Glucose", "value": 162, "unit": "mg/dL", "confidence": 0.88},
        ],
    },
    "discharge_summary": {
        "ocr_text": "Discharge Summary — Allergies: Penicillin (documented reaction: rash). "
                     "Diagnosis: Type 2 Diabetes Mellitus, Hypertension.",
        "extraction": [
            {"concept": "allergy", "label": "Penicillin", "confidence": 0.90},
            {"concept": "past_medical_history", "label": "Type 2 Diabetes Mellitus", "confidence": 0.93},
            {"concept": "past_medical_history", "label": "Hypertension", "confidence": 0.93},
        ],
    },
}


class MockSpeechProvider(SpeechToTextProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def transcribe(self, audio_ref: str, language: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="ASR_UNAVAILABLE", provider_name="MockSpeechProvider")
        text = CHIEF_COMPLAINT_TEXT.get(language, CHIEF_COMPLAINT_TEXT["en"])
        return ProviderResult(ok=True, data=text, confidence=0.96, provider_name="MockSpeechProvider", model="mock-asr-v1")


class MockTTSProvider(TextToSpeechProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def synthesize(self, text: str, language: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="TTS_UNAVAILABLE", provider_name="MockTTSProvider")
        return ProviderResult(ok=True, data=f"<audio-ref for '{text[:24]}...'>", provider_name="MockTTSProvider")


class MockOCRProvider(OCRProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def extract_text(self, document_ref: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="OCR_UNAVAILABLE", provider_name="MockOCRProvider")
        doc_type = document_ref if document_ref in SAMPLE_DOCUMENTS else "prescription"
        sample = SAMPLE_DOCUMENTS[doc_type]
        return ProviderResult(ok=True, data=sample["ocr_text"], confidence=0.93, provider_name="MockOCRProvider")


class MockClinicalNLPProvider(ClinicalNLPProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def extract_entities(self, text: str, language: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="NLP_UNAVAILABLE", provider_name="MockClinicalNLPProvider")
        # naive but deterministic keyword mapping -> language-neutral concept
        t = text.lower()
        concept = None
        if "chest pain" in t or "ಎದೆ ನೋವು" in text or "सीने में दर्द" in text:
            concept = "chest_pain"
        elif "breathless" in t:
            concept = "dyspnea"
        elif "sweat" in t:
            concept = "sweating"
        result = {"concept": concept, "duration": {"value": 2, "unit": "days"} if "two days" in t else None}
        return ProviderResult(ok=True, data=result, confidence=0.96, provider_name="MockClinicalNLPProvider")

    def extract_document_fields(self, doc_type: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="NLP_UNAVAILABLE", provider_name="MockClinicalNLPProvider")
        sample = SAMPLE_DOCUMENTS.get(doc_type, SAMPLE_DOCUMENTS["prescription"])
        return ProviderResult(ok=True, data=sample["extraction"], provider_name="MockClinicalNLPProvider")


class MockSummaryProvider(SummaryProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def generate_summary(self, structured_facts: list) -> ProviderResult:
        # Even when force_fail is True, callers should fall back to the
        # rule-based template in services/clinical_schema.py — this mirrors
        # section 8's "LLM failed -> rule-based question flow" principle.
        if self.force_fail:
            return ProviderResult(ok=False, error="LLM_UNAVAILABLE", provider_name="MockSummaryProvider")
        lines = [f"- {f.get('concept')}: {f.get('label')}" for f in structured_facts]
        return ProviderResult(ok=True, data="\n".join(lines), provider_name="MockSummaryProvider", model="mock-llm-v1")


class MockTranslationProvider(TranslationProvider):
    def __init__(self, force_fail: bool = False):
        self.force_fail = force_fail

    def to_canonical_concept(self, text: str, language: str) -> ProviderResult:
        if self.force_fail:
            return ProviderResult(ok=False, error="TRANSLATION_UNAVAILABLE", provider_name="MockTranslationProvider")
        nlp = MockClinicalNLPProvider()
        return nlp.extract_entities(text, language)
