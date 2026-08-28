from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalSummary
from ..schemas import SummaryOut, SummaryEditIn
from ..services.summary_service import generate_summary
from ..services.audit import log_event

router = APIRouter(prefix="/api/summaries", tags=["summaries"])


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
    db.commit()
    db.refresh(s)
    return s
