"""
Normalizes patient-language input (English / Hindi / Kannada) into the
language-neutral clinical schema. This is the layer that guarantees red-flag
rules, contradiction detection, summaries, and analytics never depend on
which language the patient spoke — they only ever see `concept` keys.

    PATIENT LANGUAGE -> ASR -> NORMALIZED TEXT -> CLINICAL ENTITY EXTRACTION
    -> LANGUAGE-NEUTRAL CLINICAL SCHEMA

original_text and source_language are preserved on the ClinicalFact row for
provenance, but never consulted by downstream business logic.
"""
from typing import Optional
from ai.providers.factory import get_nlp_provider


CONCEPT_KEYWORDS = {
    "en": {"chest pain": "chest_pain", "breathless": "dyspnea", "sweat": "sweating"},
    "hi": {"सीने में दर्द": "chest_pain"},
    "kn": {"ಎದೆ ನೋವು": "chest_pain"},
}


def normalize_text_to_concept(text: str, language: str) -> Optional[dict]:
    """Returns {"concept": ..., "duration": {...}|None} or None if nothing recognized.
    Delegates to the pluggable NLP provider so this stays vendor-agnostic."""
    provider = get_nlp_provider()
    result = provider.call("extract_entities", text, language)
    if not result.ok:
        return None
    return result.data


ADAPTIVE_QUESTIONNAIRE = [
    {"concept": "symptom_onset", "prompt_key": "onset", "allow_unknown": True},
    {"concept": "location", "prompt_key": "location", "allow_unknown": True},
    {"concept": "character", "prompt_key": "character", "allow_unknown": True},
    {"concept": "severity", "prompt_key": "severity", "allow_unknown": True},
    {"concept": "radiation_to_arm", "prompt_key": "radiation", "allow_unknown": True},
    {"concept": "dyspnea", "prompt_key": "dyspnea", "allow_unknown": True},
    {"concept": "sweating", "prompt_key": "sweating", "allow_unknown": True},
    {"concept": "medication_reported_none", "prompt_key": "meds", "allow_unknown": True, "inverse_yesno": True},
    {"concept": "allergy_reported_none", "prompt_key": "allergy", "allow_unknown": True, "inverse_yesno": True},
]
