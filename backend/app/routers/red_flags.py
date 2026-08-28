from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import RedFlagRule, RedFlagRuleVersion, RedFlagEvent, TriageEvent
from ..schemas import RedFlagRuleIn, RedFlagRuleOut, RedFlagTestIn
from ..services.red_flag_engine import evaluate_red_flags, test_rule
from ..services.audit import log_event

router = APIRouter(prefix="/api/red-flags", tags=["red-flags"])
triage_router = APIRouter(prefix="/api/triage", tags=["triage"])


@router.get("/rules", response_model=list[RedFlagRuleOut])
def list_rules(db: Session = Depends(get_db)):
    return db.query(RedFlagRule).all()


@router.post("/rules", response_model=RedFlagRuleOut)
def create_rule(payload: RedFlagRuleIn, db: Session = Depends(get_db)):
    if db.query(RedFlagRule).filter(RedFlagRule.rule_id == payload.rule_id).first():
        raise HTTPException(status_code=400, detail="rule_id already exists")
    rule = RedFlagRule(**payload.model_dump(), version="1.0")
    db.add(rule)
    db.flush()
    db.add(RedFlagRuleVersion(rule_id=rule.rule_id, version="1.0", conditions_snapshot=rule.conditions))
    log_event(db, "Red-flag rule created", rule.rule_id)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/rules/{rule_id}", response_model=RedFlagRuleOut)
def update_rule(rule_id: str, payload: RedFlagRuleIn, db: Session = Depends(get_db)):
    rule = db.query(RedFlagRule).filter(RedFlagRule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    major, minor = (rule.version.split(".") + ["0"])[:2]
    rule.version = f"{major}.{int(minor) + 1}"
    rule.name = payload.name
    rule.enabled = payload.enabled
    rule.priority = payload.priority
    rule.action = payload.action
    rule.conditions = payload.conditions
    db.add(RedFlagRuleVersion(rule_id=rule.rule_id, version=rule.version, conditions_snapshot=rule.conditions))
    log_event(db, "Red-flag rule edited", f"{rule.rule_id} -> v{rule.version}")
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/rules/{rule_id}/test")
def test_rule_endpoint(rule_id: str, payload: RedFlagTestIn, db: Session = Depends(get_db)):
    rule = db.query(RedFlagRule).filter(RedFlagRule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    fires = test_rule(rule.conditions, payload.inputs)
    log_event(db, "Red-flag rule tested", f"{rule_id}: fires={fires}")
    db.commit()
    return {"rule_id": rule_id, "inputs": payload.inputs, "fires": fires,
            "priority": rule.priority if fires else None}


@router.post("/rules/{rule_id}/disable", response_model=RedFlagRuleOut)
def disable_rule(rule_id: str, db: Session = Depends(get_db)):
    rule = db.query(RedFlagRule).filter(RedFlagRule.rule_id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule.enabled = False
    log_event(db, "Red-flag rule disabled", rule_id)
    db.commit()
    db.refresh(rule)
    return rule


@triage_router.post("/evaluate")
def evaluate(encounter_id: str, db: Session = Depends(get_db)):
    events = evaluate_red_flags(db, encounter_id)
    return {"events": [{"rule_id": e.rule_id, "name": e.rule_name, "priority": e.priority, "action": e.action} for e in events]}


@triage_router.get("/{encounter_id}")
def triage_status(encounter_id: str, db: Session = Depends(get_db)):
    triage = db.query(TriageEvent).filter(TriageEvent.encounter_id == encounter_id).first()
    events = db.query(RedFlagEvent).filter(RedFlagEvent.encounter_id == encounter_id).all()
    return {
        "priority": triage.priority if triage else "ROUTINE",
        "red_flags": [{"rule_id": e.rule_id, "name": e.rule_name, "priority": e.priority} for e in events],
    }
