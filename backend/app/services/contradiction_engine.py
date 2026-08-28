"""
Contradiction detection engine.

Compares clinical facts collected from different sources for the same encounter
and raises a Contradiction row when they conflict. The engine NEVER decides
which source is correct — that is exclusively a physician action performed via
POST /api/contradictions/{id}/resolve (see routers/contradictions.py).
"""
from typing import List
from sqlalchemy.orm import Session

from ..models import ClinicalFact, Contradiction, ContradictionResolution, VerificationStatus
from .audit import log_event

CONTRADICTION_TYPES = [
    "VALUE_CONFLICT", "TEMPORAL_CONFLICT", "MEDICATION_CONFLICT", "ALLERGY_CONFLICT",
    "DEMOGRAPHIC_CONFLICT", "DOCUMENT_PATIENT_MISMATCH", "DUPLICATE_INFORMATION",
]


def _facts(db: Session, encounter_id: str, concept: str = None):
    q = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id)
    if concept:
        q = q.filter(ClinicalFact.concept == concept)
    return q.all()


def _record(db: Session, encounter_id: str, ctype: str, fact_a: ClinicalFact, fact_b: ClinicalFact, desc_a: str, desc_b: str):
    existing = (
        db.query(Contradiction)
        .filter(Contradiction.encounter_id == encounter_id, Contradiction.type == ctype,
                Contradiction.fact_a_id == fact_a.id, Contradiction.fact_b_id == fact_b.id)
        .first()
    )
    if existing:
        return existing
    c = Contradiction(
        encounter_id=encounter_id, type=ctype, fact_a_id=fact_a.id, fact_b_id=fact_b.id,
        description_a=desc_a, description_b=desc_b, status="UNRESOLVED",
    )
    db.add(c)
    db.flush()
    log_event(db, "Contradiction detected", f"{ctype}: {desc_a} vs {desc_b}", encounter_id=encounter_id)
    return c


def detect_contradictions(db: Session, encounter_id: str) -> List[Contradiction]:
    # 1. Medication conflict: patient reports no meds, but a document lists one.
    no_meds = next((f for f in _facts(db, encounter_id, "medication_reported_none") if f.value is True), None)
    if no_meds:
        for med in _facts(db, encounter_id, "medication"):
            if med.source == "UPLOADED_DOCUMENT":
                _record(db, encounter_id, "MEDICATION_CONFLICT", no_meds, med,
                        "Patient reported: no current medication", f"Uploaded document: {med.label}")

    # 2. Allergy conflict: patient reports no known allergy, but a document lists one.
    no_allergy = next((f for f in _facts(db, encounter_id, "allergy_reported_none") if f.value is True), None)
    if no_allergy:
        for allergy in _facts(db, encounter_id, "allergy"):
            if allergy.source == "UPLOADED_DOCUMENT":
                _record(db, encounter_id, "ALLERGY_CONFLICT", no_allergy, allergy,
                        "Patient reports no known drug allergy.", f"Previous document mentions: {allergy.label} allergy.")

    # 3. Temporal conflict: symptom_onset reported more than once with different values.
    onsets = _facts(db, encounter_id, "symptom_onset")
    if len(onsets) > 1:
        distinct_values = {str(o.value) for o in onsets}
        if len(distinct_values) > 1:
            _record(db, encounter_id, "TEMPORAL_CONFLICT", onsets[0], onsets[-1],
                    f"Onset reported as: {onsets[0].label}", f"Later reported as: {onsets[-1].label}")

    db.commit()
    return db.query(Contradiction).filter(Contradiction.encounter_id == encounter_id).all()


def resolve_contradiction(db: Session, contradiction_id: str, decision: str, resolved_by: str,
                           kept_fact_id: str = None, discarded_fact_id: str = None) -> Contradiction:
    c = db.query(Contradiction).filter(Contradiction.id == contradiction_id).first()
    if not c:
        raise ValueError("Contradiction not found")
    c.status = "RESOLVED"
    db.add(ContradictionResolution(
        contradiction_id=c.id, decision=decision, resolved_by=resolved_by,
        kept_fact_id=kept_fact_id, discarded_fact_id=discarded_fact_id,
    ))
    if kept_fact_id:
        f = db.query(ClinicalFact).filter(ClinicalFact.id == kept_fact_id).first()
        if f:
            f.verification_status = VerificationStatus.PHYSICIAN_VERIFIED
            f.verified_by = resolved_by
    if discarded_fact_id:
        f = db.query(ClinicalFact).filter(ClinicalFact.id == discarded_fact_id).first()
        if f:
            f.verification_status = VerificationStatus.REJECTED
            f.verified_by = resolved_by
    log_event(db, "Contradiction resolved", f"{c.type}: {decision}", actor=resolved_by, encounter_id=c.encounter_id)
    db.commit()
    db.refresh(c)
    return c
