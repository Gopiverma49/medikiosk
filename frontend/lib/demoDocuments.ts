import type { DocumentOutDetailed } from "./types";

/**
 * Preloaded Demo Documents for Physician Portal Review
 * Specifically configured for:
 * 1. Patient ID: 24BTRSN054 (1 Comprehensive Laboratory & Metabolic Report)
 * 2. Patient ID: 222 (2 Reports: Inpatient Discharge Summary & Cardiac Lipid Panel)
 */

export const DEMO_DOC_24BTRSN054_1: DocumentOutDetailed = {
  id: "demo-doc-24btrsn054-cbc",
  encounter_id: "demo-enc-24btrsn054",
  patient_id: "24BTRSN054",
  doc_type: "lab_report",
  filename: "Apollo_Pathology_Complete_Hemogram_Metabolic_Panel.pdf",
  status: "confirmed",
  storage_path: "demo/apollo_cbc_report.svg",
  file_url: "/api/documents/demo-doc-24btrsn054-cbc/file",
  page_urls: ["/api/documents/demo-doc-24btrsn054-cbc/file?page=0"],
  created_at: "2026-09-10T10:30:00Z",
  ocr_confidence: 0.98,
  ocr_text: `APOLLO DIAGNOSTICS & CLINICAL PATHOLOGY LAB
NABL ACCREDITED LAB #MC-2041 | ISO 15189:2022 CERTIFIED
Patient Name: Gopi | Age/Sex: 22 Y / Male | Patient ID: 24BTRSN054
Referred By: OPD Medicine | Specimen: Whole Blood (EDTA) & Serum
Collection Date: 08-Sep-2026 08:45 AM | Report Date: 10-Sep-2026 11:15 AM

COMPLETE BLOOD COUNT (CBC) & BIOCHEMISTRY:
- Hemoglobin (Hb): 10.2 g/dL (LOW) [Ref: 13.0 - 17.0]
- Total RBC Count: 3.80 mil/uL (LOW) [Ref: 4.50 - 5.90]
- Packed Cell Volume (PCV): 31.5 % (LOW) [Ref: 40.0 - 50.0]
- MCV: 74.2 fL (LOW) [Ref: 80.0 - 96.0]
- MCH: 24.1 pg (LOW) [Ref: 27.0 - 33.0]
- Platelet Count: 245,000 /uL (NORMAL) [Ref: 150,000 - 450,000]
- Total Leucocyte Count (TLC): 7,200 /uL (NORMAL) [Ref: 4,000 - 11,000]
- Serum Ferritin: 18.0 ng/mL (LOW) [Ref: 30.0 - 400.0]
- 25-OH Vitamin D3: 16.4 ng/mL (DEFICIENT) [Ref: 30.0 - 100.0]
- Fasting Blood Sugar: 94 mg/dL (NORMAL) [Ref: 70 - 100]
- Serum Creatinine: 0.88 mg/dL (NORMAL) [Ref: 0.70 - 1.30]

IMPRESSION & CLINICAL NOTE:
Microcytic hypochromic red cell indices consistent with early Iron Deficiency Anemia. Concomitant Vitamin D3 deficiency. 
Verified by: Dr. S. Rao, MD (Pathology)`,
  extracted_data: {
    report_date: "10-Sep-2026",
    reason_for_visit: "Persistent fatigue, generalized weakness, exertional breathlessness, and low stamina",
    symptoms: [
      { name: "Generalized fatigue & tiredness", duration: "3 weeks" },
      { name: "Mild exertional breathlessness", duration: "10 days" },
      { name: "Dizziness on standing quickly", duration: "1 week" },
    ],
    diagnosis: [
      "Microcytic Hypochromic Anemia (Iron Deficiency)",
      "Moderate Vitamin D3 Deficiency (Hypovitaminosis D)",
    ],
    past_medical_history: [
      "No prior history of gastrointestinal bleeding",
      "Irregular meal timings due to academic/work stress",
    ],
    allergies: ["No known drug or food allergies"],
    vitals_and_examination: {
      blood_pressure: "116/74 mmHg",
      pulse_rate: "78 bpm",
      temperature: "98.4 °F",
      spo2: "99%",
      respiratory_rate: "16 /min",
      examination_notes: "Mild conjunctival pallor (+). Tongue smooth, no glossitis. Chest clear bilaterally. Heart sounds S1/S2 normal.",
    },
    tests: [
      {
        name: "Hemoglobin (Hb)",
        value: "10.2",
        unit: "g/dL",
        reference_range: "13.0 - 17.0",
        flag: "Low",
      },
      {
        name: "Total RBC Count",
        value: "3.80",
        unit: "mil/µL",
        reference_range: "4.50 - 5.90",
        flag: "Low",
      },
      {
        name: "Packed Cell Volume (PCV)",
        value: "31.5",
        unit: "%",
        reference_range: "40.0 - 50.0",
        flag: "Low",
      },
      {
        name: "Serum Ferritin",
        value: "18.0",
        unit: "ng/mL",
        reference_range: "30.0 - 400.0",
        flag: "Low",
      },
      {
        name: "25-OH Vitamin D3 Total",
        value: "16.4",
        unit: "ng/mL",
        reference_range: "30.0 - 100.0",
        flag: "Low",
      },
      {
        name: "Total Leucocytes (WBC)",
        value: "7,200",
        unit: "/µL",
        reference_range: "4,000 - 11,000",
        flag: "Normal",
      },
      {
        name: "Platelet Count",
        value: "245,000",
        unit: "/µL",
        reference_range: "150,000 - 450,000",
        flag: "Normal",
      },
      {
        name: "Fasting Blood Sugar",
        value: "94",
        unit: "mg/dL",
        reference_range: "70 - 100",
        flag: "Normal",
      },
      {
        name: "Serum Creatinine",
        value: "0.88",
        unit: "mg/dL",
        reference_range: "0.70 - 1.30",
        flag: "Normal",
      },
    ],
    imaging_findings: [],
    medicines: [
      {
        name: "Tab Autrin / Ferrous Ascorbate (Iron + Folic Acid)",
        strength: "100mg elemental Iron + 1.5mg FA",
        dosage: "1 tablet",
        route: "Oral",
        frequency: "OD (Once daily)",
        timing: "After Dinner",
        duration: "60 days",
        instructions: "Take with fresh lemon water / orange juice for optimal iron absorption. Do NOT take with milk, tea, or antacids.",
      },
      {
        name: "Cap Calcirol 60K (Cholecalciferol)",
        strength: "60,000 IU",
        dosage: "1 capsule",
        route: "Oral",
        frequency: "Once a week (Sunday)",
        timing: "After Lunch",
        duration: "8 weeks",
        instructions: "Take once weekly with full fat milk. Recheck Vitamin D levels at 10 weeks.",
      },
    ],
    procedures_and_treatments: [
      "Peripheral blood smear examination for RBC morphology",
      "Dietary nutritional counseling for iron and micronutrient replenishment",
    ],
    doctor_advice: [
      "Incorporate iron-rich foods in daily diet: spinach, fenugreek, beetroot, pomegranate, jaggery, lentils, and dates.",
      "Ensure 20 minutes of early morning sun exposure daily for natural Vitamin D synthesis.",
      "Drink at least 2.5 to 3 liters of water daily.",
      "Repeat Complete Hemogram and Serum Ferritin profile after 60 days of therapeutic iron supplementation.",
    ],
    follow_up: {
      required: true,
      date_or_duration: "After 6 weeks for repeat CBC & Serum Ferritin evaluation",
      notes: "SOS if severe dizziness, palpitations, or black colored tarry stools occur",
    },
    timeline_events: [
      {
        date: "08-Sep-2026 08:45 AM",
        event: "Venous blood sample collected at Apollo Central Diagnostics Collection Center",
        category: "Sample Collection",
      },
      {
        date: "09-Sep-2026 06:15 PM",
        event: "Automated Sysmex hematology analyzer run verified by Senior Lab Technologist",
        category: "Laboratory Processing",
      },
      {
        date: "10-Sep-2026 11:15 AM",
        event: "Digital NABL clinical validation signed off by Dr. S. Rao, MD (Pathology)",
        category: "Physician Sign-Off",
      },
      {
        date: "10-Sep-2026 11:30 AM",
        event: "Document uploaded to MediKiosk patient intake record",
        category: "System Ingestion",
      },
    ],
    raw_ocr_summary: "Confirmed NABL Laboratory Report showing Microcytic Hypochromic Anemia (Hb 10.2 g/dL, Ferritin 18 ng/mL) and Vitamin D3 Deficiency (16.4 ng/mL).",
  },
};

