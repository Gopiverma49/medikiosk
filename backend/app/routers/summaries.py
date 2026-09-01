from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalSummary, Encounter, TreatmentRecord, ClinicalFact
from ..schemas import SummaryOut, SummaryEditIn
from ..services.summary_service import generate_summary
from ..services.audit import log_event

router = APIRouter(prefix="/api/summaries", tags=["summaries"])


def _sync_treatment_record_from_summary(db: Session, summary: ClinicalSummary, status_desc: str, doctor_name: str):
    """Persist or update TreatmentRecord in database when summary is accepted or edited."""
    enc = db.query(Encounter).filter(Encounter.id == summary.encounter_id).first()
    if not enc or not enc.patient_id:
        return

    facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == enc.id).all()
    cc = next((f.label for f in facts if f.concept == "chief_complaint" and f.label), None)
    symptom_labels = [
        f.label for f in facts 
        if f.label and (f.category in ("symptom", "chief_complaint") or f.concept in ("chief_complaint", "location", "character"))
    ]
    if not symptom_labels and facts:
        symptom_labels = [f.label or f.concept for f in facts if f.label or f.concept]
    symptoms_str = ", ".join(symptom_labels[:4]) if symptom_labels else "General symptoms evaluation"
    illness_title = cc or (symptom_labels[0] if symptom_labels else "OPD Medical Consultation")

    existing_tr = db.query(TreatmentRecord).filter(
        TreatmentRecord.patient_id == enc.patient_id,
        TreatmentRecord.illness_id == f"VISIT_{enc.id[:8].upper()}"
    ).first()

    visit_date = enc.created_at.strftime("%d %b %Y") if enc.created_at else datetime.now(timezone.utc).strftime("%d %b %Y")

    if not existing_tr:
        tr = TreatmentRecord(
            patient_id=enc.patient_id,
            illness_id=f"VISIT_{enc.id[:8].upper()}",
            illness_name=illness_title,
            symptoms=symptoms_str,
            diagnosis=status_desc,
            treatment=summary.text or "Prescribed Treatment & Medical Advice",
            doctor_name=doctor_name,
            visit_date=visit_date,
        )
        db.add(tr)
    else:
        existing_tr.treatment = summary.text or existing_tr.treatment
        if doctor_name:
            existing_tr.doctor_name = doctor_name
        existing_tr.illness_name = illness_title
        existing_tr.symptoms = symptoms_str
        existing_tr.diagnosis = status_desc


@router.post("/generate", response_model=SummaryOut)
def generate(encounter_id: str, db: Session = Depends(get_db)):
    return generate_summary(db, encounter_id)


@router.get("/{encounter_id}", response_model=SummaryOut)
def get_summary(encounter_id: str, db: Session = Depends(get_db)):
    s = db.query(ClinicalSummary).filter(ClinicalSummary.encounter_id == encounter_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="No summary generated yet")
    return s


@router.post("/{summary_id}/confirm", response_model=SummaryOut)
def confirm(summary_id: str, confirmed_by: str = "Dr. (demo) Physician", db: Session = Depends(get_db)):
    s = db.query(ClinicalSummary).filter(ClinicalSummary.id == summary_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")
    s.status = "PHYSICIAN_VERIFIED"
    log_event(db, "Summary confirmed by physician", "status -> PHYSICIAN_VERIFIED", actor=confirmed_by, encounter_id=s.encounter_id)
    _sync_treatment_record_from_summary(db, s, "Physician Verified Summary", confirmed_by)
    db.commit()
    db.refresh(s)
    return s


@router.post("/{summary_id}/reject", response_model=SummaryOut)
def reject(summary_id: str, rejected_by: str = "Dr. (demo) Physician", db: Session = Depends(get_db)):
    s = db.query(ClinicalSummary).filter(ClinicalSummary.id == summary_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")
    s.status = "REJECTED"
    log_event(db, "Summary rejected by physician", "", actor=rejected_by, encounter_id=s.encounter_id)

    # Reject doesn't save records to database; delete any treatment record created for this encounter
    enc = db.query(Encounter).filter(Encounter.id == s.encounter_id).first()
    if enc and enc.patient_id:
        db.query(TreatmentRecord).filter(
            TreatmentRecord.patient_id == enc.patient_id,
            TreatmentRecord.illness_id == f"VISIT_{enc.id[:8].upper()}"
        ).delete(synchronize_session=False)

    db.commit()
    db.refresh(s)
    return s


@router.post("/{summary_id}/edit", response_model=SummaryOut)
def edit(summary_id: str, payload: SummaryEditIn, db: Session = Depends(get_db)):
    s = db.query(ClinicalSummary).filter(ClinicalSummary.id == summary_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Summary not found")
    s.text = payload.text
    s.status = "PHYSICIAN_CORRECTED"
    log_event(db, "Summary edited by physician", "", actor=payload.edited_by, encounter_id=s.encounter_id)
    _sync_treatment_record_from_summary(db, s, "Physician Corrected Summary", payload.edited_by)
    db.commit()
    db.refresh(s)
    return s

