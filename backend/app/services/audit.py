from sqlalchemy.orm import Session
from ..models import AuditLog


def log_event(db: Session, event: str, detail: str = "", actor: str = "system", encounter_id: str = None):
    """Central audit sink. Called from every service that performs a clinically
    meaningful action (see docs/ARCHITECTURE.md 'Auditability'). Deliberately
    avoids storing raw sensitive payloads — only event/detail strings."""
    entry = AuditLog(event=event, detail=detail, actor=actor, encounter_id=encounter_id)
    db.add(entry)
    db.flush()
    return entry
