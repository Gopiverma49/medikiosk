from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalFact, VerificationStatus, HumanVerification
from ..schemas import ClinicalFactOut, FactVerifyAction, FactCorrectAction
from ..services.audit import log_event
from ..services.clinical_schema import normalize_text_to_concept
from ai.providers.factory import get_speech_provider

router = APIRouter(prefix="/api/clinical-facts", tags=["clinical-facts"])


@router.post("/extract")
def extract_from_speech(encounter_id: str, language: str, db: Session = Depends(get_db)):
    """Chief-complaint capture: ASR -> normalized text -> language-neutral concept."""
    provider = get_speech_provider()
    speech_result = provider.call("transcribe", "chief_complaint_audio", language)
    if not speech_result.ok:
        log_event(db, "ASR provider failed", "fallback to text/touch input", encounter_id=encounter_id)
        return {"ok": False, "fallback": "type_or_select"}

    concept_data = normalize_text_to_concept(speech_result.data, language)
    facts_created = []
    if concept_data and concept_data.get("concept"):
        fact = ClinicalFact(
            encounter_id=encounter_id, concept=concept_data["concept"], category="symptom",
            value=True, label=concept_data["concept"].replace("_", " ").title(),
            certainty="confirmed", source="PATIENT_SPOKEN", source_language=language,
            original_text=speech_result.data, confidence=0.96, extraction_method="ASR + Clinical NLP",
            verification_status=VerificationStatus.UNVERIFIED,
        )
        db.add(fact)
        db.flush()
        facts_created.append(fact)
    log_event(db, "ASR transcription + normalization",
              f'"{speech_result.data}" ({language})', encounter_id=encounter_id)
    db.commit()
    return {"ok": True, "facts": [f.id for f in facts_created], "transcript": speech_result.data}


@router.get("/{encounter_id}", response_model=list[ClinicalFactOut])
def list_facts(encounter_id: str, db: Session = Depends(get_db)):
    return db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id).all()


@router.post("/verify")
def verify_fact(payload: FactVerifyAction, db: Session = Depends(get_db)):
    fact = db.query(ClinicalFact).filter(ClinicalFact.id == payload.fact_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")
    fact.verification_status = VerificationStatus.PHYSICIAN_VERIFIED
    fact.verified_by = payload.performed_by
    db.add(HumanVerification(fact_id=fact.id, action="verify", performed_by=payload.performed_by,
                              previous_value=fact.value, new_value=fact.value))
    log_event(db, "Doctor verified fact", fact.concept, actor=payload.performed_by, encounter_id=fact.encounter_id)
    db.commit()
    db.refresh(fact)
    return fact


@router.post("/correct")
def correct_fact(payload: FactCorrectAction, db: Session = Depends(get_db)):
    fact = db.query(ClinicalFact).filter(ClinicalFact.id == payload.fact_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")
    if fact.original_extraction is None:
        fact.original_extraction = {"value": fact.value, "label": fact.label}
    previous = fact.value
    fact.value = payload.new_value
    fact.label = payload.new_label or str(payload.new_value)
    fact.verification_status = VerificationStatus.PHYSICIAN_CORRECTED
    fact.verified_by = payload.performed_by
    db.add(HumanVerification(fact_id=fact.id, action="correct", performed_by=payload.performed_by,
                              previous_value=previous, new_value=fact.value))
    log_event(db, "Doctor corrected fact", f"{fact.concept} -> {fact.value}", actor=payload.performed_by, encounter_id=fact.encounter_id)
    db.commit()
    db.refresh(fact)
    return fact


@router.post("/reject")
def reject_fact(payload: FactVerifyAction, db: Session = Depends(get_db)):
    fact = db.query(ClinicalFact).filter(ClinicalFact.id == payload.fact_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")
    fact.verification_status = VerificationStatus.REJECTED
    fact.verified_by = payload.performed_by
    db.add(HumanVerification(fact_id=fact.id, action="reject", performed_by=payload.performed_by,
                              previous_value=fact.value, new_value=None))
    log_event(db, "Doctor rejected fact", fact.concept, actor=payload.performed_by, encounter_id=fact.encounter_id)
    db.commit()
    db.refresh(fact)
    return fact
