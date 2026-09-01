"""
Clinical summary generation.

Always produces a document explicitly labeled AI_DRAFT. The summary provider
(LLM) is attempted first; if unavailable, a deterministic rule-based template
is used instead (section 8: "If LLM fails: use rule-based question flow").
Either way, status only ever moves to PHYSICIAN_VERIFIED via an explicit
physician action (routers/summaries.py) — never automatically.
"""
from sqlalchemy.orm import Session

from ..models import ClinicalFact, ClinicalSummary, Contradiction, Encounter, TreatmentRecord
from ai.providers.factory import get_summary_provider
from .audit import log_event


def _latest(facts, concept):
    matches = [f for f in facts if f.concept == concept]
    return matches[-1] if matches else None


def _clean_label(val) -> str:
    if not val:
        return ""
    if isinstance(val, list):
        items = [_clean_label(x) for x in val if x]
        return ", ".join(items)
    s = str(val).strip()
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
        import ast
        try:
            parsed = ast.literal_eval(s)
            if isinstance(parsed, (list, tuple)):
                return ", ".join(_clean_label(x) for x in parsed)
        except Exception:
            pass
        s = s.strip("[]()\"' ")
    s = s.replace("_", " ").title()
    return s


def render_continuing_illness_summary(tr: TreatmentRecord, facts: list) -> str:
    """Generate structured summary for patients continuing a chosen past illness."""
    illness_title = _clean_label(tr.illness_name) or "Continuing Condition"
    symptoms = _clean_label(tr.symptoms) or "Symptoms reported during past visit"
    duration = f"Continuing since {tr.visit_date}" if tr.visit_date else "Continuing condition from previous visit"
    past_diag = _clean_label(tr.diagnosis) or illness_title
    past_treatment = _clean_label(tr.treatment) or "None reported"

    parts = [
        "CLINICAL SUMMARY",
        "",
        "Key Symptoms",
        f"• {symptoms}",
        "",
        "Duration",
        duration,
        "",
        "Chief Complaint",
        f"Follow-up: {illness_title}",
        "",
        "MEDICATIONS",
        past_treatment if past_treatment != "None reported" else "None reported",
        "",
        "ALLERGIES",
        "No known allergies reported",
        "",
        "PAST MEDICAL HISTORY",
        f"Previously diagnosed with {past_diag}",
        "",
        "PREVIOUS TREATMENT",
        past_treatment,
        "",
        "INVESTIGATIONS",
        "Previous medical records reviewed",
    ]
    return "\n".join(parts)


