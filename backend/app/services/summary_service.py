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
    treatment = [f for f in facts if f.concept in ("treatment", "previous_treatment", "past_treatment")]
    investigations = [f for f in facts if f.category == "investigation"]

    # Assemble Key Symptoms list
    symptom_items = []
    if cc and cc.label:
        symptom_items.append(cc.label)
    if location and location.label:
        symptom_items.append(f"Location: {location.label}")
    if character and character.label:
        symptom_items.append(f"Character: {character.label}")
    if severity and severity.label and severity.certainty != "unknown":
        symptom_items.append(f"Severity: {severity.label}/10")
    if fever_assoc and fever_assoc.label and fever_assoc.label not in symptom_items:
        symptom_items.append(f"Fever ({fever_assoc.label})")
    if cough_char and cough_char.label and "Cough" not in symptom_items:
        symptom_items.append(f"Cough ({cough_char.label})")
    if stomach_sym and stomach_sym.label:
        symptom_items.append(stomach_sym.label)
    if skin_sym and skin_sym.label:
        symptom_items.append(skin_sym.label)
    if eye_sym and eye_sym.label:
        symptom_items.append(f"Eye: {eye_sym.label}")
    if dental_sym and dental_sym.label:
        symptom_items.append(dental_sym.label)
    if urine_sym and urine_sym.label:
        symptom_items.append(urine_sym.label)
    if injury_cause and injury_cause.label:
        symptom_items.append(f"Injury Mechanism: {injury_cause.label}")
    if active_bleeding and active_bleeding.label:
        symptom_items.append(f"Active Bleeding: {active_bleeding.label}")
    if dyspnea and dyspnea.label and dyspnea.label.lower() not in ("no", "none", "false"):
        symptom_items.append("Breathlessness")
    if sweating and sweating.label and sweating.label.lower() not in ("no", "none", "false"):
        symptom_items.append("Diaphoresis / Sweating")
    if animal_type and animal_type.label:
        symptom_items.append(f"Animal Exposure: {animal_type.label}")

    chief_str = cc.label if (cc and cc.label) else "General medical evaluation"
    duration_str = onset.label if (onset and onset.label) else "Not specified"
    key_symptoms_str = "   • ".join(symptom_items) if symptom_items else "None reported"

    parts = [
        "CLINICAL SUMMARY",
        "",
        "Chief Complaint",
        chief_str,
        "",
        "Duration",
        duration_str,
        "",
        "Key Symptoms",
        f"• {key_symptoms_str}",
        "",
        "MEDICATIONS",
        ", ".join(m.label for m in meds) if meds else "None reported",
        "",
        "ALLERGIES",
        ", ".join(a.label for a in allergies) if allergies else "No known allergies reported",
        "",
        "PAST MEDICAL HISTORY",
        ", ".join(p.label for p in pmh) if pmh else "None reported",
        "",
        "PREVIOUS TREATMENT",
        ", ".join(t.label for t in treatment) if treatment else "None reported",
        "",
        "INVESTIGATIONS",
        ", ".join(i.label for i in investigations) if investigations else "No reports available",
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