export const DEMO_DOC_222_1: DocumentOutDetailed = {
  id: "demo-doc-222-discharge",
  encounter_id: "demo-enc-222-1",
  patient_id: "222",
  doc_type: "discharge_summary",
  filename: "Civil_Hospital_Inpatient_Discharge_Summary_Ward4.pdf",
  status: "confirmed",
  storage_path: "demo/civil_hospital_discharge.svg",
  file_url: "/api/documents/demo-doc-222-discharge/file",
  page_urls: ["/api/documents/demo-doc-222-discharge/file?page=0"],
  created_at: "2026-08-28T14:20:00Z",
  ocr_confidence: 0.99,
  ocr_text: `DISTRICT CIVIL HOSPITAL & MEDICAL COLLEGE
DEPARTMENT OF INTERNAL MEDICINE - INPATIENT WARD 4 (BED 12)
DISCHARGE SUMMARY & CLINICAL COURSE RECORD
Patient: Gopi | Age/Gender: 26 Y / Male | UHID / Hospital ID: 222
Date of Admission: 25-Aug-2026 10:15 AM | Date of Discharge: 28-Aug-2026 02:00 PM
Consultant In-Charge: Dr. K. Mehta, MD (Medicine)

FINAL DIAGNOSIS:
1. Acute Bacterial Gastroenteritis with Moderate Dehydration (Resolved)
2. Hypokalemia - Grade I (Corrected during admission)

HOSPITAL COURSE & SUMMARY:
Patient presented to Emergency triage with severe watery diarrhea (7-8 episodes/day), spasmodic umbilical cramps, nausea, and post-diarrheal lethargy. 
Admitted to Ward 4. Prompt rehydration initiated with IV Ringer Lactate and Normal Saline (total 2.5L infused over first 24 hrs).
Empirical therapy with IV Ceftriaxone switched to oral Ofloxacin + Ornidazole once vomiting subsided.
Stool culture negative for V. cholerae; routine microscopy showed 2-4 pus cells/hpf.
By Day 3 (27-Aug), diarrhea subsided completely, oral diet well tolerated, and patient remained afebrile.
Discharged in fully hemodynamically stable condition.

CONDITION ON DISCHARGE:
Pulse: 74 bpm | BP: 122/80 mmHg | Temp: 98.6 °F | SpO2: 98% room air
Abdomen: Soft, non-tender, active normal peristaltic sounds.`,
  extracted_data: {
    report_date: "28-Aug-2026",
    reason_for_visit: "Acute watery diarrhea (7-8 times/day), diffuse crampy abdominal pain, vomiting, and moderate dehydration",
    symptoms: [
      { name: "Watery diarrhea", duration: "3 days prior to admission" },
      { name: "Crampy abdominal pain (umbilical region)", duration: "3 days" },
      { name: "Nausea & 2 episodes of vomiting", duration: "1 day" },
      { name: "Postural dizziness & dry mouth", duration: "2 days" },
    ],
    diagnosis: [
      "Acute Bacterial Gastroenteritis (Resolved)",
      "Moderate Dehydration (Grade II, Fully Corrected)",
      "Mild Transient Hypokalemia (Corrected)",
    ],
    past_medical_history: [
      "No history of hypertension, diabetes, or chronic kidney disease",
      "History of outside roadside food consumption 24 hours prior to symptom onset",
    ],
    allergies: ["No known drug allergies (NKDA)"],
    vitals_and_examination: {
      blood_pressure: "122/80 mmHg",
      pulse_rate: "74 bpm",
      temperature: "98.6 °F",
      spo2: "98%",
      respiratory_rate: "18 /min",
      examination_notes: "Patient alert, oriented, well-hydrated. Oral mucosa moist. Abdomen soft, non-tender, no organomegaly, normal bowel sounds.",
    },
    tests: [
      {
        name: "Serum Sodium (Na+)",
        value: "138",
        unit: "mmol/L",
        reference_range: "135 - 145",
        flag: "Normal",
      },
      {
        name: "Serum Potassium (K+)",
        value: "4.1",
        unit: "mmol/L",
        reference_range: "3.5 - 5.1",
        flag: "Normal",
      },
      {
        name: "Serum Creatinine",
        value: "0.92",
        unit: "mg/dL",
        reference_range: "0.70 - 1.30",
        flag: "Normal",
      },
      {
        name: "Blood Urea",
        value: "26",
        unit: "mg/dL",
        reference_range: "15 - 45",
        flag: "Normal",
      },
      {
        name: "Stool Pus Cells",
        value: "2 - 4",
        unit: "/hpf",
        reference_range: "0 - 2",
        flag: "High",
      },
      {
        name: "Stool RBCs / Occult Blood",
        value: "Nil",
        unit: "",
        reference_range: "Nil",
        flag: "Normal",
      },
    ],
    imaging_findings: [
      "Abdominal Ultrasound (26-Aug-2026): Mild prominent fluid-filled bowel loops consistent with enteritis; liver, gallbladder, kidneys, and spleen normal.",
    ],
    medicines: [
      {
        name: "Tab O2 / Ofloxacin + Ornidazole",
        strength: "200mg + 500mg",
        dosage: "1 tablet",
        route: "Oral",
        frequency: "BD (Twice daily)",
        timing: "After Meals",
        duration: "3 days",
        instructions: "Complete the full remaining 3-day course. Do not skip doses.",
      },
      {
        name: "Sachet Econorm (Saccharomyces boulardii probiotic)",
        strength: "250mg",
        dosage: "1 sachet",
        route: "Oral",
        frequency: "BD (Twice daily)",
        timing: "Before Food",
        duration: "5 days",
        instructions: "Mix in lukewarm water or curd. Helps restore gut floral balance.",
      },
      {
        name: "Electral / WHO-ORS Sips",
        strength: "WHO standard formula",
        dosage: "1 packet in 1L clean water",
        route: "Oral",
        frequency: "Frequent sips as required",
        timing: "Throughout the day",
        duration: "3 days",
        instructions: "Continue taking oral fluids to prevent recurrence of dehydration.",
      },
    ],
    procedures_and_treatments: [
      "IV fluid resuscitation with Ringer Lactate and Normal Saline (2,500 mL over 24 hrs)",
      "Continuous monitoring of intake/output chart and serum electrolyte balance",
    ],
    doctor_advice: [
      "Maintain a light, freshly prepared semi-solid diet (khichdi, curd rice, boiled potatoes, toast, bananas) for the next 5 days.",
      "Strictly avoid spicy curries, fried foods, raw salads, unpasteurized milk, and outside street food.",
      "Drink only boiled or filtered drinking water.",
      "Maintain rigorous hand hygiene with soap and water before meals.",
    ],
    follow_up: {
      required: true,
      date_or_duration: "Review in OPD after 7-10 days or SOS if fever/vomiting recurs",
      notes: "Emergency SOS consultation if blood in stools, high grade fever (>101°F), or persistent vomiting occurs",
    },
    timeline_events: [
      {
        date: "25-Aug-2026 10:15 AM",
        event: "Emergency admission to Civil Hospital Ward 4; IV cannulation and fluid resuscitation begun",
        category: "Hospital Admission",
      },
      {
        date: "26-Aug-2026 04:00 PM",
        event: "USG Abdomen and Serum Electrolytes reviewed; patient transitioned to oral diet",
        category: "Clinical Review",
      },
      {
        date: "28-Aug-2026 02:00 PM",
        event: "Discharged in fully stable condition with home medication regimen and dietary advice",
        category: "Hospital Discharge",
      },
    ],
    raw_ocr_summary: "Official Civil Hospital Inpatient Discharge Summary: Acute Bacterial Gastroenteritis resolved after 3 days IV fluid and antibiotic therapy. Discharged on oral Ofloxacin-Ornidazole and Econorm probiotic.",
  },
};