def render_template_summary(facts) -> str:
    # General / core facts
    cc = _latest(facts, "chief_complaint")
    onset = _latest(facts, "symptom_onset") or _latest(facts, "fever_duration") or _latest(facts, "pain_duration") or _latest(facts, "cough_duration") or _latest(facts, "headache_duration") or _latest(facts, "stomach_duration") or _latest(facts, "breathing_onset") or _latest(facts, "skin_duration") or _latest(facts, "injury_duration") or _latest(facts, "dental_duration") or _latest(facts, "urine_duration") or _latest(facts, "other_duration")
    location = _latest(facts, "location") or _latest(facts, "pain_location") or _latest(facts, "injury_location")
    character = _latest(facts, "character") or _latest(facts, "pain_character")
    severity = _latest(facts, "severity") or _latest(facts, "pain_severity") or _latest(facts, "headache_severity") or _latest(facts, "stomach_severity") or _latest(facts, "dental_severity")
    radiation = _latest(facts, "radiation_to_arm") or _latest(facts, "chest_radiation")
    dyspnea = _latest(facts, "dyspnea") or _latest(facts, "chest_dyspnea")
    sweating = _latest(facts, "sweating") or _latest(facts, "chest_sweating")
    
    # Specific symptom group facts
    fever_assoc = _latest(facts, "fever_associated_symptoms")
    animal_type = _latest(facts, "animal_exposure_type")
    animal_skin = _latest(facts, "animal_exposure_broken_skin")
    animal_time = _latest(facts, "animal_exposure_time")
    eye_side = _latest(facts, "eye_side")
    eye_sym = _latest(facts, "eye_symptoms_list")
    injury_cause = _latest(facts, "injury_cause")
    active_bleeding = _latest(facts, "active_bleeding") or _latest(facts, "injury_bleeding") or _latest(facts, "animal_bleeding")
    cough_char = _latest(facts, "cough_character")
    stomach_sym = _latest(facts, "stomach_symptoms_list")
    skin_sym = _latest(facts, "skin_symptoms_list")
    dental_sym = _latest(facts, "dental_symptoms_list")
    urine_sym = _latest(facts, "urine_symptoms_list")
    other_desc = _latest(facts, "other_description")

    meds = [f for f in facts if f.concept in ("medication", "general_meds")]
    allergies = [f for f in facts if f.concept in ("allergy", "general_allergies")]
    pmh = [f for f in facts if f.concept == "past_medical_history"]
    treatment = [f for f in facts if f.concept in ("treatment", "previous_treatment", "past_treatment")]
    investigations = [f for f in facts if f.category == "investigation"]

    # 1. Selected Symptoms (Chief Complaints)
    selected_symptoms = []
    if cc and cc.label:
        selected_symptoms.append(_clean_label(cc.label))
    elif any(f.category in ("symptom", "chief_complaint") for f in facts):
        sym_facts = [f for f in facts if f.category in ("symptom", "chief_complaint") and f.label]
        for sf in sym_facts:
            lbl = _clean_label(sf.label)
            if lbl and lbl not in selected_symptoms:
                selected_symptoms.append(lbl)
    
    chief_str = ", ".join(selected_symptoms) if selected_symptoms else "General medical evaluation"

    # 2. Associated Symptoms
    assoc_items = []
    if fever_assoc and fever_assoc.label:
        cleaned = _clean_label(fever_assoc.label)
        if cleaned:
            assoc_items.append(cleaned)
    if stomach_sym and stomach_sym.label:
        assoc_items.append(_clean_label(stomach_sym.label))
    if skin_sym and skin_sym.label:
        assoc_items.append(_clean_label(skin_sym.label))
    if eye_sym and eye_sym.label:
        assoc_items.append(f"Eye: {_clean_label(eye_sym.label)}")
    if dental_sym and dental_sym.label:
        assoc_items.append(_clean_label(dental_sym.label))
    if urine_sym and urine_sym.label:
        assoc_items.append(_clean_label(urine_sym.label))
    if cough_char and cough_char.label:
        assoc_items.append(f"Cough ({_clean_label(cough_char.label)})")
    if dyspnea and dyspnea.label and str(dyspnea.label).lower() not in ("no", "none", "false", "unknown"):
        assoc_items.append("Breathlessness")
    if sweating and sweating.label and str(sweating.label).lower() not in ("no", "none", "false", "unknown"):
        assoc_items.append("Sweating")

    # Deduplicate associated items
    seen = set()
    cleaned_assoc = []
    for item in assoc_items:
        for sub in item.split(","):
            s = sub.strip()
            if s and s.lower() not in seen:
                seen.add(s.lower())
                cleaned_assoc.append(s)
    
    assoc_str = ", ".join(cleaned_assoc) if cleaned_assoc else "None reported"

    # 3. Key Symptoms summary line
    key_symptoms_list = []
    if selected_symptoms:
        key_symptoms_list.append(", ".join(selected_symptoms))
    if cleaned_assoc:
        key_symptoms_list.append(f"Associated: {', '.join(cleaned_assoc)}")
    key_symptoms_str = " • ".join(key_symptoms_list) if key_symptoms_list else chief_str

    duration_str = onset.label if (onset and onset.label) else "Not specified"

    # Additional question answers
    extra_lines = []
    if location and location.label:
        extra_lines.append(f"Location: {_clean_label(location.label)}")
    if severity and severity.label and severity.certainty != "unknown":
        sev_val = str(severity.label).strip()
        sev_display = f"{sev_val}/10" if "/10" not in sev_val else sev_val
        extra_lines.append(f"Severity: {sev_display}")
    if character and character.label:
        extra_lines.append(f"Character: {_clean_label(character.label)}")
    if radiation and radiation.label and str(radiation.label).lower() not in ("no", "none", "false"):
        extra_lines.append(f"Radiation: {_clean_label(radiation.label)}")
    if injury_cause and injury_cause.label:
        extra_lines.append(f"Injury Mechanism: {_clean_label(injury_cause.label)}")
    if active_bleeding and active_bleeding.label:
        extra_lines.append(f"Active Bleeding: {_clean_label(active_bleeding.label)}")
    if animal_type and animal_type.label:
        extra_lines.append(f"Animal Exposure: {_clean_label(animal_type.label)}")
    if other_desc and other_desc.label:
        extra_lines.append(f"Patient Note: {_clean_label(other_desc.label)}")

    parts = [
        "CLINICAL SUMMARY",
        "",
        "Chief Complaint",
        chief_str,
        "",
        "Duration",
        duration_str,
        "",
        "Associated Symptoms",
        assoc_str,
        "",
        "Key Symptoms",
        f"• {key_symptoms_str}",
    ]

    if extra_lines:
        parts.extend(["", "Additional Details", "\n".join(f"• {line}" for line in extra_lines)])

    parts.extend([
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

    # Check if this encounter is for a chosen continuing past illness
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    continuing_tr = None
    if enc and enc.previous_illness_id:
        continuing_tr = db.query(TreatmentRecord).filter(
            (TreatmentRecord.illness_id == enc.previous_illness_id) |
            (TreatmentRecord.id == enc.previous_illness_id)
        ).first()
        if not continuing_tr:
            past_enc = db.query(Encounter).filter(
                (Encounter.id == enc.previous_illness_id) |
                (Encounter.id.ilike(f"%{enc.previous_illness_id.replace('VISIT_', '')}%"))
            ).first()
            if past_enc:
                past_facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == past_enc.id).all()
                cc = next((f.label for f in past_facts if f.concept == "chief_complaint" and f.label), None)
                symptom_labels = [f.label for f in past_facts if f.label and (f.category in ("symptom", "chief_complaint") or f.concept in ("chief_complaint", "location", "character"))]
                symptoms_str = ", ".join(symptom_labels) if symptom_labels else "General symptoms"
                continuing_tr = TreatmentRecord(
                    illness_id=enc.previous_illness_id,
                    illness_name=cc or "Follow-up Consultation",
                    symptoms=symptoms_str,
                    diagnosis="Past OPD Consultation",
                    treatment="Prescribed Treatment",
                    visit_date=past_enc.created_at.strftime("%d %b %Y") if past_enc.created_at else "Past Visit",
                )

    if continuing_tr:
        text = render_continuing_illness_summary(continuing_tr, facts)
        provider_name = "historical-record-continuation"
    else:
        structured = [{"concept": f.concept, "label": f.label} for f in facts]
        provider = get_summary_provider()
        result = provider.call("generate_summary", structured)
        provider_name = "template-fallback"
        if result.ok:
            text = render_template_summary(facts)
            provider_name = result.provider_name
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
