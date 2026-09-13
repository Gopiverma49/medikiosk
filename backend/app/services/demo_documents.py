"""
Preloaded Demo Documents Provider for Doctor Portal Review.
Supplies structured clinical extractions and authentic SVG document previews for:
- Patient ID: 24BTRSN054 (1 Comprehensive Laboratory & Metabolic Report)
- Patient ID: 222 (2 Reports: Inpatient Discharge Summary & Cardiac Lipid Panel)
"""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

DEMO_DOC_24BTRSN054_1: Dict[str, Any] = {
    "id": "demo-doc-24btrsn054-cbc",
    "encounter_id": "demo-enc-24btrsn054",
    "patient_id": "24BTRSN054",
    "doc_type": "lab_report",
    "filename": "Apollo_Pathology_Complete_Hemogram_Metabolic_Panel.pdf",
    "status": "confirmed",
    "storage_path": "demo/apollo_cbc_report.svg",
    "file_url": "/api/documents/demo-doc-24btrsn054-cbc/file",
    "page_urls": ["/api/documents/demo-doc-24btrsn054-cbc/file?page=0"],
    "created_at": datetime(2026, 9, 10, 10, 30, tzinfo=timezone.utc),
    "ocr_confidence": 0.98,
    "ocr_text": (
        "APOLLO DIAGNOSTICS & CLINICAL PATHOLOGY LAB\n"
        "NABL ACCREDITED LAB #MC-2041 | ISO 15189:2022 CERTIFIED\n"
        "Patient: Gopi | Age/Sex: 22 Y / Male | Patient ID: 24BTRSN054\n"
        "Collection: 08-Sep-2026 08:45 AM | Report: 10-Sep-2026 11:15 AM\n\n"
        "COMPLETE BLOOD COUNT (CBC) & BIOCHEMISTRY:\n"
        "- Hemoglobin (Hb): 10.2 g/dL (LOW) [Ref: 13.0 - 17.0]\n"
        "- Total RBC: 3.80 mil/uL (LOW) [Ref: 4.50 - 5.90]\n"
        "- Packed Cell Volume (PCV): 31.5 % (LOW) [Ref: 40.0 - 50.0]\n"
        "- Platelet Count: 245,000 /uL (NORMAL) [Ref: 150,000 - 450,000]\n"
        "- Total Leucocytes (TLC): 7,200 /uL (NORMAL) [Ref: 4,000 - 11,000]\n"
        "- Serum Ferritin: 18.0 ng/mL (LOW) [Ref: 30.0 - 400.0]\n"
        "- 25-OH Vitamin D3: 16.4 ng/mL (DEFICIENT) [Ref: 30.0 - 100.0]\n"
        "- Fasting Blood Sugar: 94 mg/dL (NORMAL) [Ref: 70 - 100]\n"
        "- Serum Creatinine: 0.88 mg/dL (NORMAL) [Ref: 0.70 - 1.30]\n\n"
        "Verified by: Dr. S. Rao, MD (Pathology)"
    ),
    "extracted_data": {
        "report_date": "10-Sep-2026",
        "reason_for_visit": "Persistent fatigue, generalized weakness, exertional breathlessness, and low stamina",
        "symptoms": [
            {"name": "Generalized fatigue & tiredness", "duration": "3 weeks"},
            {"name": "Mild exertional breathlessness", "duration": "10 days"},
            {"name": "Dizziness on standing quickly", "duration": "1 week"}
        ],
        "diagnosis": [
            "Microcytic Hypochromic Anemia (Iron Deficiency)",
            "Moderate Vitamin D3 Deficiency (Hypovitaminosis D)"
        ],
        "past_medical_history": [
            "No prior history of gastrointestinal bleeding",
            "Irregular meal timings due to academic/work stress"
        ],
        "allergies": ["No known drug or food allergies"],
        "vitals_and_examination": {
            "blood_pressure": "116/74 mmHg",
            "pulse_rate": "78 bpm",
            "temperature": "98.4 °F",
            "spo2": "99%",
            "respiratory_rate": "16 /min",
            "examination_notes": "Mild conjunctival pallor (+). Tongue smooth, no glossitis. Chest clear bilaterally. Heart sounds S1/S2 normal."
        },
        "tests": [
            {"name": "Hemoglobin (Hb)", "value": "10.2", "unit": "g/dL", "reference_range": "13.0 - 17.0", "flag": "Low"},
            {"name": "Total RBC Count", "value": "3.80", "unit": "mil/µL", "reference_range": "4.50 - 5.90", "flag": "Low"},
            {"name": "Packed Cell Volume (PCV)", "value": "31.5", "unit": "%", "reference_range": "40.0 - 50.0", "flag": "Low"},
            {"name": "Serum Ferritin", "value": "18.0", "unit": "ng/mL", "reference_range": "30.0 - 400.0", "flag": "Low"},
            {"name": "25-OH Vitamin D3 Total", "value": "16.4", "unit": "ng/mL", "reference_range": "30.0 - 100.0", "flag": "Low"},
            {"name": "Total Leucocytes (WBC)", "value": "7,200", "unit": "/µL", "reference_range": "4,000 - 11,000", "flag": "Normal"},
            {"name": "Platelet Count", "value": "245,000", "unit": "/µL", "reference_range": "150,000 - 450,000", "flag": "Normal"},
            {"name": "Fasting Blood Sugar", "value": "94", "unit": "mg/dL", "reference_range": "70 - 100", "flag": "Normal"},
            {"name": "Serum Creatinine", "value": "0.88", "unit": "mg/dL", "reference_range": "0.70 - 1.30", "flag": "Normal"}
        ],
        "imaging_findings": [],
        "medicines": [
            {
                "name": "Tab Autrin / Ferrous Ascorbate (Iron + Folic Acid)",
                "strength": "100mg elemental Iron + 1.5mg FA",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "OD (Once daily)",
                "timing": "After Dinner",
                "duration": "60 days",
                "instructions": "Take with fresh lemon water / orange juice for optimal iron absorption. Do NOT take with milk or tea."
            },
            {
                "name": "Cap Calcirol 60K (Cholecalciferol)",
                "strength": "60,000 IU",
                "dosage": "1 capsule",
                "route": "Oral",
                "frequency": "Once a week (Sunday)",
                "timing": "After Lunch",
                "duration": "8 weeks",
                "instructions": "Take once weekly with full fat milk. Recheck Vitamin D levels at 10 weeks."
            }
        ],
        "procedures_and_treatments": [
            "Peripheral blood smear examination for RBC morphology",
            "Dietary nutritional counseling for iron replenishment"
        ],
        "doctor_advice": [
            "Incorporate iron-rich foods in daily diet: spinach, fenugreek, beetroot, pomegranate, jaggery, lentils, and dates.",
            "Ensure 20 minutes of early morning sun exposure daily for natural Vitamin D synthesis.",
            "Drink at least 2.5 to 3 liters of water daily.",
            "Repeat Complete Hemogram and Serum Ferritin profile after 60 days."
        ],
        "follow_up": {
            "required": True,
            "date_or_duration": "After 6 weeks for repeat CBC & Serum Ferritin evaluation",
            "notes": "SOS if severe dizziness or palpitations occur"
        },
        "timeline_events": [
            {"date": "08-Sep-2026 08:45 AM", "event": "Venous blood sample collected at Apollo Central Diagnostics Collection Center", "category": "Sample Collection"},
            {"date": "09-Sep-2026 06:15 PM", "event": "Automated Sysmex hematology analyzer run verified by Senior Lab Technologist", "category": "Laboratory Processing"},
            {"date": "10-Sep-2026 11:15 AM", "event": "Digital NABL clinical validation signed off by Dr. S. Rao, MD (Pathology)", "category": "Physician Sign-Off"},
            {"date": "10-Sep-2026 11:30 AM", "event": "Document uploaded to MediKiosk patient intake record", "category": "System Ingestion"}
        ],
        "raw_ocr_summary": "Confirmed NABL Laboratory Report showing Microcytic Hypochromic Anemia (Hb 10.2 g/dL, Ferritin 18 ng/mL) and Vitamin D3 Deficiency (16.4 ng/mL)."
    }
}