export const DEMO_DOC_222_2: DocumentOutDetailed = {
  id: "demo-doc-222-lipid",
  encounter_id: "demo-enc-222-2",
  patient_id: "222",
  doc_type: "lab_report",
  filename: "Apex_Cardiac_Diagnostics_Lipid_Risk_Profile.pdf",
  status: "review_required",
  storage_path: "demo/apex_lipid_profile.svg",
  file_url: "/api/documents/demo-doc-222-lipid/file",
  page_urls: ["/api/documents/demo-doc-222-lipid/file?page=0"],
  created_at: "2026-09-04T09:15:00Z",
  ocr_confidence: 0.97,
  ocr_text: `APEX CARDIAC & METABOLIC DIAGNOSTIC CENTRE
EXCELLENCE IN PREVENTIVE CARDIOLOGY & LIPIDOLOGY
Patient Name: Gopi | Age/Gender: 26 Y / Male | Patient ID: 222
Sample: 12-Hour Overnight Fasting Blood Serum | Collected: 03-Sep-2026 07:45 AM
Report Released: 04-Sep-2026 09:15 AM | Ref By: Self / Executive Health Checkup

COMPREHENSIVE LIPID PROFILE & CARDIOVASCULAR RISK PANEL:
- Total Cholesterol: 238 mg/dL (HIGH) [Desirable: < 200]
- Serum Triglycerides: 198 mg/dL (HIGH) [Normal: < 150, Borderline High: 150-199]
- LDL Cholesterol (Calculated): 152.0 mg/dL (HIGH) [Optimal: < 100, High: 160-189]
- HDL Cholesterol: 44.0 mg/dL (NORMAL) [Protective / Desirable: 40 - 60]
- VLDL Cholesterol: 39.6 mg/dL (HIGH) [Normal: < 30]
- Total Cholesterol / HDL Ratio: 5.41 (HIGH RISK) [Desirable: < 4.5]
- LDL / HDL Ratio: 3.45 (ELEVATED) [Desirable: < 3.0]
- Glycated Hemoglobin (HbA1c): 5.6 % (NORMAL / NON-DIABETIC) [Ref: < 5.7]
- Serum SGPT (ALT): 34 U/L (NORMAL) [Ref: < 45]
- Serum SGOT (AST): 28 U/L (NORMAL) [Ref: < 40]

BIOCHEMICAL IMPRESSION:
Atherogenic Dyslipidemia with primary hypercholesterolemia and elevated LDL-C. 
Preserved glycemic index (HbA1c normal). Liver transaminases normal.
Physician evaluation advised for therapeutic lifestyle changes (TLC) +/- low-dose statin therapy.
Verified by: Dr. Ananya Sen, MD (Biochemistry)`,
  extracted_data: {
    report_date: "04-Sep-2026",
    reason_for_visit: "Routine preventive cardiovascular risk screening due to maternal family history of premature CAD",
    symptoms: [
      { name: "Asymptomatic executive health checkup", duration: "N/A" },
      { name: "Mild exertional fatigue after heavy stairs", duration: "1 month" },
    ],
    diagnosis: [
      "Mixed Hyperlipidemia / Atherogenic Dyslipidemia",
      "Elevated Low-Density Lipoprotein (LDL-C: 152 mg/dL)",
      "Borderline Hypertriglyceridemia (Triglycerides: 198 mg/dL)",
    ],
    past_medical_history: [
      "Sedentary lifestyle with desk-bound IT work (>9 hrs daily)",
      "Strong positive family history: Mother diagnosed with CAD at age 52",
    ],
    allergies: ["No known allergies"],
    vitals_and_examination: {
      blood_pressure: "130/84 mmHg",
      pulse_rate: "76 bpm",
      temperature: "98.4 °F",
      spo2: "99%",
      respiratory_rate: "16 /min",
      examination_notes: "BMI: 26.4 kg/m² (overweight category). Waist circumference: 88 cm. No xanthomas, xanthelasma, or arcus senilis noted. Normal peripheral pulses.",
    },
    tests: [
      {
        name: "Total Serum Cholesterol",
        value: "238",
        unit: "mg/dL",
        reference_range: "< 200",
        flag: "High",
      },
      {
        name: "Serum Triglycerides",
        value: "198",
        unit: "mg/dL",
        reference_range: "< 150",
        flag: "High",
      },
      {
        name: "LDL Cholesterol",
        value: "152.0",
        unit: "mg/dL",
        reference_range: "< 100",
        flag: "High",
      },
      {
        name: "HDL Cholesterol",
        value: "44.0",
        unit: "mg/dL",
        reference_range: "40 - 60",
        flag: "Normal",
      },
      {
        name: "VLDL Cholesterol",
        value: "39.6",
        unit: "mg/dL",
        reference_range: "< 30",
        flag: "High",
      },
      {
        name: "Total Cholesterol / HDL Ratio",
        value: "5.41",
        unit: "Ratio",
        reference_range: "< 4.5",
        flag: "High",
      },
      {
        name: "HbA1c (Glycated Hemoglobin)",
        value: "5.6",
        unit: "%",
        reference_range: "< 5.7",
        flag: "Normal",
      },
      {
        name: "Serum SGPT (ALT)",
        value: "34",
        unit: "U/L",
        reference_range: "< 45",
        flag: "Normal",
      },
      {
        name: "Serum SGOT (AST)",
        value: "28",
        unit: "U/L",
        reference_range: "< 40",
        flag: "Normal",
      },
    ],
    imaging_findings: [],
    medicines: [
      {
        name: "Tab Rosuvas (Rosuvastatin)",
        strength: "10mg",
        dosage: "1 tablet",
        route: "Oral",
        frequency: "OD (Once daily at night)",
        timing: "After Dinner / Bedtime",
        duration: "60 days",
        instructions: "Take consistently at bedtime. Reduces hepatic cholesterol synthesis. Report any severe unexplained muscle cramps.",
      },
      {
        name: "Cap Omega-3 Fish Oil (EPA 180mg / DHA 120mg)",
        strength: "1000mg",
        dosage: "1 capsule",
        route: "Oral",
        frequency: "OD (Once daily)",
        timing: "After Lunch",
        duration: "60 days",
        instructions: "Supports triglyceride reduction and arterial endothelial health.",
      },
    ],
    procedures_and_treatments: [
      "12-hour strict overnight fasting lipid profile assay",
      "Basal Liver Function Test (LFT) screening prior to statin initiation",
    ],
    doctor_advice: [
      "Adopt a Mediterranean heart-healthy dietary pattern rich in oats, chia seeds, almonds, walnuts, olive oil, and fiber.",
      "Eliminate trans-fats, bakery confectionery, palm oil, and deep-fried savory snacks completely.",
      "Engage in moderate-intensity aerobic physical exercise (brisk walking, cycling, swimming) for minimum 40 minutes, 5 days per week.",
      "Limit sugary carbonated beverages and refined carbohydrate intake.",
    ],
    follow_up: {
      required: true,
      date_or_duration: "Review after 8 weeks with repeat Fasting Lipid Profile & SGPT",
      notes: "Verify LDL reduction to target <100 mg/dL and monitor liver tolerance",
    },
    timeline_events: [
      {
        date: "03-Sep-2026 07:45 AM",
        event: "12-hour overnight fasting sample collected at Apex Preventive Cardiology Wing",
        category: "Sample Collection",
      },
      {
        date: "03-Sep-2026 03:30 PM",
        event: "Automated enzymatic photometric lipid analyzer run completed",
        category: "Analyzer Run",
      },
      {
        date: "04-Sep-2026 09:15 AM",
        event: "Clinical biochemistry report authenticated by Dr. Ananya Sen, MD",
        category: "Physician Sign-Off",
      },
      {
        date: "04-Sep-2026 10:00 AM",
        event: "Uploaded and indexed into MediKiosk digital consultation ledger",
        category: "System Ingestion",
      },
    ],
    raw_ocr_summary: "Apex Diagnostic Lab Report: Mixed Dyslipidemia with Total Cholesterol 238 mg/dL, LDL 152 mg/dL, Triglycerides 198 mg/dL. HbA1c normal (5.6%). Rosuvastatin 10mg & lifestyle intervention recommended.",
  },
};

