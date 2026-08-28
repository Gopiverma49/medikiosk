from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AuditLog
from ai.providers.factory import set_force_fail, _FORCE_FAIL

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/audit-log")
def get_audit_log(limit: int = 200, db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return rows


@router.get("/ai-status")
def get_ai_status():
    return _FORCE_FAIL


@router.post("/ai-status/{provider}/toggle")
def toggle_ai_status(provider: str):
    """Simulate an AI provider outage on demand — used by the admin UI and by
    the failure-testing pytest suite (see backend/tests/test_ai_failures.py)."""
    current = _FORCE_FAIL.get(provider, False)
    set_force_fail(provider, not current)
    return {"provider": provider, "force_fail": not current}
