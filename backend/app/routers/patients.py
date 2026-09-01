from typing import Optional
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Patient, Encounter, Consent, TreatmentRecord, ClinicalFact, ClinicalSummary
from ..schemas import (
    PatientCreate, PatientOut, EncounterCreate, EncounterOut, ConsentCreate,
    PatientLookupIn, TreatmentRecordOut, PrescriptionSaveIn,
)
from ..services.audit import log_event
from datetime import datetime, timezone

router = APIRouter(prefix="/api", tags=["patients"])


def _get_patient(db: Session, identifier: str) -> Optional[Patient]:
    """Helper to find patient by UUID id or 10-digit patient_id."""
    clean_id = identifier.strip()
    return db.query(Patient).filter((Patient.id == clean_id) | (Patient.patient_id == clean_id)).first()


def _clean_str_value(val) -> str:
    if val is None or val is True or val is False:
        return ""
    if isinstance(val, dict):
        return str(val.get("displayLabel") or val.get("name") or val.get("mainLocation") or "").strip()
    if isinstance(val, list):
        items = [_clean_str_value(x) for x in val if x not in (True, False, None)]
        return ", ".join(i for i in items if i)
    s = str(val).strip()
    if s.lower() in ("true", "false", "none", "null", "undefined"):
        return ""
    if s.startswith("{") and s.endswith("}"):
        import ast, json
        try:
            d = json.loads(s.replace("'", '"'))
            if isinstance(d, dict):
                return str(d.get("displayLabel") or d.get("name") or d.get("mainLocation") or "").strip()
        except Exception:
            try:
                d = ast.literal_eval(s)
                if isinstance(d, dict):
                    return str(d.get("displayLabel") or d.get("name") or d.get("mainLocation") or "").strip()
            except Exception:
                pass
    if s.startswith("[") and s.endswith("]"):
        import ast
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                items = [_clean_str_value(x) for x in parsed if x not in (True, False, None)]
                return ", ".join(i for i in items if i)
        except Exception:
            pass
    if "_" in s:
        s = s.replace("_", " ").title()
    return s


def _get_combined_patient_treatments(db: Session, patient: Patient) -> list:
    """Retrieve all past medical records with clean structured symptoms, duration, and dates."""
    # 1. Fetch explicit TreatmentRecords directly
    records = db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient.id).order_by(TreatmentRecord.created_at.desc()).all()
    out = list(records)

    # 2. Also check past completed or documented Encounters for this patient
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient.id).order_by(Encounter.created_at.desc()).all()

    existing_illness_keys = {
        f"{(r.illness_name or '').strip().lower()}_{(r.visit_date or '').strip().lower()}"
        for r in out
    }

    for enc in encounters:
        summary = db.query(ClinicalSummary).filter(ClinicalSummary.encounter_id == enc.id).first()
        facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == enc.id).all()
        
        if not summary and not facts:
            continue

        # Extract duration
        onset_fact = next((f for f in facts if f.concept == "symptom_onset" and f.label), None)
        duration_str = _clean_str_value(onset_fact.label if onset_fact else "")
        if not duration_str:
            duration_str = "1–3 days"

        # Extract meaningful symptoms (filtering out booleans, duration, JSON artifacts)
        symptom_items = []
        for f in facts:
            if f.concept in ("symptom_onset", "consent", "encounter_mode"):
                continue
            cleaned = _clean_str_value(f.label or f.value)
            if not cleaned or cleaned.lower() in ("true", "false", "yes", "no", "none", "general medical evaluation"):
                if f.concept in ("fever", "sweating", "dyspnea", "active_bleeding", "chest_pain") and f.value is True:
                    cleaned = f.concept.replace("_", " ").title()
                else:
                    continue
            if cleaned and cleaned not in symptom_items:
                symptom_items.append(cleaned)

        if not symptom_items:
            cc_raw = next((f.label for f in facts if f.concept == "chief_complaint"), None)
            cleaned_cc = _clean_str_value(cc_raw)
            symptom_items = [cleaned_cc] if cleaned_cc else ["General Consultation"]

        symptoms_str = ", ".join(symptom_items[:4])
        illness_name = symptom_items[0] if symptom_items else "Medical Consultation"
        visit_date_str = enc.created_at.strftime("%d %b %Y") if enc.created_at else "Recent Visit"
        
        record_key = f"{illness_name.strip().lower()}_{visit_date_str.strip().lower()}"
        if record_key in existing_illness_keys:
            continue
        existing_illness_keys.add(record_key)
        
        out.append(TreatmentRecord(
            id=enc.id,
            patient_id=patient.id,
            illness_id=f"VISIT_{enc.id[:8].upper()}",
            illness_name=illness_name,
            symptoms=symptoms_str,
            diagnosis=f"Duration: {duration_str}",
            treatment="OPD Consultation",
            visit_date=visit_date_str,
            created_at=enc.created_at or datetime.now(timezone.utc),
        ))

    out.sort(key=lambda r: r.created_at or datetime.min, reverse=True)
    return out


