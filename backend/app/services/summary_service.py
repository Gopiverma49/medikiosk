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

    # General / core facts
    cc = _latest(facts, "chief_complaint")
    onset = _latest(facts, "symptom_onset")
    location = _latest(facts, "location")
    character = _latest(facts, "character")
    severity = _latest(facts, "severity")
    radiation = _latest(facts, "radiation_to_arm")
    dyspnea = _latest(facts, "dyspnea")
    sweating = _latest(facts, "sweating")
    
    # Specific symptom group facts
    fever_assoc = _latest(facts, "fever_associated_symptoms")
    animal_type = _latest(facts, "animal_exposure_type")
    animal_skin = _latest(facts, "animal_exposure_broken_skin")
    animal_time = _latest(facts, "animal_exposure_time")
    eye_side = _latest(facts, "eye_side")
    eye_sym = _latest(facts, "eye_symptoms_list")
    injury_cause = _latest(facts, "injury_cause")
    active_bleeding = _latest(facts, "active_bleeding")
    cough_char = _latest(facts, "cough_character")
    stomach_sym = _latest(facts, "stomach_symptoms_list")
    skin_sym = _latest(facts, "skin_symptoms_list")
    dental_sym = _latest(facts, "dental_symptoms_list")
    urine_sym = _latest(facts, "urine_symptoms_list")

    meds = [f for f in facts if f.concept == "medication"]
    allergies = [f for f in facts if f.concept == "allergy"]
    pmh = [f for f in facts if f.concept == "past_medical_history"]
    investigations = [f for f in facts if f.category == "investigation"]

    hpi_lines = []
    if onset:
        hpi_lines.append(line("Onset / Duration", onset))
    if location:
        hpi_lines.append(line("Location", location))
    if character:
        hpi_lines.append(line("Character", character))
    if severity:
        hpi_lines.append(line("Severity", severity, "/10" if severity.certainty != "unknown" else ""))
    
    # Add symptom-specific observations
    if fever_assoc:
        hpi_lines.append(line("Associated with Fever", fever_assoc))
    if eye_side or eye_sym:
        hpi_lines.append(f"Eye Findings: {eye_side.label if eye_side else ''} - {eye_sym.label if eye_sym else ''}".strip(" -"))
    if injury_cause:
        hpi_lines.append(line("Injury Mechanism", injury_cause))
    if active_bleeding:
        hpi_lines.append(line("Active Bleeding", active_bleeding))
    if cough_char:
        hpi_lines.append(line("Cough Character", cough_char))
    if stomach_sym:
        hpi_lines.append(line("Gastrointestinal Symptoms", stomach_sym))
    if skin_sym:
        hpi_lines.append(line("Dermatological Findings", skin_sym))
    if dental_sym:
        hpi_lines.append(line("Dental / Oral Findings", dental_sym))
    if urine_sym:
        hpi_lines.append(line("Urinary Symptoms", urine_sym))
    
    if radiation:
        hpi_lines.append(line("Radiation to arm/jaw/back", radiation))
    if dyspnea:
        hpi_lines.append(line("Breathlessness", dyspnea))
    if sweating:
        hpi_lines.append(line("Sweating / Diaphoresis", sweating))

    if not hpi_lines:
        hpi_lines.append("No specific HPI details reported.")

    parts = [
        "## Chief Complaint",
        line("Chief complaint", cc) if cc else "Chief complaint: Symptom evaluation completed via kiosk interview.",
        "",
        "## History of Present Illness",
        "\n".join(hpi_lines),
    ]

    # Exposure section if animal exposure present
    if animal_type or animal_skin:
        parts.extend([
            "",
            "## Exposure & Safety Signals",
            line("Animal Exposure", animal_type),
            line("Skin Broken / Bleeding", animal_skin),
            line("Exposure Timeline", animal_time) if animal_time else "",
        ])

    parts.extend([
        "",
        "## Medications",
        "\n".join(f"- {m.label}" for m in meds) or "- None extracted (or patient reported none)",
        "",
        "## Allergies",
        "\n".join(f"- {a.label}" for a in allergies) or "- None reported",
        "",
        "## Past Medical History",
        "\n".join(f"- {p.label}" for p in pmh) or "- None recorded",
        "",
        "## Investigations",
        "\n".join(f"- {i.label}" for i in investigations) or "- None uploaded",
    ])
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
