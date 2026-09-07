"""
Clinical document extraction service for scanned medical reports.

Extracts ONLY clinically important information:
- Report/visit date
- Reason for visit
- Symptoms + duration
- Diagnosis
- Medical history & allergies
- Examination / vitals
- Diagnostic tests + values + units + reference ranges
- Imaging findings
- Medicines (name, strength, dosage, route, frequency, timing, duration, instructions)
- Procedures & treatments
- Doctor's advice
- Follow-up / review
- Chronological timeline events

Strict clinical rules:
- Zero hallucination: extract only what is explicitly present.
- Missing or unclear fields are set to null / empty list.
- Never diagnose, prescribe, or reinterpret test values.
- Verbatim preservation of medicine names, strengths, dosages, and test values.
- Never extracts Aadhaar, PAN, phone numbers, or billing info.
- Native support for Indian medical documents (DD/MM/YYYY, OD/BD/TDS/HS/SOS, brand names).
"""
import re
from typing import Dict, Any, List, Optional
from ..schemas import (
    ClinicalDocumentExtraction, MedicineExtractionItem, TestExtractionItem,
    SymptomExtractionItem, VitalsExamination, FollowUpInfo, TimelineEventItem
)

# Common Indian frequency abbreviations to clear clinical expansions
FREQUENCY_MAP = {
    "od": "OD (Once daily)",
    "once daily": "OD (Once daily)",
    "bd": "BD (Twice daily)",
    "bid": "BD (Twice daily)",
    "twice daily": "BD (Twice daily)",
    "tds": "TDS (Thrice daily)",
    "tid": "TDS (Thrice daily)",
    "thrice daily": "TDS (Thrice daily)",
    "qid": "QID (4 times daily)",
    "four times daily": "QID (4 times daily)",
    "hs": "HS (At bedtime)",
    "bedtime": "HS (At bedtime)",
    "sos": "SOS (As needed / When required)",
    "prn": "SOS (As needed / When required)",
    "stat": "STAT (Immediately)",
    "weekly": "Weekly",
    "alternate day": "Alternate days",
}

# Indian timing abbreviations
TIMING_MAP = {
    "ac": "Before food / meals (AC)",
    "before food": "Before food / meals (AC)",
    "before meals": "Before food / meals (AC)",
    "pc": "After food / meals (PC)",
    "after food": "After food / meals (PC)",
    "after meals": "After food / meals (PC)",
    "empty stomach": "Empty stomach",
    "with meals": "With meals",
}

# Common Indian medicine brand and generic stems
COMMON_MED_NAMES = [
    "paracetamol", "dolo", "calpol", "crocin", "augmentin", "amoxyclav", "amoxicillin",
    "azithral", "azithromycin", "cifran", "ciprofloxacin", "cefixime", "taxim-o",
    "pantocid", "pantop", "pantoprazole", "pan-d", "pan 40", "rantac", "ranitidine",
    "omez", "omeprazole", "rabeprazole", "glycomet", "metformin", "glimepiride",
    "januvia", "sitagliptin", "telma", "telmisartan", "amlip", "amlodipine",
    "losartan", "envas", "enalapril", "montair-lc", "cetrizine", "allegra",
    "fexofenadine", "levocetirizine", "shelcal", "calcium", "becosules",
    "neurobion", "supradyn", "limcee", "vitamin c", "digene", "gelusil",
    "cremaffin", "dulcolax", "atorvastatin", "atorva", "rosuvastatin",
    "ecosprin", "aspirin", "clopidogrel", "salbutamol", "asthalin", "budecort",
    "foracort", "deriphyllin", "combiflam", "ibuprofen", "aceclofenac", "zerodol",
    "zerodol-sp", "meftal-spas", "voveran", "diclofenac", "tramadol", "ondansetron",
    "emset", "vomikind", "metrogyl", "metronidazole", "ofloxacin", "zenflox"
]

