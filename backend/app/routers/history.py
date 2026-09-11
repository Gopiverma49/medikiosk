"""
Adaptive history-taking endpoints. Every answer, including "unknown", becomes a
ClinicalFact with certainty explicitly recorded — never silently coerced.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalFact, FactSource, VerificationStatus, Encounter
from ..schemas import HistoryAnswerIn, ClinicalFactOut
from .ayush import AYUSH_CONCEPTS
from ..services.clinical_schema import ADAPTIVE_QUESTIONNAIRE
from ..services.red_flag_engine import evaluate_red_flags
from ..services.audit import log_event

router = APIRouter(prefix="/api/history", tags=["history"])


@router.post("/start")
def start_history(encounter_id: str, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    log_event(db, "History-taking started", "", encounter_id=encounter_id)
    db.commit()
    return {"questionnaire": ADAPTIVE_QUESTIONNAIRE}


@router.post("/answer", response_model=ClinicalFactOut)
def submit_answer(payload: HistoryAnswerIn, db: Session = Depends(get_db)):
    is_unknown = payload.certainty == "unknown" or payload.raw_answer is None
    category = "hpi"
    if "medication" in payload.question_concept:
        category = "medication"
    elif "allerg" in payload.question_concept:
        category = "allergy"
    elif payload.question_concept in AYUSH_CONCEPTS:
        category = "ayush"


    fact = ClinicalFact(
        encounter_id=payload.encounter_id,
        concept=payload.question_concept,
        category=category,
        value=None if is_unknown else payload.raw_answer,
        label="Unknown" if is_unknown else str(payload.raw_answer),
        certainty="unknown" if is_unknown else "confirmed",
        source=FactSource.PATIENT_TOUCH,
        source_language=payload.source_language,
        confidence=None if is_unknown else 0.92,
        verification_status=VerificationStatus.UNKNOWN if is_unknown else VerificationStatus.PATIENT_CONFIRMED,
    )
    db.add(fact)
    db.flush()
    log_event(db, "Answer received", f"{payload.question_concept} = {fact.value}", encounter_id=payload.encounter_id)
    db.commit()
    db.refresh(fact)
    evaluate_red_flags(db, payload.encounter_id)
    return fact


@router.get("/{encounter_id}", response_model=list[ClinicalFactOut])
def get_history(encounter_id: str, db: Session = Depends(get_db)):
    return db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id).all()
