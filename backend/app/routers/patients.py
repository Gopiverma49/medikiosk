from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, Encounter, Consent, TreatmentRecord
from ..schemas import (
    PatientCreate, PatientOut, EncounterCreate, EncounterOut, ConsentCreate,
    PatientLookupIn, TreatmentRecordOut,
)
from ..services.audit import log_event

router = APIRouter(prefix="/api", tags=["patients"])


def _get_patient(db: Session, identifier: str) -> Optional[Patient]:
    """Helper to find patient by UUID id or 10-digit patient_id."""
    clean_id = identifier.strip()
    return db.query(Patient).filter((Patient.id == clean_id) | (Patient.patient_id == clean_id)).first()


@router.post("/patients/lookup", response_model=dict)
def lookup_patient(payload: PatientLookupIn, db: Session = Depends(get_db)):
    """Search for a patient by 10-digit Patient ID."""
    patient = _get_patient(db, payload.patient_id)
    if not patient:
        return {"found": False, "patient": None}
    
    treatments = db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient.id).order_by(TreatmentRecord.created_at.desc()).all()
    
    return {
        "found": True,
        "patient": PatientOut.model_validate(patient),
        "treatment_records_count": len(treatments),
    }


@router.get("/patients/{patient_id}/treatments", response_model=list[TreatmentRecordOut])
def get_patient_treatments(patient_id: str, db: Session = Depends(get_db)):
    """Retrieve past treatment records for a patient."""
    patient = _get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient.id).order_by(TreatmentRecord.created_at.desc()).all()


@router.post("/patients", response_model=PatientOut)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    import time
    clean_pid = payload.patient_id.strip() if payload.patient_id else None
    
    if not clean_pid:
        clean_pid = f"10{int(time.time() * 1000) % 100000000:08d}"
    
    # Check if patient_id is already registered
    existing = db.query(Patient).filter(Patient.patient_id == clean_pid).first()
    if existing:
        # Update existing record with the newly submitted details
        existing.name = payload.name.strip()
        if payload.phone:
            existing.phone = payload.phone.strip()
        if payload.age is not None:
            existing.age = payload.age
        if payload.gender:
            existing.gender = payload.gender
        if payload.preferred_language:
            existing.preferred_language = payload.preferred_language
        if payload.department:
            existing.department = payload.department
        db.commit()
        db.refresh(existing)
        log_event(db, "Patient updated", f"{existing.name} ({existing.patient_id or existing.id})")
        return existing
    
    patient_data = payload.model_dump()
    patient_data["patient_id"] = clean_pid
    patient = Patient(**patient_data)
    try:
        db.add(patient)
        db.flush()
        log_event(db, "Patient created", f"{patient.name} ({patient.patient_id or patient.id})")
        db.commit()
        db.refresh(patient)
        return patient
    except Exception as e:
        db.rollback()
        # Fallback with guaranteed unique timestamp ID if unique conflict occurred
        patient_data["patient_id"] = f"10{int(time.time() * 1000) % 100000000:08d}"
        patient = Patient(**patient_data)
        db.add(patient)
        db.commit()
        db.refresh(patient)
        return patient


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = _get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/patients", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.created_at.desc()).all()


@router.get("/patients/{patient_id}/encounters", response_model=list[EncounterOut])
def list_patient_encounters(patient_id: str, db: Session = Depends(get_db)):
    patient = _get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db.query(Encounter).filter(Encounter.patient_id == patient.id).order_by(Encounter.created_at.desc()).all()


@router.post("/encounters", response_model=EncounterOut)
def create_encounter(payload: EncounterCreate, db: Session = Depends(get_db)):
    patient = _get_patient(db, payload.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    encounter = Encounter(
        patient_id=patient.id,
        mode=payload.mode,
        department=payload.department or patient.department,
        previous_illness_id=payload.previous_illness_id,
    )
    db.add(encounter)
    db.flush()
    log_event(db, "Encounter created", f"mode={encounter.mode}, prev_illness={payload.previous_illness_id}", encounter_id=encounter.id)
    db.commit()
    db.refresh(encounter)
    return encounter


@router.get("/encounters/{encounter_id}", response_model=EncounterOut)
def get_encounter(encounter_id: str, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return enc


@router.post("/consents")
def record_consent(payload: ConsentCreate, db: Session = Depends(get_db)):
    consent = Consent(encounter_id=payload.encounter_id, granted=payload.granted)
    db.add(consent)
    db.flush()
    log_event(db, "Consent recorded", f"granted={payload.granted}", encounter_id=payload.encounter_id)
    db.commit()
    db.refresh(consent)
    return {"id": consent.id, "granted": consent.granted}
