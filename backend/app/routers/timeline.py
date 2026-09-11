from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import ClinicalFact, Encounter

router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("/{patient_id}")
def get_timeline(patient_id: str, db: Session = Depends(get_db)):
    encounter_ids = [e.id for e in db.query(Encounter).filter(Encounter.patient_id == patient_id).all()]
    if not encounter_ids:
        return []

    facts = (
        db.query(ClinicalFact)
        .filter(ClinicalFact.encounter_id.in_(encounter_ids))
        .order_by(ClinicalFact.created_at.asc())
        .all()
    )

    return [
        {
            "timestamp": f.created_at, "concept": f.concept,
            "value": None if f.certainty == "unknown" else f.value,
            "label": f.label, "source": f.source, "verification_status": f.verification_status,
        }
        for f in facts
    ]