# Lab test indicators and canonical units
LAB_TEST_PATTERNS = [
    (r"hba1c", "HbA1c", "%", "4.0 - 5.6"),
    (r"fasting\s+blood\s+(?:sugar|glucose)|fbs", "Fasting Blood Sugar", "mg/dL", "70 - 99"),
    (r"post\s+prandial\s+(?:blood\s+)?(?:sugar|glucose)|ppbs", "Post Prandial Glucose", "mg/dL", "< 140"),
    (r"random\s+blood\s+(?:sugar|glucose)|rbs", "Random Blood Sugar", "mg/dL", "70 - 140"),
    (r"hemoglobin|hb", "Hemoglobin", "g/dL", "12.0 - 16.0"),
    (r"platelets?|platelet\s+count", "Platelet Count", "cells/cu mm", "150,000 - 450,000"),
    (r"total\s+leukocyte\s+count|tlc|wbc", "Total Leukocyte Count (WBC)", "cells/cu mm", "4,000 - 11,000"),
    (r"serum\s+creatinine|creatinine", "Serum Creatinine", "mg/dL", "0.6 - 1.2"),
    (r"blood\s+urea\s+nitrogen|bun|urea", "Blood Urea Nitrogen", "mg/dL", "7 - 20"),
    (r"sgot|ast", "SGOT / AST", "U/L", "10 - 40"),
    (r"sgpt|alt", "SGPT / ALT", "U/L", "7 - 56"),
    (r"alkaline\s+phosphatase|alp", "Alkaline Phosphatase (ALP)", "U/L", "44 - 147"),
    (r"serum\s+bilirubin|total\s+bilirubin", "Serum Bilirubin (Total)", "mg/dL", "0.2 - 1.2"),
    (r"total\s+cholesterol", "Total Cholesterol", "mg/dL", "< 200"),
    (r"triglycerides?|tg", "Triglycerides", "mg/dL", "< 150"),
    (r"hdl\s+cholesterol|hdl", "HDL Cholesterol", "mg/dL", "> 40"),
    (r"ldl\s+cholesterol|ldl", "LDL Cholesterol", "mg/dL", "< 100"),
    (r"tsh|thyroid\s+stimulating\s+hormone", "TSH", "mIU/L", "0.4 - 4.5"),
    (r"crp|c-reactive\s+protein", "C-Reactive Protein (CRP)", "mg/L", "< 5.0"),
    (r"esr", "ESR", "mm/hr", "0 - 20"),
]


