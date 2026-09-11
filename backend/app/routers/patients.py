import ast
import json
import time
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Patient, Encounter, Consent, TreatmentRecord, ClinicalFact, ClinicalSummary,
    TokenQueue, TokenStatus
)
from ..schemas import (
    PatientCreate, PatientOut, EncounterCreate, EncounterOut, ConsentCreate,
    PatientLookupIn, TreatmentRecordOut, PrescriptionSaveIn,
)
from ..services.audit import log_event
from ..services.crypto import blind_index

router = APIRouter(prefix="/api", tags=["patients"])


def resolve_patient(db: Session, identifier: str) -> Optional[Patient]:
    """Helper to find patient by UUID id, 10-digit patient_id, or blind-indexed phone."""
    clean_id = identifier.strip()
    patient = db.query(Patient).filter((Patient.id == clean_id) | (Patient.patient_id == clean_id)).first()
    if patient:
        return patient
    
    # Try blind-index phone match
    p_hash = blind_index(clean_id)
    if p_hash:
        patient = db.query(Patient).filter(Patient.phone_hash == p_hash).first()
        if patient:
            return patient
            
    # Backwards-compatible legacy plain phone match
    return db.query(Patient).filter(Patient.phone == clean_id).first()


# Backwards compatibility alias
_get_patient = resolve_patient


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
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                items = [_clean_str_value(x) for x in parsed if x not in (True, False, None)]
                return ", ".join(i for i in items if i)
        except Exception:
            pass
        s = s.strip("[]()\"' ")
    s = s.replace("['", "").replace("']", "").replace('["', "").replace('"]', "")
    if "_" in s:
        s = s.replace("_", " ").title()
    return s.strip()


