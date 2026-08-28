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


@router.post("/patients/lookup", response_model=dict)
def lookup_patient(payload: PatientLookupIn, db: Session = Depends(get_db)):
    """Search for a patient by 10-digit Patient ID."""
    pid = payload.patient_id.strip()
    patient = db.query(Patient).filter(
        (Patient.patient_id == pid) | (Patient.id == pid)
    ).first()
    
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
    patient = db.query(Patient).filter(
        (Patient.id == patient_id) | (Patient.patient_id == patient_id)
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    return db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient.id).order_by(TreatmentRecord.created_at.desc()).all()


@router.post("/patients", response_model=PatientOut)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)):
    # Check if patient_id is already registered
    if payload.patient_id:
        existing = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
        if existing:
            return existing
    patient = Patient(**payload.model_dump())
    db.add(patient)
    db.flush()
    log_event(db, "Patient created", f"{patient.name} ({patient.patient_id or patient.id})")
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter((Patient.id == patient_id) | (Patient.patient_id == patient_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/patients", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.created_at.desc()).all()


@router.get("/patients/{patient_id}/encounters", response_model=list[EncounterOut])
def list_patient_encounters(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter((Patient.id == patient_id) | (Patient.patient_id == patient_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return db.query(Encounter).filter(Encounter.patient_id == patient.id).order_by(Encounter.created_at.desc()).all()


@router.post("/encounters", response_model=EncounterOut)
def create_encounter(payload: EncounterCreate, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter((Patient.id == payload.patient_id) | (Patient.patient_id == payload.patient_id)).first()
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