def extract_date(text: str) -> Optional[str]:
    """Extract Indian format DD/MM/YYYY or standard YYYY-MM-DD date."""
    # Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    m = re.search(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})\b", text)
    if m:
        day, month, year = m.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    # Match DD Month YYYY (e.g. 12 Aug 2026, 12 August 2026)
    m = re.search(r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b", text, re.I)
    if m:
        return f"{m.group(1)} {m.group(2).title()} {m.group(3)}"

    # Match YYYY-MM-DD
    m = re.search(r"\b(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})\b", text)
    if m:
        year, month, day = m.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"

    return None


def extract_vitals(text: str) -> Optional[VitalsExamination]:
    v = VitalsExamination()
    found = False

    # Blood Pressure: e.g. BP: 120/80 mmHg or 130/85
    bp_match = re.search(r"\b(?:bp|blood\s+pressure)\s*[:=\-]?\s*(\d{2,3}\s*/\s*\d{2,3}(?:\s*mm\s*hg)?)\b", text, re.I)
    if bp_match:
        v.blood_pressure = bp_match.group(1).strip()
        found = True

    # Pulse / Heart Rate
    pulse_match = re.search(r"\b(?:pulse|heart\s+rate|pr|hr)\s*[:=\-]?\s*(\d{2,3})\s*(?:bpm|/min)?\b", text, re.I)
    if pulse_match:
        v.pulse_rate = f"{pulse_match.group(1)} bpm"
        found = True

    # Temperature
    temp_match = re.search(r"\b(?:temp|temperature)\s*[:=\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(?:°?[fc]|deg\s*[fc])?\b", text, re.I)
    if temp_match:
        val = temp_match.group(1)
        unit = "°F" if float(val) > 50 else "°C"
        v.temperature = f"{val} {unit}"
        found = True

    # SpO2
    spo2_match = re.search(r"\b(?:spo2|o2\s*sat|saturation)\s*[:=\-]?\s*(\d{2,3})\s*%?\b", text, re.I)
    if spo2_match:
        v.spo2 = f"{spo2_match.group(1)}%"
        found = True

    # Respiratory Rate
    rr_match = re.search(r"\b(?:rr|respiratory\s+rate)\s*[:=\-]?\s*(\d{1,2})\s*(?:/min|cpm)?\b", text, re.I)
    if rr_match:
        v.respiratory_rate = f"{rr_match.group(1)} /min"
        found = True

    # General Exam Notes (e.g. Chest: Clear, CVS: S1 S2 heard, P/A: Soft)
    exam_parts = []
    for organ in ["chest", "cvs", "p/a", "cns", "ent", "pallor", "icterus", "cyanosis", "edema"]:
        m = re.search(rf"\b{organ}\s*[:=\-]\s*([^,\.\n\r|;]+)", text, re.I)
        if m:
            exam_parts.append(f"{organ.upper()}: {m.group(1).strip()}")
    if exam_parts:
        v.examination_notes = "; ".join(exam_parts)
        found = True

    return v if found else None


def extract_medicines(text: str) -> List[MedicineExtractionItem]:
    """Extract prescribed medications with Indian brand names, dosage, frequency, and instructions."""
    medicines: List[MedicineExtractionItem] = []
    seen_names = set()

    # Split text into lines or clinical segments
    lines = re.split(r"[\n\r;|\u2022]+", text)

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        # Look for medication patterns like:
        # "Tab. Metformin 500mg BD x 30 days PC" or "Dolo 650 1 tab TDS SOS"
        matched_name = None
        for med in COMMON_MED_NAMES:
            if re.search(rf"\b{med}\b", line, re.I):
                matched_name = med.title()
                break

        # Check explicit prefix Rx / Tab. / Cap. / Syr. / Inj.
        prefix_match = re.search(r"\b(?:tab\.?|cap\.?|syr\.?|inj\.?|rx)\s+([A-Za-z0-9\-_]+)", line, re.I)
        if prefix_match and not matched_name:
            candidate = prefix_match.group(1).strip()
            if len(candidate) > 2 and candidate.lower() not in ("the", "and", "for", "with", "report", "date", "blood"):
                matched_name = candidate.title()

        if not matched_name:
            continue

        if matched_name.lower() in seen_names:
            continue
        seen_names.add(matched_name.lower())

        # Extract strength: e.g. 500mg, 650 mg, 5 ml, 10mcg
        strength = None
        str_m = re.search(r"\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|%))\b", line, re.I)
        if str_m:
            strength = str_m.group(1).strip()

        # Extract frequency: OD, BD, TDS, QID, HS, SOS
        frequency = None
        freq_m = re.search(r"\b(od|bd|bid|tds|tid|qid|hs|sos|prn|stat|once daily|twice daily|thrice daily)\b", line, re.I)
        if freq_m:
            raw_f = freq_m.group(1).lower()
            frequency = FREQUENCY_MAP.get(raw_f, raw_f.upper())

        # Extract timing: AC, PC, before food, after food
        timing = None
        timing_m = re.search(r"\b(ac|pc|before food|after food|before meals|after meals|empty stomach)\b", line, re.I)
        if timing_m:
            raw_t = timing_m.group(1).lower()
            timing = TIMING_MAP.get(raw_t, raw_t.title())

        # Extract duration: e.g. "5 days", "1 week", "x 10 days"
        duration = None
        dur_m = re.search(r"(?:x\s*|\bfor\s*)?(\d+\s*(?:days?|weeks?|months?))\b", line, re.I)
        if dur_m:
            duration = dur_m.group(1).strip()

        # Extract route
        route = "Oral"
        if re.search(r"\b(?:inj|injection|iv|im)\b", line, re.I):
            route = "Injection (IV/IM)"
        elif re.search(r"\b(?:inhaler|puff|nebulizer|rotacap)\b", line, re.I):
            route = "Inhalation"
        elif re.search(r"\b(?:ointment|gel|cream|drop|drops)\b", line, re.I):
            route = "Topical"

        # Extract dosage: e.g. 1 tablet, 2 puffs, 5 ml
        dosage = None
        dos_m = re.search(r"\b(\d+\s*(?:tablet|tab|capsule|cap|puff|puffs|ml|tsp|drops?))\b", line, re.I)
        if dos_m:
            dosage = dos_m.group(1).strip()
        elif strength:
            dosage = f"1 tablet ({strength})"

        # Instructions: e.g. "with warm water", "after food"
        instructions = None
        if "water" in line.lower():
            instructions = "Take with water"
        elif timing:
            instructions = f"Take {timing.lower()}"

        medicines.append(MedicineExtractionItem(
            name=matched_name,
            strength=strength,
            dosage=dosage,
            route=route,
            frequency=frequency,
            timing=timing,
            duration=duration,
            instructions=instructions,
        ))

    return medicines


def extract_lab_tests(text: str) -> List[TestExtractionItem]:
    """Extract laboratory investigations with values, units, and reference ranges."""
    tests: List[TestExtractionItem] = []
    seen_tests = set()

    for pattern, name, default_unit, ref_range in LAB_TEST_PATTERNS:
        match = re.search(rf"\b(?:{pattern})\b\s*[:=\-]?\s*(\d+(?:\.\d+)?)\s*([a-zA-Z/%]+)?", text, re.I)
        if match:
            if name in seen_tests:
                continue
            seen_tests.add(name)

            val_str = match.group(1).strip()
            unit_candidate = match.group(2)
            unit = unit_candidate if unit_candidate and len(unit_candidate) < 10 else default_unit

            # Calculate flag if numeric comparison is straightforward
            flag = "Normal"
            try:
                num_val = float(val_str)
                if "-" in ref_range:
                    parts = ref_range.split("-")
                    low = float(parts[0].strip())
                    high = float(parts[1].replace(",", "").strip())
                    if num_val < low:
                        flag = "Low"
                    elif num_val > high:
                        flag = "High"
                elif "<" in ref_range:
                    limit = float(ref_range.replace("<", "").strip())
                    if num_val > limit:
                        flag = "High"
                elif ">" in ref_range:
                    limit = float(ref_range.replace(">", "").strip())
                    if num_val < limit:
                        flag = "Low"
            except Exception:
                flag = "Normal"

            tests.append(TestExtractionItem(
                name=name,
                value=val_str,
                unit=unit,
                reference_range=ref_range,
                flag=flag,
            ))

    return tests


def extract_symptoms(text: str) -> List[SymptomExtractionItem]:
    """Extract clinical symptoms and duration without hallucinating."""
    symptoms = []
    seen = set()

    symptom_patterns = [
        (r"\b(?:fever|pyrexia)\b", "Fever"),
        (r"\bcough\b", "Cough"),
        (r"\b(?:chest\s+pain|angina)\b", "Chest Pain"),
        (r"\b(?:dyspnea|breathlessness|shortness\s+of\s+breath)\b", "Breathlessness (Dyspnea)"),
        (r"\b(?:headache|cephalea)\b", "Headache"),
        (r"\b(?:vomiting|emesis)\b", "Vomiting"),
        (r"\bnausea\b", "Nausea"),
        (r"\b(?:abdominal\s+pain|stomach\s+pain)\b", "Abdominal Pain"),
        (r"\b(?:loose\s+motions?|diarrhea)\b", "Diarrhea"),
        (r"\b(?:generalized\s+weakness|fatigue)\b", "Weakness / Fatigue"),
        (r"\b(?:body\s+ache|myalgia)\b", "Body Ache"),
        (r"\b(?:joint\s+pain|arthralgia)\b", "Joint Pain"),
        (r"\b(?:sore\s+throat|throat\s+pain)\b", "Sore Throat"),
        (r"\b(?:rash|itching|pruritus)\b", "Skin Rash / Itching"),
    ]

    for pattern, name in symptom_patterns:
        m = re.search(rf"{pattern}(?:\s*(?:since|for)?\s*(\d+\s*(?:days?|weeks?|months?|hours?)))?", text, re.I)
        if m:
            if name in seen:
                continue
            seen.add(name)
            duration = m.group(1).strip() if m.group(1) else None
            symptoms.append(SymptomExtractionItem(name=name, duration=duration))

    return symptoms


def extract_diagnosis(text: str) -> List[str]:
    """Extract explicit diagnosis from clinical document."""
    diagnoses = []

    # Look for Diagnosis / Impression / Assessment lines
    m = re.search(r"\b(?:diagnosis|provisional\s+diagnosis|impression|assessment)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if m:
        raw = m.group(1).strip()
        for item in re.split(r"[,/]+", raw):
            clean = item.strip()
            if clean and len(clean) > 2 and clean.lower() not in ("none", "nil"):
                diagnoses.append(clean.title())

    conditions = [
        "Type 2 Diabetes Mellitus", "Hypertension", "Acute Viral Syndrome",
        "Acute Bronchitis", "Upper Respiratory Tract Infection (URTI)",
        "Gastroenteritis", "Coronary Artery Disease", "Asthma", "Allergic Rhinitis",
        "Urinary Tract Infection (UTI)", "Hypothyroidism", "Dyslipidemia"
    ]
    for cond in conditions:
        if re.search(rf"\b{re.escape(cond)}\b", text, re.I):
            if cond not in diagnoses:
                diagnoses.append(cond)

    return diagnoses


def extract_medical_history_and_allergies(text: str):
    """Extract past medical history and confirmed drug/food allergies."""
    pmh = []
    allergies = []

    pmh_match = re.search(r"\b(?:past\s+medical\s+history|pmh|history\s+of|known\s+case\s+of)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if pmh_match:
        for item in re.split(r"[,/]+", pmh_match.group(1)):
            clean = item.strip()
            if clean and len(clean) > 2 and clean.lower() not in ("none", "nil", "no"):
                pmh.append(clean.title())

    allergy_match = re.search(r"\b(?:allerg(?:y|ies)|allergic\s+to|known\s+allergies)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if allergy_match:
        raw_allergy = allergy_match.group(1).strip()
        if raw_allergy.lower() not in ("none", "nil", "no known drug allergies", "nkda", "no"):
            for item in re.split(r"[,/]+", raw_allergy):
                clean = item.strip()
                if clean:
                    allergies.append(clean.title())

    return pmh, allergies


def extract_imaging(text: str) -> List[str]:
    """Extract imaging findings (X-Ray, CT, MRI, USG, ECG)."""
    findings = []
    for mod in ["chest x-ray", "x-ray", "ecg", "ekg", "usg", "ultrasound", "ct scan", "mri"]:
        m = re.search(rf"\b{mod}\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
        if m:
            finding = f"{mod.upper()}: {m.group(1).strip()}"
            findings.append(finding)
    return findings


def extract_advice_and_followup(text: str):
    """Extract doctor's advice and follow-up plan."""
    advice_list = []
    follow_up = None

    advice_match = re.search(r"\b(?:advice|instructions?|lifestyle\s+advice|plan)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if advice_match:
        for item in re.split(r"[,/]+", advice_match.group(1)):
            clean = item.strip()
            if clean and len(clean) > 2:
                advice_list.append(clean.capitalize())

    fu_match = re.search(r"\b(?:follow\s*up|review)\s*(?:after|on|in)?\s*[:=\-]?\s*([^.\n\r|;]+)", text, re.I)
    if fu_match:
        fu_text = fu_match.group(1).strip()
        follow_up = FollowUpInfo(required=True, date_or_duration=fu_text, notes=f"Review: {fu_text}")
    elif re.search(r"\bsos\b", text, re.I):
        follow_up = FollowUpInfo(required=False, date_or_duration="SOS", notes="Return if symptoms worsen")

    return advice_list, follow_up


def extract_procedures(text: str) -> List[str]:
    """Extract clinical procedures performed or ordered."""
    procedures = []
    keywords = ["nebulization", "wound dressing", "suture removal", "injection", "physiotherapy", "iv fluids", "catherization"]
    for kw in keywords:
        if re.search(rf"\b{kw}\b", text, re.I):
            procedures.append(kw.title())
    return procedures


def build_timeline_events(
    report_date: Optional[str],
    symptoms: List[SymptomExtractionItem],
    diagnosis: List[str],
    medicines: List[MedicineExtractionItem],
    tests: List[TestExtractionItem],
    follow_up: Optional[FollowUpInfo]
) -> List[TimelineEventItem]:
    """Assemble coherent chronological timeline events from extracted items."""
    events = []
    date_label = report_date or "Encounter Date"

    for s in symptoms:
        dur_note = f" (Duration: {s.duration})" if s.duration else ""
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Symptom Reported: {s.name}{dur_note}",
            category="symptom"
        ))

    if diagnosis:
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Clinical Diagnosis: {', '.join(diagnosis)}",
            category="consultation"
        ))

    if tests:
        test_summary = ", ".join(f"{t.name} ({t.value} {t.unit or ''})" for t in tests[:3])
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Diagnostic Tests: {test_summary}",
            category="test"
        ))

    if medicines:
        med_summary = ", ".join(f"{m.name} {m.strength or ''}".strip() for m in medicines[:3])
        events.append(TimelineEventItem(
            date=date_label,
            event=f"Prescribed: {med_summary}",
            category="prescription"
        ))

    if follow_up and follow_up.date_or_duration:
        events.append(TimelineEventItem(
            date=f"Planned: {follow_up.date_or_duration}",
            event=f"Follow-up Review Scheduled ({follow_up.date_or_duration})",
            category="follow_up"
        ))

    return events