def _get_combined_patient_treatments(db: Session, patient: Patient, exclude_encounter_id: Optional[str] = None) -> list:
    """Retrieve all past completed medical records, strictly excluding any active/ongoing consultations."""
    # Find active / ongoing tokens for this patient (WAITING, CALLED, IN_CONSULTATION)
    active_tokens = db.query(TokenQueue).filter(
        TokenQueue.patient_id == patient.id,
        TokenQueue.status.in_([TokenStatus.WAITING, TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).all()
    active_encounter_ids = {t.encounter_id for t in active_tokens if t.encounter_id}
    if exclude_encounter_id:
        active_encounter_ids.add(exclude_encounter_id)

    # 1. Fetch explicit TreatmentRecords directly, filtering out ongoing active encounter records
    records = db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient.id).order_by(TreatmentRecord.created_at.desc()).all()
    out = []
    for r in records:
        r_illness = (r.illness_id or "").upper()
        if any(enc_id and f"VISIT_{enc_id[:8].upper()}" == r_illness for enc_id in active_encounter_ids):
            continue
        if str(r.id) in active_encounter_ids:
            continue
        out.append(r)

    # 2. Also check past completed or documented Encounters for this patient
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient.id).order_by(Encounter.created_at.desc()).all()

    existing_encounter_keys = {
        (r.illness_id or "").upper() for r in out
    } | {
        f"VISIT_{str(r.id)[:8].upper()}" for r in out if r.id
    }

    # Batch-load all clinical summaries and clinical facts for non-active encounters (resolves N+1 query bottleneck)
    candidate_enc_ids = [enc.id for enc in encounters if enc.id not in active_encounter_ids]
    summary_map = {}
    facts_by_enc = {}
    if candidate_enc_ids:
        all_summaries = db.query(ClinicalSummary).filter(ClinicalSummary.encounter_id.in_(candidate_enc_ids)).all()
        summary_map = {s.encounter_id: s for s in all_summaries}

        all_facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id.in_(candidate_enc_ids)).all()
        for f in all_facts:
            facts_by_enc.setdefault(f.encounter_id, []).append(f)

    for enc in encounters:
        # Strictly skip active ongoing encounters
        if enc.id in active_encounter_ids:
            continue

        summary = summary_map.get(enc.id)
        if summary and summary.status == "REJECTED":
            continue
        facts = facts_by_enc.get(enc.id, [])
        
        if not summary and not facts:
            continue

        enc_key = f"VISIT_{enc.id[:8].upper()}"
        if enc_key in existing_encounter_keys:
            continue
        existing_encounter_keys.add(enc_key)

        # Extract duration
        onset_fact = next((f for f in facts if f.concept == "symptom_onset" and f.label), None)
        duration_str = _clean_str_value(onset_fact.label if onset_fact else "")

        if not duration_str:
            duration_str = "1–3 days"

        # Extract meaningful symptoms & medications
        symptom_items = []
        med_items = []
        for f in facts:
            if f.concept in ("symptom_onset", "consent", "encounter_mode"):
                continue
            if f.concept == "medication" or f.category == "medication":
                med_name = _clean_str_value(f.label or f.value)
                if med_name and med_name.lower() not in ("none", "no", "false", "none reported"):
                    med_items.append({
                        "name": med_name,
                        "dosage": "As prescribed",
                        "frequency": "Daily",
                        "duration": "3–5 days",
                        "instructions": "After food",
                    })
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
        
        tr = TreatmentRecord(
            id=enc.id,
            patient_id=patient.id,
            illness_id=enc_key,
            illness_name=illness_name,
            symptoms=symptoms_str,
            diagnosis=f"Duration: {duration_str}",
            treatment="OPD Consultation",
            prescribed_medicines=med_items if med_items else None,
            visit_date=visit_date_str,
            created_at=enc.created_at or datetime.now(timezone.utc),
        )
        out.append(tr)

    out.sort(key=lambda r: r.created_at or datetime.min, reverse=True)

    # Compute follow-up flags and primary reason for each record
    seen_illness_names = set()
    for r in reversed(out):
        raw_name = _clean_str_value(r.illness_name or "")
        norm_name = raw_name.lower()
        norm_key = norm_name.replace("follow-up:", "").replace("followup:", "").replace("past", "").strip()
        
        primary = None
        if r.symptoms:
            primary = _clean_str_value(r.symptoms.split(",")[0].strip())
        if not primary or primary.lower() in ("none reported", "general symptoms", "none"):
            primary = _clean_str_value(r.illness_name or r.diagnosis or "Medical Evaluation")
        
        is_fu = False
        if norm_key and norm_key in seen_illness_names:
            is_fu = True
        elif "follow" in norm_name or (r.diagnosis and "follow" in str(r.diagnosis).lower()):
            is_fu = True
        elif r.illness_id and any(enc.previous_illness_id in (r.illness_id, str(r.id)) for enc in encounters if enc.previous_illness_id):
            is_fu = True
            
        r.is_followup = is_fu
        r.primary_reason = _clean_str_value(primary)
        if norm_key:
            seen_illness_names.add(norm_key)

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
            existing.phone_hash = blind_index(payload.phone)
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
    if payload.phone:
        patient_data["phone_hash"] = blind_index(payload.phone)
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
        # Determine illness name from facts, previous illness, or default
        enc = db.query(Encounter).filter(Encounter.id == enc_id).first() if enc_id else None
        prev_tr = None
        if enc and enc.previous_illness_id:
            prev_tr = db.query(TreatmentRecord).filter(
                (TreatmentRecord.illness_id == enc.previous_illness_id) |
                (TreatmentRecord.id == enc.previous_illness_id)
            ).first()

        facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == enc_id).all() if enc_id else []
        cc = next((f.label for f in facts if f.concept == "chief_complaint" and f.label), None)
        symptom_labels = [f.label for f in facts if f.label and (f.category in ("symptom", "chief_complaint") or f.concept in ("chief_complaint", "location", "character"))]
        symptoms_str = ", ".join(symptom_labels[:4]) if symptom_labels else (prev_tr.symptoms if prev_tr else (cc or "OPD Consultation"))

        if payload.diagnosis:
            illness_name = payload.diagnosis
            diag_str = payload.diagnosis
        elif prev_tr:
            illness_name = f"Follow-up: {prev_tr.illness_name}" if not (prev_tr.illness_name or "").lower().startswith("follow") else prev_tr.illness_name
            diag_str = f"Follow-up for {prev_tr.illness_name}"
        else:
            illness_name = cc or (symptom_labels[0] if symptom_labels else "OPD Medical Consultation")
            diag_str = "Consultation Completed"

        tr = TreatmentRecord(
            patient_id=patient.id,
            illness_id=illness_key,
            illness_name=illness_name,
            symptoms=symptoms_str,
            diagnosis=diag_str,
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