DEMO_DOC_222_1: Dict[str, Any] = {
    "id": "demo-doc-222-discharge",
    "encounter_id": "demo-enc-222-1",
    "patient_id": "222",
    "doc_type": "discharge_summary",
    "filename": "Civil_Hospital_Inpatient_Discharge_Summary_Ward4.pdf",
    "status": "confirmed",
    "storage_path": "demo/civil_hospital_discharge.svg",
    "file_url": "/api/documents/demo-doc-222-discharge/file",
    "page_urls": ["/api/documents/demo-doc-222-discharge/file?page=0"],
    "created_at": datetime(2026, 8, 28, 14, 20, tzinfo=timezone.utc),
    "ocr_confidence": 0.99,
    "ocr_text": (
        "DISTRICT CIVIL HOSPITAL & MEDICAL COLLEGE\n"
        "DEPARTMENT OF INTERNAL MEDICINE - INPATIENT WARD 4 (BED 12)\n"
        "DISCHARGE SUMMARY & CLINICAL COURSE RECORD\n"
        "Patient: Gopi | Age/Gender: 26 Y / Male | UHID / Hospital ID: 222\n"
        "Admission: 25-Aug-2026 10:15 AM | Discharge: 28-Aug-2026 02:00 PM\n"
        "Consultant In-Charge: Dr. K. Mehta, MD (Medicine)\n\n"
        "FINAL DIAGNOSIS:\n"
        "1. Acute Bacterial Gastroenteritis with Moderate Dehydration (Resolved)\n"
        "2. Hypokalemia - Grade I (Corrected during admission)\n\n"
        "HOSPITAL COURSE:\n"
        "Admitted with watery diarrhea (7-8 episodes/day), spasmodic abdominal cramps, nausea.\n"
        "Rehydrated with IV Ringer Lactate and Normal Saline. Switched to oral Ofloxacin + Ornidazole.\n"
        "Diarrhea subsided by Day 3. Afebrile and hemodynamically stable on discharge.\n\n"
        "CONDITION ON DISCHARGE:\n"
        "BP: 122/80 mmHg | Pulse: 74 bpm | Temp: 98.6 °F | SpO2: 98% room air\n"
        "Abdomen soft, non-tender, active normal bowel sounds."
    ),
    "extracted_data": {
        "report_date": "28-Aug-2026",
        "reason_for_visit": "Acute watery diarrhea (7-8 times/day), diffuse crampy abdominal pain, vomiting, and moderate dehydration",
        "symptoms": [
            {"name": "Watery diarrhea", "duration": "3 days prior to admission"},
            {"name": "Crampy abdominal pain (umbilical region)", "duration": "3 days"},
            {"name": "Nausea & vomiting", "duration": "1 day"},
            {"name": "Postural dizziness & dry mouth", "duration": "2 days"}
        ],
        "diagnosis": [
            "Acute Bacterial Gastroenteritis (Resolved)",
            "Moderate Dehydration (Grade II, Fully Corrected)",
            "Mild Transient Hypokalemia (Corrected)"
        ],
        "past_medical_history": [
            "No history of hypertension, diabetes, or chronic kidney disease",
            "History of outside roadside food consumption 24 hours prior to symptom onset"
        ],
        "allergies": ["No known drug allergies (NKDA)"],
        "vitals_and_examination": {
            "blood_pressure": "122/80 mmHg",
            "pulse_rate": "74 bpm",
            "temperature": "98.6 °F",
            "spo2": "98%",
            "respiratory_rate": "18 /min",
            "examination_notes": "Patient alert, oriented, well-hydrated. Oral mucosa moist. Abdomen soft, non-tender, no organomegaly, normal bowel sounds."
        },
        "tests": [
            {"name": "Serum Sodium (Na+)", "value": "138", "unit": "mmol/L", "reference_range": "135 - 145", "flag": "Normal"},
            {"name": "Serum Potassium (K+)", "value": "4.1", "unit": "mmol/L", "reference_range": "3.5 - 5.1", "flag": "Normal"},
            {"name": "Serum Creatinine", "value": "0.92", "unit": "mg/dL", "reference_range": "0.70 - 1.30", "flag": "Normal"},
            {"name": "Blood Urea", "value": "26", "unit": "mg/dL", "reference_range": "15 - 45", "flag": "Normal"},
            {"name": "Stool Pus Cells", "value": "2 - 4", "unit": "/hpf", "reference_range": "0 - 2", "flag": "High"},
            {"name": "Stool RBCs / Occult Blood", "value": "Nil", "unit": "", "reference_range": "Nil", "flag": "Normal"}
        ],
        "imaging_findings": [
            "Abdominal Ultrasound (26-Aug-2026): Mild prominent fluid-filled bowel loops consistent with enteritis; solid organs normal."
        ],
        "medicines": [
            {
                "name": "Tab O2 / Ofloxacin + Ornidazole",
                "strength": "200mg + 500mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "BD (Twice daily)",
                "timing": "After Meals",
                "duration": "3 days",
                "instructions": "Complete the full remaining 3-day course. Do not skip doses."
            },
            {
                "name": "Sachet Econorm (S. boulardii probiotic)",
                "strength": "250mg",
                "dosage": "1 sachet",
                "route": "Oral",
                "frequency": "BD (Twice daily)",
                "timing": "Before Food",
                "duration": "5 days",
                "instructions": "Mix in lukewarm water or curd. Helps restore gut floral balance."
            },
            {
                "name": "Electral / WHO-ORS Sips",
                "strength": "WHO standard formula",
                "dosage": "1 packet in 1L clean water",
                "route": "Oral",
                "frequency": "Frequent sips as required",
                "timing": "Throughout the day",
                "duration": "3 days",
                "instructions": "Continue taking oral fluids to maintain hydration."
            }
        ],
        "procedures_and_treatments": [
            "IV fluid resuscitation with Ringer Lactate and Normal Saline (2,500 mL over 24 hrs)",
            "Intake/output and electrolyte balance monitoring"
        ],
        "doctor_advice": [
            "Maintain a light, freshly prepared semi-solid diet (khichdi, curd rice, boiled potatoes, toast, bananas) for next 5 days.",
            "Strictly avoid spicy curries, fried foods, raw salads, and outside street food.",
            "Drink only boiled or filtered drinking water.",
            "Maintain hand hygiene with soap and water before meals."
        ],
        "follow_up": {
            "required": True,
            "date_or_duration": "Review in OPD after 7-10 days or SOS if fever/vomiting recurs",
            "notes": "Emergency SOS consultation if blood in stools, high grade fever (>101°F), or persistent vomiting occurs"
        },
        "timeline_events": [
            {"date": "25-Aug-2026 10:15 AM", "event": "Emergency admission to Civil Hospital Ward 4; IV cannulation and fluid resuscitation begun", "category": "Hospital Admission"},
            {"date": "26-Aug-2026 04:00 PM", "event": "USG Abdomen and Serum Electrolytes reviewed; patient transitioned to oral diet", "category": "Clinical Review"},
            {"date": "28-Aug-2026 02:00 PM", "event": "Discharged in fully stable condition with home medication regimen and dietary advice", "category": "Hospital Discharge"}
        ],
        "raw_ocr_summary": "Official Civil Hospital Inpatient Discharge Summary: Acute Bacterial Gastroenteritis resolved after 3 days IV fluid and antibiotic therapy. Discharged on oral Ofloxacin-Ornidazole and Econorm probiotic."
    }
}