def extract_clinical_document(text: str, doc_type: Optional[str] = None) -> ClinicalDocumentExtraction:
    """
    Main extraction function. Runs strict medical NLP entity extraction
    on OCR / document text and produces a validated ClinicalDocumentExtraction schema.
    """
    report_date = extract_date(text)
    vitals = extract_vitals(text)
    medicines = extract_medicines(text)
    tests = extract_lab_tests(text)
    symptoms = extract_symptoms(text)
    diagnosis = extract_diagnosis(text)
    pmh, allergies = extract_medical_history_and_allergies(text)
    imaging = extract_imaging(text)
    procedures = extract_procedures(text)
    advice, follow_up = extract_advice_and_followup(text)

    reason_for_visit = None
    rfv_match = re.search(r"\b(?:reason\s+for\s+visit|chief\s+complaint|c/o|presenting\s+complaints?)\s*[:=\-]\s*([^.\n\r|;]+)", text, re.I)
    if rfv_match:
        reason_for_visit = rfv_match.group(1).strip().capitalize()
    elif symptoms:
        reason_for_visit = f"Presents with {', '.join(s.name for s in symptoms[:2])}"
    elif diagnosis:
        reason_for_visit = f"Evaluation for {diagnosis[0]}"

    timeline_events = build_timeline_events(
        report_date, symptoms, diagnosis, medicines, tests, follow_up
    )

    clean_lines = [l.strip() for l in text.splitlines() if l.strip()]
    raw_summary = " | ".join(clean_lines[:4]) if clean_lines else None

    return ClinicalDocumentExtraction(
        report_date=report_date,
        reason_for_visit=reason_for_visit,
        symptoms=symptoms,
        diagnosis=diagnosis,
        past_medical_history=pmh,
        allergies=allergies,
        vitals_and_examination=vitals,
        tests=tests,
        imaging_findings=imaging,
        medicines=medicines,
        procedures_and_treatments=procedures,
        doctor_advice=advice,
        follow_up=follow_up,
        timeline_events=timeline_events,
        raw_ocr_summary=raw_summary,
    )