@router.post("/patients/lookup", response_model=dict)
def lookup_patient(payload: PatientLookupIn, db: Session = Depends(get_db)):
    """Search for a patient by 10-digit Patient ID."""
    patient = _get_patient(db, payload.patient_id)
    if not patient:
        return {"found": False, "patient": None}
    
    treatments = _get_combined_patient_treatments(db, patient)
    
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
    
    return _get_combined_patient_treatments(db, patient)


@router.post("/patients", response_model=PatientOut)
def create_patient(payload: PatientCreate, db: Session = Depends(get_db)):
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


@router.post("/patients/{patient_id}/prescriptions", response_model=TreatmentRecordOut)
def save_patient_prescription(patient_id: str, payload: PrescriptionSaveIn, db: Session = Depends(get_db)):
    """Save or update prescribed medicines, diagnosis, and review notes for a patient encounter."""
    patient = _get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    enc_id = payload.encounter_id
    illness_key = f"VISIT_{enc_id[:8].upper()}" if enc_id else f"RX_{patient.id[:8].upper()}"

    tr = None
    if enc_id:
        tr = db.query(TreatmentRecord).filter(
            TreatmentRecord.patient_id == patient.id,
            TreatmentRecord.illness_id == illness_key
        ).first()

    if not tr:
        # Check by patient_id and today's date if no encounter
        tr = db.query(TreatmentRecord).filter(
            TreatmentRecord.patient_id == patient.id,
            TreatmentRecord.visit_date == datetime.now(timezone.utc).strftime("%d %b %Y")
        ).first()

    meds_data = [m.model_dump() for m in payload.prescribed_medicines]

    if not tr:
        # Determine illness name from facts or default
        facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == enc_id).all() if enc_id else []
        cc = next((f.label for f in facts if f.concept == "chief_complaint" and f.label), None)
        symptom_labels = [f.label for f in facts if f.label and (f.category in ("symptom", "chief_complaint") or f.concept in ("chief_complaint", "location", "character"))]
        symptoms_str = ", ".join(symptom_labels[:4]) if symptom_labels else (cc or "OPD Consultation")
        illness_name = payload.diagnosis or cc or (symptom_labels[0] if symptom_labels else "OPD Medical Consultation")

        tr = TreatmentRecord(
            patient_id=patient.id,
            illness_id=illness_key,
            illness_name=illness_name,
            symptoms=symptoms_str,
            diagnosis=payload.diagnosis or "Consultation Completed",
            treatment="Prescribed Treatment & Medical Advice",
            prescribed_medicines=meds_data,
            doctor_notes=payload.doctor_notes,
            doctor_name=payload.doctor_name,
            visit_date=datetime.now(timezone.utc).strftime("%d %b %Y"),
        )
        db.add(tr)
    else:
        if payload.diagnosis:
            tr.diagnosis = payload.diagnosis
            tr.illness_name = payload.diagnosis
        tr.prescribed_medicines = meds_data
        if payload.doctor_notes is not None:
            tr.doctor_notes = payload.doctor_notes
        if payload.doctor_name:
            tr.doctor_name = payload.doctor_name

    db.flush()
    log_event(
        db,
        "Prescription saved",
        f"Prescription saved ({len(meds_data)} medicines) for {patient.name} by {payload.doctor_name or 'Doctor'}",
        encounter_id=enc_id
    )
    db.commit()
    db.refresh(tr)
    return tr


@router.get("/encounters/{encounter_id}/prescription", response_model=Optional[TreatmentRecordOut])
def get_encounter_prescription(encounter_id: str, db: Session = Depends(get_db)):
    """Retrieve prescription and treatment record for a specific encounter."""
    illness_key = f"VISIT_{encounter_id[:8].upper()}"
    tr = db.query(TreatmentRecord).filter(TreatmentRecord.illness_id == illness_key).first()
    return tr