DEMO_DOC_222_2: Dict[str, Any] = {
    "id": "demo-doc-222-lipid",
    "encounter_id": "demo-enc-222-2",
    "patient_id": "222",
    "doc_type": "lab_report",
    "filename": "Apex_Cardiac_Diagnostics_Lipid_Risk_Profile.pdf",
    "status": "review_required",
    "storage_path": "demo/apex_lipid_profile.svg",
    "file_url": "/api/documents/demo-doc-222-lipid/file",
    "page_urls": ["/api/documents/demo-doc-222-lipid/file?page=0"],
    "created_at": datetime(2026, 9, 4, 9, 15, tzinfo=timezone.utc),
    "ocr_confidence": 0.97,
    "ocr_text": (
        "APEX CARDIAC & METABOLIC DIAGNOSTIC CENTRE\n"
        "EXCELLENCE IN PREVENTIVE CARDIOLOGY & LIPIDOLOGY\n"
        "Patient: Gopi | Age/Gender: 26 Y / Male | Patient ID: 222\n"
        "Sample: 12-Hour Fasting Blood Serum | Collection: 03-Sep-2026 | Report: 04-Sep-2026\n\n"
        "COMPREHENSIVE LIPID PROFILE & CARDIOVASCULAR RISK PANEL:\n"
        "- Total Cholesterol: 238 mg/dL (HIGH) [Desirable: < 200]\n"
        "- Serum Triglycerides: 198 mg/dL (HIGH) [Normal: < 150]\n"
        "- LDL Cholesterol: 152.0 mg/dL (HIGH) [Optimal: < 100]\n"
        "- HDL Cholesterol: 44.0 mg/dL (NORMAL) [Protective: 40 - 60]\n"
        "- VLDL Cholesterol: 39.6 mg/dL (HIGH) [Normal: < 30]\n"
        "- Total Cholesterol / HDL Ratio: 5.41 (HIGH RISK) [Desirable: < 4.5]\n"
        "- HbA1c (Glycated Hb): 5.6 % (NORMAL / NON-DIABETIC) [Ref: < 5.7]\n"
        "- Serum SGPT (ALT): 34 U/L (NORMAL) [Ref: < 45]\n"
        "- Serum SGOT (AST): 28 U/L (NORMAL) [Ref: < 40]\n\n"
        "Verified by: Dr. Ananya Sen, MD (Biochemistry)"
    ),
    "extracted_data": {
        "report_date": "04-Sep-2026",
        "reason_for_visit": "Routine preventive cardiovascular risk screening due to maternal family history of premature CAD",
        "symptoms": [
            {"name": "Asymptomatic executive health checkup", "duration": "N/A"},
            {"name": "Mild exertional fatigue after heavy stairs", "duration": "1 month"}
        ],
        "diagnosis": [
            "Mixed Hyperlipidemia / Atherogenic Dyslipidemia",
            "Elevated Low-Density Lipoprotein (LDL-C: 152 mg/dL)",
            "Borderline Hypertriglyceridemia (Triglycerides: 198 mg/dL)"
        ],
        "past_medical_history": [
            "Sedentary lifestyle with desk-bound IT work (>9 hrs daily)",
            "Strong positive family history: Mother diagnosed with CAD at age 52"
        ],
        "allergies": ["No known allergies"],
        "vitals_and_examination": {
            "blood_pressure": "130/84 mmHg",
            "pulse_rate": "76 bpm",
            "temperature": "98.4 °F",
            "spo2": "99%",
            "respiratory_rate": "16 /min",
            "examination_notes": "BMI: 26.4 kg/m² (overweight category). Waist circumference: 88 cm. No xanthomas. Normal peripheral pulses."
        },
        "tests": [
            {"name": "Total Serum Cholesterol", "value": "238", "unit": "mg/dL", "reference_range": "< 200", "flag": "High"},
            {"name": "Serum Triglycerides", "value": "198", "unit": "mg/dL", "reference_range": "< 150", "flag": "High"},
            {"name": "LDL Cholesterol", "value": "152.0", "unit": "mg/dL", "reference_range": "< 100", "flag": "High"},
            {"name": "HDL Cholesterol", "value": "44.0", "unit": "mg/dL", "reference_range": "40 - 60", "flag": "Normal"},
            {"name": "VLDL Cholesterol", "value": "39.6", "unit": "mg/dL", "reference_range": "< 30", "flag": "High"},
            {"name": "Total Cholesterol / HDL Ratio", "value": "5.41", "unit": "Ratio", "reference_range": "< 4.5", "flag": "High"},
            {"name": "HbA1c (Glycated Hemoglobin)", "value": "5.6", "unit": "%", "reference_range": "< 5.7", "flag": "Normal"},
            {"name": "Serum SGPT (ALT)", "value": "34", "unit": "U/L", "reference_range": "< 45", "flag": "Normal"},
            {"name": "Serum SGOT (AST)", "value": "28", "unit": "U/L", "reference_range": "< 40", "flag": "Normal"}
        ],
        "imaging_findings": [],
        "medicines": [
            {
                "name": "Tab Rosuvas (Rosuvastatin)",
                "strength": "10mg",
                "dosage": "1 tablet",
                "route": "Oral",
                "frequency": "OD (Once daily at night)",
                "timing": "After Dinner / Bedtime",
                "duration": "60 days",
                "instructions": "Take consistently at bedtime. Reduces hepatic cholesterol synthesis. Report any severe muscle cramps."
            },
            {
                "name": "Cap Omega-3 Fish Oil (EPA 180mg / DHA 120mg)",
                "strength": "1000mg",
                "dosage": "1 capsule",
                "route": "Oral",
                "frequency": "OD (Once daily)",
                "timing": "After Lunch",
                "duration": "60 days",
                "instructions": "Supports triglyceride reduction and arterial endothelial health."
            }
        ],
        "procedures_and_treatments": [
            "12-hour strict overnight fasting lipid profile assay",
            "Basal Liver Function Test (LFT) screening prior to statin initiation"
        ],
        "doctor_advice": [
            "Adopt a Mediterranean heart-healthy dietary pattern rich in oats, chia seeds, almonds, olive oil, and fiber.",
            "Eliminate trans-fats, bakery confectionery, palm oil, and deep-fried savory snacks completely.",
            "Engage in moderate-intensity aerobic physical exercise for minimum 40 minutes, 5 days per week.",
            "Limit sugary carbonated beverages and refined carbohydrate intake."
        ],
        "follow_up": {
            "required": True,
            "date_or_duration": "Review after 8 weeks with repeat Fasting Lipid Profile & SGPT",
            "notes": "Verify LDL reduction to target <100 mg/dL and monitor liver tolerance"
        },
        "timeline_events": [
            {"date": "03-Sep-2026 07:45 AM", "event": "12-hour overnight fasting sample collected at Apex Preventive Cardiology Wing", "category": "Sample Collection"},
            {"date": "03-Sep-2026 03:30 PM", "event": "Automated enzymatic photometric lipid analyzer run completed", "category": "Analyzer Run"},
            {"date": "04-Sep-2026 09:15 AM", "event": "Clinical biochemistry report authenticated by Dr. Ananya Sen, MD", "category": "Physician Sign-Off"},
            {"date": "04-Sep-2026 10:00 AM", "event": "Uploaded and indexed into MediKiosk digital consultation ledger", "category": "System Ingestion"}
        ],
        "raw_ocr_summary": "Apex Diagnostic Lab Report: Mixed Dyslipidemia with Total Cholesterol 238 mg/dL, LDL 152 mg/dL, Triglycerides 198 mg/dL. HbA1c normal (5.6%). Rosuvastatin 10mg & lifestyle intervention recommended."
    }
}