/**
 * Returns the demo preloaded documents for patient 24BTRSN054 or 222.
 * Matches by patient_id or patient UUID.
 */
export function getDemoDocumentsForPatient(patientIdOrCode?: string | null): DocumentOutDetailed[] {
  if (!patientIdOrCode) return [];
  const clean = patientIdOrCode.trim().toUpperCase();

  // Check Patient ID 24BTRSN054 (or internal UUID 13925170-4b76-41c3-86e4-003122ce8997)
  if (clean === "24BTRSN054" || clean.includes("24BTRSN054") || clean === "13925170-4B76-41C3-86E4-003122CE8997") {
    return [DEMO_DOC_24BTRSN054_1];
  }

  // Check Patient ID 222 (or internal UUID 131bfc74-7fa1-4836-8dca-15572534d8ae)
  if (clean === "222" || clean.includes("222") || clean === "131BFC74-7FA1-4836-8DCA-15572534D8AE") {
    return [DEMO_DOC_222_1, DEMO_DOC_222_2];
  }

  return [];
}

/**
 * Returns a specific demo document by ID for full viewing.
 */
export function getDemoDocumentById(docId: string): DocumentOutDetailed | null {
  if (docId === DEMO_DOC_24BTRSN054_1.id) return DEMO_DOC_24BTRSN054_1;
  if (docId === DEMO_DOC_222_1.id) return DEMO_DOC_222_1;
  if (docId === DEMO_DOC_222_2.id) return DEMO_DOC_222_2;
  return null;
}
