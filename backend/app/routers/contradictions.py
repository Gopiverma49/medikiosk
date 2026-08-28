from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Contradiction
from ..schemas import ContradictionOut, ContradictionResolveIn
from ..services.contradiction_engine import detect_contradictions, resolve_contradiction

router = APIRouter(prefix="/api/contradictions", tags=["contradictions"])


@router.post("/detect", response_model=list[ContradictionOut])
def run_detection(encounter_id: str, db: Session = Depends(get_db)):
    return detect_contradictions(db, encounter_id)


@router.get("/{encounter_id}", response_model=list[ContradictionOut])
def list_contradictions(encounter_id: str, db: Session = Depends(get_db)):
    return db.query(Contradiction).filter(Contradiction.encounter_id == encounter_id).all()


@router.post("/{contradiction_id}/resolve", response_model=ContradictionOut)
def resolve(contradiction_id: str, payload: ContradictionResolveIn, db: Session = Depends(get_db)):
    try:
        return resolve_contradiction(
            db, contradiction_id, payload.decision, payload.resolved_by,
            payload.kept_fact_id, payload.discarded_fact_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