def get_demo_documents_for_patient(patient_id_or_code: Optional[str]) -> List[Dict[str, Any]]:
    if not patient_id_or_code:
        return []
    clean = str(patient_id_or_code).strip().upper()

    if clean in ("24BTRSN054", "13925170-4B76-41C3-86E4-003122CE8997") or "24BTRSN054" in clean:
        return [DEMO_DOC_24BTRSN054_1]

    if clean in ("222", "131BFC74-7FA1-4836-8DCA-15572534D8AE") or "222" in clean:
        return [DEMO_DOC_222_1, DEMO_DOC_222_2]

    return []


def get_demo_document_by_id(doc_id: str) -> Optional[Dict[str, Any]]:
    if doc_id == DEMO_DOC_24BTRSN054_1["id"]:
        return DEMO_DOC_24BTRSN054_1
    if doc_id == DEMO_DOC_222_1["id"]:
        return DEMO_DOC_222_1
    if doc_id == DEMO_DOC_222_2["id"]:
        return DEMO_DOC_222_2
    return None


def generate_demo_svg(doc_id: str) -> Optional[str]:
    """Generates an authentic vector SVG printed medical sheet for visual inspection."""
    if doc_id == DEMO_DOC_24BTRSN054_1["id"]:
        return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1120" width="100%" height="100%">
  <defs>
    <style>
      .hdr-title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 22px; font-weight: 800; fill: #0f4c81; letter-spacing: 0.5px; }
      .hdr-sub { font-family: Arial, sans-serif; font-size: 11px; fill: #555; }
      .tag { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #0284c7; }
      .tbl-hdr { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; fill: #1e293b; }
      .tbl-txt { font-family: Arial, sans-serif; font-size: 11px; fill: #334155; }
      .flag-low { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #b91c1c; }
      .flag-norm { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #047857; }
      .sec-title { font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; fill: #0f4c81; }
    </style>
  </defs>
  <!-- Paper Background -->
  <rect width="800" height="1120" fill="#ffffff"/>
  <rect x="25" y="25" width="750" height="1070" rx="8" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="25" y="25" width="750" height="12" fill="#0f4c81"/>

  <!-- Lab Header -->
  <g transform="translate(50, 65)">
    <circle cx="28" cy="28" r="26" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
    <text x="28" y="36" font-family="Arial" font-size="24" text-anchor="middle" fill="#0284c7">🔬</text>
    <text x="70" y="24" class="hdr-title">APOLLO DIAGNOSTICS &amp; CLINICAL LABS</text>
    <text x="70" y="42" class="hdr-sub">NABL ACCREDITED LAB #MC-2041 | ISO 15189:2022 CERTIFIED QUALITY</text>
    <text x="70" y="56" class="hdr-sub">Plot 14, Healthcare Corridor, Central District • Phone: 1800-425-0011</text>
  </g>
  <line x1="50" y1="140" x2="750" y2="140" stroke="#0f4c81" stroke-width="2"/>

  <!-- Patient Demographic Box -->
  <rect x="50" y="152" width="700" height="84" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <g transform="translate(68, 172)">
    <text x="0" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Patient Name:</tspan> Gopi</text>
    <text x="240" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">UHID / Patient ID:</tspan> 24BTRSN054</text>
    <text x="480" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Sample ID:</tspan> AP-8492048</text>

    <text x="0" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Age / Gender:</tspan> 22 Y / Male</text>
    <text x="240" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Referred By:</tspan> Dr. OPD General Medicine</text>
    <text x="480" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Sample Type:</tspan> Whole Blood &amp; Serum</text>

    <text x="0" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Collected:</tspan> 08-Sep-2026 08:45 AM</text>
    <text x="240" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Reported:</tspan> 10-Sep-2026 11:15 AM</text>
    <text x="480" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Status:</tspan> Final NABL Verified</text>
  </g>

  <!-- Table Title -->
  <rect x="50" y="252" width="700" height="28" fill="#e2e8f0" rx="4"/>
  <text x="64" y="271" class="sec-title">COMPLETE HEMOGRAM &amp; METABOLIC INVESTIGATION</text>

  <!-- Table Header -->
  <g transform="translate(64, 305)">
    <text x="0" y="0" class="tbl-hdr">INVESTIGATION NAME</text>
    <text x="280" y="0" class="tbl-hdr">OBSERVED VALUE</text>
    <text x="430" y="0" class="tbl-hdr">UNITS</text>
    <text x="530" y="0" class="tbl-hdr">REFERENCE RANGE</text>
    <text x="640" y="0" class="tbl-hdr">FLAG</text>
  </g>
  <line x1="50" y1="315" x2="750" y2="315" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Row 1: Hb -->
  <g transform="translate(64, 342)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">Hemoglobin (Hb)</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#b91c1c">10.2</text>
    <text x="430" y="0" class="tbl-txt">g/dL</text>
    <text x="530" y="0" class="tbl-txt">13.0 - 17.0</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#fee2e2"/>
    <text x="643" y="1" class="flag-low">LOW</text>
  </g>
  <line x1="50" y1="356" x2="750" y2="356" stroke="#f1f5f9"/>

  <!-- Row 2: RBC -->
  <g transform="translate(64, 378)">
    <text x="0" y="0" class="tbl-txt">Total RBC Count</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#b91c1c">3.80</text>
    <text x="430" y="0" class="tbl-txt">mil/µL</text>
    <text x="530" y="0" class="tbl-txt">4.50 - 5.90</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#fee2e2"/>
    <text x="643" y="1" class="flag-low">LOW</text>
  </g>
  <line x1="50" y1="392" x2="750" y2="392" stroke="#f1f5f9"/>

  <!-- Row 3: PCV -->
  <g transform="translate(64, 414)">
    <text x="0" y="0" class="tbl-txt">Packed Cell Volume (PCV)</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#b91c1c">31.5</text>
    <text x="430" y="0" class="tbl-txt">%</text>
    <text x="530" y="0" class="tbl-txt">40.0 - 50.0</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#fee2e2"/>
    <text x="643" y="1" class="flag-low">LOW</text>
  </g>
  <line x1="50" y1="428" x2="750" y2="428" stroke="#f1f5f9"/>

  <!-- Row 4: Ferritin -->
  <g transform="translate(64, 450)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">Serum Ferritin (Iron Reserve)</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#b91c1c">18.0</text>
    <text x="430" y="0" class="tbl-txt">ng/mL</text>
    <text x="530" y="0" class="tbl-txt">30.0 - 400.0</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#fee2e2"/>
    <text x="643" y="1" class="flag-low">LOW</text>
  </g>
  <line x1="50" y1="464" x2="750" y2="464" stroke="#f1f5f9"/>

  <!-- Row 5: Vitamin D3 -->
  <g transform="translate(64, 486)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">25-OH Vitamin D3 Total</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#b91c1c">16.4</text>
    <text x="430" y="0" class="tbl-txt">ng/mL</text>
    <text x="530" y="0" class="tbl-txt">30.0 - 100.0</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#fee2e2"/>
    <text x="643" y="1" class="flag-low">DEFICIENT</text>
  </g>
  <line x1="50" y1="500" x2="750" y2="500" stroke="#f1f5f9"/>

  <!-- Row 6: TLC -->
  <g transform="translate(64, 522)">
    <text x="0" y="0" class="tbl-txt">Total Leucocytes (WBC)</text>
    <text x="280" y="0" class="tbl-txt">7,200</text>
    <text x="430" y="0" class="tbl-txt">/µL</text>
    <text x="530" y="0" class="tbl-txt">4,000 - 11,000</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="536" x2="750" y2="536" stroke="#f1f5f9"/>

  <!-- Row 7: Platelets -->
  <g transform="translate(64, 558)">
    <text x="0" y="0" class="tbl-txt">Platelet Count</text>
    <text x="280" y="0" class="tbl-txt">245,000</text>
    <text x="430" y="0" class="tbl-txt">/µL</text>
    <text x="530" y="0" class="tbl-txt">150,000 - 450,000</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="572" x2="750" y2="572" stroke="#f1f5f9"/>

  <!-- Row 8: Glucose -->
  <g transform="translate(64, 594)">
    <text x="0" y="0" class="tbl-txt">Fasting Blood Sugar</text>
    <text x="280" y="0" class="tbl-txt">94</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">70 - 100</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="608" x2="750" y2="608" stroke="#f1f5f9"/>

  <!-- Row 9: Creatinine -->
  <g transform="translate(64, 630)">
    <text x="0" y="0" class="tbl-txt">Serum Creatinine</text>
    <text x="280" y="0" class="tbl-txt">0.88</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">0.70 - 1.30</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="646" x2="750" y2="646" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Pathologist Notes Box -->
  <rect x="50" y="666" width="700" height="130" rx="6" fill="#f8fafc" stroke="#cbd5e1"/>
  <text x="68" y="690" font-family="Arial" font-size="12" font-weight="bold" fill="#0f4c81">PATHOLOGIST CLINICAL INTERPRETATION &amp; REMARKS:</text>
  <text x="68" y="712" class="tbl-txt">• Peripheral blood smear reveals microcytic, hypochromic red blood cells with anisopoikilocytosis.</text>
  <text x="68" y="730" class="tbl-txt">• Depleted serum ferritin levels (18.0 ng/mL) corroborate true iron deficiency state.</text>
  <text x="68" y="748" class="tbl-txt">• Co-existing 25-OH Vitamin D3 insufficiency (16.4 ng/mL). Renal parameters and glycemic control preserved.</text>
  <text x="68" y="766" class="tbl-txt">• Advised: Oral iron therapy with ascorbic acid, weekly cholecalciferol supplementation, and 6-week hemogram review.</text>

  <!-- Signatures Section -->
  <g transform="translate(80, 880)">
    <line x1="0" y1="0" x2="180" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">P. Soni, DMLT</text>
    <text x="0" y="32" class="hdr-sub">Senior Hematology Technologist</text>
  </g>

  <g transform="translate(490, 880)">
    <line x1="0" y1="0" x2="210" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">Dr. S. Rao, MD (Pathology)</text>
    <text x="0" y="32" class="hdr-sub">Head of Clinical Pathology &amp; Quality</text>
    <text x="0" y="46" class="hdr-sub">Reg. No: MCI-2011/49182</text>
  </g>

  <!-- QR Code & Verification Watermark -->
  <rect x="50" y="990" width="700" height="48" rx="4" fill="#f1f5f9"/>
  <text x="70" y="1018" font-family="monospace" font-size="11" fill="#475569">🔒 MediKiosk Secure Scan: NABL Hash #94A2-24BTRSN054-CBC | Verified against DPDP Act 2023 Digital Vault</text>
</svg>"""

    elif doc_id == DEMO_DOC_222_1["id"]:
        return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1120" width="100%" height="100%">
  <defs>
    <style>
      .hdr-title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 20px; font-weight: 800; fill: #1e3a8a; }
      .hdr-sub { font-family: Arial, sans-serif; font-size: 11px; fill: #475569; }
      .tbl-txt { font-family: Arial, sans-serif; font-size: 11px; fill: #334155; }
      .sec-hdr { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #1e3a8a; }
    </style>
  </defs>
  <!-- Background -->
  <rect width="800" height="1120" fill="#ffffff"/>
  <rect x="25" y="25" width="750" height="1070" rx="8" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="25" y="25" width="750" height="12" fill="#1e3a8a"/>

  <!-- Hospital Header -->
  <g transform="translate(50, 65)">
    <circle cx="28" cy="28" r="26" fill="#eff6ff" stroke="#3b82f6" stroke-width="2"/>
    <text x="28" y="36" font-family="Arial" font-size="24" text-anchor="middle" fill="#3b82f6">🏥</text>
    <text x="70" y="24" class="hdr-title">DISTRICT CIVIL HOSPITAL &amp; MEDICAL COLLEGE</text>
    <text x="70" y="42" class="hdr-sub">DEPARTMENT OF INTERNAL MEDICINE • INPATIENT ADMISSIONS DIVISION</text>
    <text x="70" y="56" class="hdr-sub">Hospital Road, Civil Lines • Official Inpatient Discharge Summary</text>
  </g>
  <line x1="50" y1="140" x2="750" y2="140" stroke="#1e3a8a" stroke-width="2"/>

  <!-- Patient Demographic Header -->
  <rect x="50" y="152" width="700" height="88" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <g transform="translate(68, 174)">
    <text x="0" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Patient Name:</tspan> Gopi</text>
    <text x="250" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">UHID / Patient ID:</tspan> 222</text>
    <text x="490" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">IPD Admission No:</tspan> IPD-2026/8921</text>

    <text x="0" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Age / Gender:</tspan> 26 Y / Male</text>
    <text x="250" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Ward / Bed:</tspan> Male Medical Ward 4 (Bed 12)</text>
    <text x="490" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Consultant:</tspan> Dr. K. Mehta, MD</text>

    <text x="0" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Admission Date:</tspan> 25-Aug-2026 10:15 AM</text>
    <text x="250" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Discharge Date:</tspan> 28-Aug-2026 02:00 PM</text>
    <text x="490" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Discharge Outcome:</tspan> Clinically Resolved</text>
  </g>

  <!-- Diagnosis Section -->
  <rect x="50" y="255" width="700" height="26" fill="#dbeafe" rx="4"/>
  <text x="64" y="273" class="sec-hdr">1. FINAL CLINICAL DIAGNOSIS ON DISCHARGE</text>
  <g transform="translate(68, 302)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">• Primary Diagnosis: Acute Bacterial Gastroenteritis with Moderate Dehydration (Resolved)</text>
    <text x="0" y="20" class="tbl-txt">• Secondary Findings: Mild Transient Hypokalemia (Grade I, fully corrected with IV rehydration)</text>
  </g>

  <!-- Clinical Summary Section -->
  <rect x="50" y="340" width="700" height="26" fill="#dbeafe" rx="4"/>
  <text x="64" y="358" class="sec-hdr">2. CLINICAL PRESENTATION &amp; INPATIENT COURSE</text>
  <g transform="translate(68, 385)">
    <text x="0" y="0" class="tbl-txt">The patient was admitted via Emergency with acute watery diarrhea (7-8 episodes/day), spasmodic umbilical</text>
    <text x="0" y="18" class="tbl-txt">cramps, nausea, and postural dizziness following outside food consumption. On admission, signs of Grade II dehydration</text>
    <text x="0" y="36" class="tbl-txt">were observed. Immediate IV resuscitation with Ringer Lactate and Normal Saline (2,500 mL over first 24 hrs) was</text>
    <text x="0" y="54" class="tbl-txt">administered. Stool routine showed 2-4 pus cells/hpf, culture negative for V. cholerae.</text>
    <text x="0" y="72" class="tbl-txt">Patient was afebrile throughout. By Day 3 (27-Aug), stool frequency normalized to formed consistency.</text>
  </g>

  <!-- Vitals at Discharge -->
  <rect x="50" y="480" width="700" height="55" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="68" y="500" font-family="Arial" font-size="11" font-weight="bold" fill="#1e3a8a">VITAL SIGNS AT TIME OF DISCHARGE:</text>
  <text x="68" y="522" class="tbl-txt">BP: 122/80 mmHg | Pulse: 74 bpm regular | Temp: 98.6 °F (Afebrile) | SpO2: 98% room air | Abdomen: Soft, non-tender</text>

  <!-- Discharge Medications -->
  <rect x="50" y="555" width="700" height="26" fill="#dbeafe" rx="4"/>
  <text x="64" y="573" class="sec-hdr">3. DISCHARGE MEDICATIONS &amp; TREATMENT REGIMEN</text>

  <g transform="translate(68, 605)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">1. Tab O2 (Ofloxacin 200mg + Ornidazole 500mg)</text>
    <text x="20" y="16" class="tbl-txt">Dosage: 1 Tab BD (Twice daily after meals) x 3 more days to complete 5-day total antimicrobial course.</text>

    <text x="0" y="42" class="tbl-txt" font-weight="bold">2. Sachet Econorm (Saccharomyces boulardii 250mg Probiotic)</text>
    <text x="20" y="58" class="tbl-txt">Dosage: 1 Sachet BD (Twice daily before food) x 5 days mixed in lukewarm water or fresh curd.</text>

    <text x="0" y="84" class="tbl-txt" font-weight="bold">3. Electral / Oral Rehydration Salts (WHO-Formula)</text>
    <text x="20" y="100" class="tbl-txt">Dosage: 1 packet in 1 liter clean water. Sip frequently throughout the day for next 3 days.</text>
  </g>

  <!-- Discharge Advice -->
  <rect x="50" y="740" width="700" height="26" fill="#dbeafe" rx="4"/>
  <text x="64" y="758" class="sec-hdr">4. DIETARY ADVICE &amp; FOLLOW-UP PLAN</text>
  <g transform="translate(68, 785)">
    <text x="0" y="0" class="tbl-txt">• Consume fresh semi-solid, bland meals (khichdi, curd rice, boiled potatoes, plain toast) for next 5 days.</text>
    <text x="0" y="18" class="tbl-txt">• Strictly avoid spicy curries, fried snacks, raw salads, unpasteurized milk, and outside street foods.</text>
    <text x="0" y="36" class="tbl-txt">• Routine OPD follow-up in Room 14 after 7-10 days for recovery evaluation.</text>
    <text x="0" y="54" class="tbl-txt">• SOS Emergency Return if recurrent vomiting, high grade fever (>101°F), or blood in stool appears.</text>
  </g>

  <!-- Signatures Section -->
  <g transform="translate(80, 895)">
    <line x1="0" y1="0" x2="180" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">Dr. A. Verma, MBBS</text>
    <text x="0" y="32" class="hdr-sub">Resident Medical Officer, Ward 4</text>
  </g>

  <g transform="translate(490, 895)">
    <line x1="0" y1="0" x2="210" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">Dr. K. Mehta, MD (Medicine)</text>
    <text x="0" y="32" class="hdr-sub">Professor &amp; Senior Consultant</text>
    <text x="0" y="46" class="hdr-sub">Civil Hospital Inpatient Services</text>
  </g>

  <!-- Footer Watermark -->
  <rect x="50" y="990" width="700" height="48" rx="4" fill="#f1f5f9"/>
  <text x="70" y="1018" font-family="monospace" font-size="11" fill="#475569">🔒 MediKiosk Verified Record: Discharge Summary UHID #222-IPD8921 | Hospital Medical Records Archive</text>
</svg>"""

    elif doc_id == DEMO_DOC_222_2["id"]:
        return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1120" width="100%" height="100%">
  <defs>
    <style>
      .hdr-title { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 21px; font-weight: 800; fill: #be123c; }
      .hdr-sub { font-family: Arial, sans-serif; font-size: 11px; fill: #475569; }
      .tbl-hdr { font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; fill: #1e293b; }
      .tbl-txt { font-family: Arial, sans-serif; font-size: 11px; fill: #334155; }
      .flag-high { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #be123c; }
      .flag-norm { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #047857; }
      .sec-hdr { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #be123c; }
    </style>
  </defs>
  <!-- Background -->
  <rect width="800" height="1120" fill="#ffffff"/>
  <rect x="25" y="25" width="750" height="1070" rx="8" fill="none" stroke="#cbd5e1" stroke-width="1.5"/>
  <rect x="25" y="25" width="750" height="12" fill="#be123c"/>

  <!-- Lab Header -->
  <g transform="translate(50, 65)">
    <circle cx="28" cy="28" r="26" fill="#ffe4e6" stroke="#f43f5e" stroke-width="2"/>
    <text x="28" y="36" font-family="Arial" font-size="24" text-anchor="middle" fill="#f43f5e">❤️</text>
    <text x="70" y="24" class="hdr-title">APEX CARDIAC &amp; METABOLIC DIAGNOSTIC CENTRE</text>
    <text x="70" y="42" class="hdr-sub">PREVENTIVE CARDIOLOGY &amp; ADVANCED LIPID PROFILE DIVISION</text>
    <text x="70" y="56" class="hdr-sub">Automated Clinical Chemistry Analyzer • NABL Accredited Facility</text>
  </g>
  <line x1="50" y1="140" x2="750" y2="140" stroke="#be123c" stroke-width="2"/>

  <!-- Patient Box -->
  <rect x="50" y="152" width="700" height="84" rx="6" fill="#f8fafc" stroke="#e2e8f0"/>
  <g transform="translate(68, 172)">
    <text x="0" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Patient Name:</tspan> Gopi</text>
    <text x="250" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Patient ID:</tspan> 222</text>
    <text x="490" y="0" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Lab Reg No:</tspan> APX-LIP-2026/4102</text>

    <text x="0" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Age / Gender:</tspan> 26 Y / Male</text>
    <text x="250" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Specimen:</tspan> 12-Hour Fasting Serum</text>
    <text x="490" y="24" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Collection Date:</tspan> 03-Sep-2026 07:45 AM</text>

    <text x="0" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Clinical Indication:</tspan> Routine Lipid Screening</text>
    <text x="250" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">BMI:</tspan> 26.4 kg/m²</text>
    <text x="490" y="48" class="tbl-txt"><tspan font-weight="bold" fill="#0f172a">Report Date:</tspan> 04-Sep-2026 09:15 AM</text>
  </g>

  <!-- Table Title -->
  <rect x="50" y="252" width="700" height="28" fill="#ffe4e6" rx="4"/>
  <text x="64" y="271" class="sec-hdr">FASTING LIPID PROFILE &amp; CARDIOVASCULAR RISK PANEL</text>

  <!-- Table Header -->
  <g transform="translate(64, 305)">
    <text x="0" y="0" class="tbl-hdr">TEST DESCRIPTION</text>
    <text x="280" y="0" class="tbl-hdr">OBSERVED VALUE</text>
    <text x="430" y="0" class="tbl-hdr">UNITS</text>
    <text x="530" y="0" class="tbl-hdr">REFERENCE RANGE</text>
    <text x="640" y="0" class="tbl-hdr">FLAG</text>
  </g>
  <line x1="50" y1="315" x2="750" y2="315" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Row 1: Total Chol -->
  <g transform="translate(64, 342)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">Total Cholesterol</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#be123c">238.0</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">&lt; 200.0 (Desirable)</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#ffe4e6"/>
    <text x="643" y="1" class="flag-high">HIGH</text>
  </g>
  <line x1="50" y1="356" x2="750" y2="356" stroke="#f1f5f9"/>

  <!-- Row 2: Triglycerides -->
  <g transform="translate(64, 378)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">Serum Triglycerides</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#be123c">198.0</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">&lt; 150.0 (Normal)</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#ffe4e6"/>
    <text x="643" y="1" class="flag-high">HIGH</text>
  </g>
  <line x1="50" y1="392" x2="750" y2="392" stroke="#f1f5f9"/>

  <!-- Row 3: LDL -->
  <g transform="translate(64, 414)">
    <text x="0" y="0" class="tbl-txt" font-weight="bold">LDL Cholesterol (Bad Chol)</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#be123c">152.0</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">&lt; 100.0 (Optimal)</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#ffe4e6"/>
    <text x="643" y="1" class="flag-high">HIGH</text>
  </g>
  <line x1="50" y1="428" x2="750" y2="428" stroke="#f1f5f9"/>

  <!-- Row 4: HDL -->
  <g transform="translate(64, 450)">
    <text x="0" y="0" class="tbl-txt">HDL Cholesterol (Good Chol)</text>
    <text x="280" y="0" class="tbl-txt">44.0</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">40.0 - 60.0</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="464" x2="750" y2="464" stroke="#f1f5f9"/>

  <!-- Row 5: VLDL -->
  <g transform="translate(64, 486)">
    <text x="0" y="0" class="tbl-txt">VLDL Cholesterol</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#be123c">39.6</text>
    <text x="430" y="0" class="tbl-txt">mg/dL</text>
    <text x="530" y="0" class="tbl-txt">&lt; 30.0</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#ffe4e6"/>
    <text x="643" y="1" class="flag-high">HIGH</text>
  </g>
  <line x1="50" y1="500" x2="750" y2="500" stroke="#f1f5f9"/>

  <!-- Row 6: Chol/HDL Ratio -->
  <g transform="translate(64, 522)">
    <text x="0" y="0" class="tbl-txt">Total Chol / HDL Ratio</text>
    <text x="280" y="0" class="tbl-txt" font-weight="bold" fill="#be123c">5.41</text>
    <text x="430" y="0" class="tbl-txt">Ratio</text>
    <text x="530" y="0" class="tbl-txt">&lt; 4.5 (Desirable)</text>
    <rect x="635" y="-12" width="45" height="18" rx="4" fill="#ffe4e6"/>
    <text x="643" y="1" class="flag-high">HIGH</text>
  </g>
  <line x1="50" y1="536" x2="750" y2="536" stroke="#f1f5f9"/>

  <!-- Row 7: HbA1c -->
  <g transform="translate(64, 558)">
    <text x="0" y="0" class="tbl-txt">HbA1c (Glycated Hemoglobin)</text>
    <text x="280" y="0" class="tbl-txt">5.6</text>
    <text x="430" y="0" class="tbl-txt">%</text>
    <text x="530" y="0" class="tbl-txt">&lt; 5.7 (Non-diabetic)</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="572" x2="750" y2="572" stroke="#f1f5f9"/>

  <!-- Row 8: SGPT -->
  <g transform="translate(64, 594)">
    <text x="0" y="0" class="tbl-txt">Serum SGPT (Liver ALT)</text>
    <text x="280" y="0" class="tbl-txt">34</text>
    <text x="430" y="0" class="tbl-txt">U/L</text>
    <text x="530" y="0" class="tbl-txt">&lt; 45</text>
    <rect x="635" y="-12" width="55" height="18" rx="4" fill="#dcfce7"/>
    <text x="642" y="1" class="flag-norm">NORMAL</text>
  </g>
  <line x1="50" y1="608" x2="750" y2="608" stroke="#cbd5e1" stroke-width="1.5"/>

  <!-- Remarks Box -->
  <rect x="50" y="628" width="700" height="120" rx="6" fill="#fff1f2" stroke="#fecdd3"/>
  <text x="68" y="652" font-family="Arial" font-size="12" font-weight="bold" fill="#9f1239">BIOCHEMISTRY INTERPRETATION &amp; CLINICAL IMPRESSION:</text>
  <text x="68" y="674" class="tbl-txt">• Mixed Atherogenic Dyslipidemia with elevated Total Cholesterol (238 mg/dL) and LDL-C (152 mg/dL).</text>
  <text x="68" y="692" class="tbl-txt">• Non-HDL atherogenic burden elevated (Chol/HDL ratio 5.41). Normal HbA1c (5.6%) rules out secondary diabetic dyslipidemia.</text>
  <text x="68" y="710" class="tbl-txt">• Baseline hepatic transaminases (SGPT/SGOT) are well within normal limits, suitable for statin initiation if clinically indicated.</text>
  <text x="68" y="728" class="tbl-txt">• Advised: Lifestyle intervention + physician review for HMG-CoA reductase inhibitor (Statin) therapy.</text>

  <!-- Signatures Section -->
  <g transform="translate(80, 860)">
    <line x1="0" y1="0" x2="180" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">M. Krishnan, MSc</text>
    <text x="0" y="32" class="hdr-sub">Senior Clinical Biochemist</text>
  </g>

  <g transform="translate(490, 860)">
    <line x1="0" y1="0" x2="210" y2="0" stroke="#94a3b8"/>
    <text x="0" y="18" font-family="Arial" font-size="11" font-weight="bold" fill="#1e293b">Dr. Ananya Sen, MD</text>
    <text x="0" y="32" class="hdr-sub">Consultant Biochemist &amp; Lab Director</text>
    <text x="0" y="46" class="hdr-sub">Apex Diagnostics • Reg: APMC-2016/8291</text>
  </g>

  <!-- Footer Watermark -->
  <rect x="50" y="990" width="700" height="48" rx="4" fill="#f1f5f9"/>
  <text x="70" y="1018" font-family="monospace" font-size="11" fill="#475569">🔒 MediKiosk Verified Record: Apex Lipid Panel #222-APX4102 | Authenticated NABL Medical Archive</text>
</svg>"""

    return None
