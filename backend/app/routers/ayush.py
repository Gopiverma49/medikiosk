"""
AYUSH / Ayurveda pathway (Dashavidha Pariksha). Collected exactly like any
other clinical fact — confidence, provenance, uncertainty, verification_status
— and the AI never generates a diagnosis or treatment recommendation from it;
responses are displayed for practitioner interpretation only.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalFact, VerificationStatus, FactSource, Encounter
from ..services.audit import log_event

router = APIRouter(prefix="/api/ayush", tags=["ayush"])

DASHAVIDHA_PARIKSHA_FIELDS = [
    {"concept": "prakriti", "label": "Prakriti (constitution)"},
    {"concept": "vikriti", "label": "Vikriti (current imbalance)"},
    {"concept": "sara", "label": "Sara (tissue quality)"},
    {"concept": "samhanana", "label": "Samhanana (body build)"},
    {"concept": "pramana", "label": "Pramana (body measurements)"},
    {"concept": "satmya", "label": "Satmya (suitability/adaptability)"},
    {"concept": "sattva", "label": "Sattva (mental strength)"},
    {"concept": "ahara_shakti", "label": "Ahara Shakti (digestive capacity)"},
    {"concept": "vyayama_shakti", "label": "Vyayama Shakti (exercise capacity)"},
    {"concept": "vaya", "label": "Vaya (age-related state)"},
    {"concept": "ahara", "label": "Ahara (diet)"},
    {"concept": "vihara", "label": "Vihara (lifestyle)"},
    {"concept": "nidana", "label": "Nidana (causative factors)"},
    {"concept": "agni", "label": "Agni (metabolic fire)"},
    {"concept": "koshtha", "label": "Koshtha (bowel type)"},
    {"concept": "samprapti", "label": "Samprapti (disease process) — practitioner assessment only"},
]


@router.get("/fields")
def get_fields():
    return DASHAVIDHA_PARIKSHA_FIELDS


@router.post("/answer")
def submit_ayush_answer(encounter_id: str, concept: str, value: str = None, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if enc and enc.mode != "ayush":
        enc.mode = "ayush"
    is_unknown = value is None
    fact = ClinicalFact(
        encounter_id=encounter_id, concept=concept, category="ayush",
        value=None if is_unknown else value, label="Unknown" if is_unknown else value,
        certainty="unknown" if is_unknown else "confirmed",
        source=FactSource.PATIENT_TOUCH, confidence=None if is_unknown else 0.88,
        verification_status=VerificationStatus.UNKNOWN if is_unknown else VerificationStatus.PATIENT_CONFIRMED,
    )
    db.add(fact)
    db.flush()
    log_event(db, "AYUSH response recorded", f"{concept} = {value}", encounter_id=encounter_id)
    db.commit()
    db.refresh(fact)
    return fact
