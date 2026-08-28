"""
Configurable red-flag rule engine.

Rules are pure data (see models.RedFlagRule.conditions), never hard-coded into
application/UI code. A rule fires when ALL of `conditions.all` are true AND
(if present) at least one of `conditions.any` is true.

    {
      "all": [{"concept": "chest_pain", "operator": "equals", "value": true}],
      "any": [
        {"concept": "dyspnea", "operator": "equals", "value": true},
        {"concept": "radiation_to_arm", "operator": "equals", "value": true}
      ]
    }
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from ..models import ClinicalFact, RedFlagRule, RedFlagEvent, TriageEvent
from .audit import log_event

OPERATORS = {
    "equals": lambda v, target: v == target,
    "gte": lambda v, target: float(v) >= float(target),
    "lte": lambda v, target: float(v) <= float(target),
    "gt": lambda v, target: float(v) > float(target),
    "lt": lambda v, target: float(v) < float(target),
}


def build_concept_map(db: Session, encounter_id: str) -> Dict[str, Any]:
    facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id).all()
    out = {}
    for f in facts:
        if f.value is not None:
            out[f.concept] = f.value
    return out


def eval_condition(condition: dict, concept_map: Dict[str, Any]) -> bool:
    concept = condition.get("concept")
    if concept not in concept_map:
        return False
    op = OPERATORS.get(condition.get("operator", "equals"))
    if op is None:
        return False
    try:
        return bool(op(concept_map[concept], condition.get("value")))
    except (TypeError, ValueError):
        return False


def eval_rule(conditions: dict, concept_map: Dict[str, Any]) -> bool:
    all_conds: List[dict] = conditions.get("all", [])
    any_conds: List[dict] = conditions.get("any", [])
    all_ok = all(eval_condition(c, concept_map) for c in all_conds) if all_conds else True
    any_ok = any(eval_condition(c, concept_map) for c in any_conds) if any_conds else True
    return all_ok and any_ok


def evaluate_red_flags(db: Session, encounter_id: str) -> List[RedFlagEvent]:
    """Evaluate all enabled rules against the current fact set for an encounter,
    recording new RedFlagEvent rows (idempotent per rule per encounter) and a
    TriageEvent for the highest-priority outcome."""
    concept_map = build_concept_map(db, encounter_id)
    rules = db.query(RedFlagRule).filter(RedFlagRule.enabled == True).all()  # noqa: E712
    new_events = []
    for rule in rules:
        if eval_rule(rule.conditions, concept_map):
            existing = (
                db.query(RedFlagEvent)
                .filter(RedFlagEvent.encounter_id == encounter_id, RedFlagEvent.rule_id == rule.rule_id)
                .first()
            )
            if not existing:
                ev = RedFlagEvent(
                    encounter_id=encounter_id, rule_id=rule.rule_id, rule_name=rule.name,
                    priority=rule.priority, action=rule.action,
                )
                db.add(ev)
                db.flush()
                new_events.append(ev)
                log_event(db, "Red flag triggered", f"{rule.rule_id}: {rule.name} ({rule.priority})", encounter_id=encounter_id)

    all_events = db.query(RedFlagEvent).filter(RedFlagEvent.encounter_id == encounter_id).all()
    if all_events:
        top_priority = "HIGH" if any(e.priority == "HIGH" for e in all_events) else "MEDIUM"
        existing_triage = db.query(TriageEvent).filter(TriageEvent.encounter_id == encounter_id).first()
        if not existing_triage:
            db.add(TriageEvent(encounter_id=encounter_id, priority=top_priority, reason="Red-flag rule engine"))
    db.commit()
    return all_events


def test_rule(conditions: dict, inputs: dict) -> bool:
    """Used by POST /api/red-flags/rules/{id}/test — evaluates the SAME engine
    function against arbitrary inputs, so admin testing reflects production behavior."""
    return eval_rule(conditions, inputs)
