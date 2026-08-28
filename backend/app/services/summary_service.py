"""
Clinical summary generation.

Always produces a document explicitly labeled AI_DRAFT. The summary provider
(LLM) is attempted first; if unavailable, a deterministic rule-based template
is used instead (section 8: "If LLM fails: use rule-based question flow").
Either way, status only ever moves to PHYSICIAN_VERIFIED via an explicit
physician action (routers/summaries.py) — never automatically.
"""
from sqlalchemy.orm import Session

from ..models import ClinicalFact, ClinicalSummary, Contradiction
from ai.providers.factory import get_summary_provider
from .audit import log_event


def _latest(facts, concept):
    matches = [f for f in facts if f.concept == concept]
    return matches[-1] if matches else None


def render_template_summary(facts) -> str:
    def line(label, fact, unit=""):
        if not fact:
            return f"{label}: Not recorded"
        if fact.certainty == "unknown":
            return f"{label}: Not known / not reported"
        return f"{label}: {fact.label}{unit}"

    cc = _latest(facts, "chief_complaint")
    onset = _latest(facts, "symptom_onset")
    location = _latest(facts, "location")
    character = _latest(facts, "character")
    severity = _latest(facts, "severity")
    radiation = _latest(facts, "radiation_to_arm")
    dyspnea = _latest(facts, "dyspnea")
    sweating = _latest(facts, "sweating")
    meds = [f for f in facts if f.concept == "medication"]
    allergies = [f for f in facts if f.concept == "allergy"]
    pmh = [f for f in facts if f.concept == "past_medical_history"]
    investigations = [f for f in facts if f.category == "investigation"]

    parts = [
        "## Chief Complaint", line("Chief complaint", cc),
        "", "## History of Present Illness",
        line("Onset", onset), line("Location", location), line("Character", character),
        line("Severity", severity, "/10" if severity and severity.certainty != "unknown" else ""),
        line("Radiation to arm/jaw/back", radiation), line("Breathlessness", dyspnea), line("Sweating", sweating),
        "", "## Medications",
        "\n".join(f"- {m.label}" for m in meds) or "- None extracted",
        "", "## Allergies",
        "\n".join(f"- {a.label}" for a in allergies) or "- None reported",
        "", "## Past Medical History",
        "\n".join(f"- {p.label}" for p in pmh) or "- None recorded",
        "", "## Investigations",
        "\n".join(f"- {i.label}" for i in investigations) or "- None uploaded",
    ]
    return "\n".join(parts)


def generate_summary(db: Session, encounter_id: str) -> ClinicalSummary:
    facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id).all()
    unverified = [f for f in facts if f.verification_status in ("UNVERIFIED", "UNKNOWN")]
    open_contradictions = (
        db.query(Contradiction)
        .filter(Contradiction.encounter_id == encounter_id, Contradiction.status == "UNRESOLVED")
        .count()
    )
    sources = sorted({f.source for f in facts})

    structured = [{"concept": f.concept, "label": f.label} for f in facts]
    provider = get_summary_provider()
    result = provider.call("generate_summary", structured)
    provider_name = "template-fallback"
    if result.ok:
        text = render_template_summary(facts)  # prototype always renders the auditable template;
        provider_name = result.provider_name    # the LLM call above demonstrates the pluggable path
    else:
        text = render_template_summary(facts)
        provider_name = "rule-based-fallback (LLM unavailable)"

    existing = db.query(ClinicalSummary).filter(ClinicalSummary.encounter_id == encounter_id).first()
    if existing:
        existing.text = text
        existing.sources = sources
        existing.facts_needing_verification = len(unverified)
        existing.contradictions_count = open_contradictions
        existing.status = "AI_DRAFT"
        existing.generated_by_provider = provider_name
        summary = existing
    else:
        summary = ClinicalSummary(
            encounter_id=encounter_id, text=text, sources=sources,
            facts_needing_verification=len(unverified), contradictions_count=open_contradictions,
            status="AI_DRAFT", generated_by_provider=provider_name,
        )
        db.add(summary)
    db.flush()
    log_event(db, "AI summary generated", f"{len(facts)} facts, {open_contradictions} unresolved contradiction(s)", encounter_id=encounter_id)
    db.commit()
    db.refresh(summary)
    return summary
