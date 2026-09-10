# 📂 Sample Data Guide — Practice Patients & Test Photos

> **Folder:** `sample_data/`  
> **What it does:** To protect patient privacy and avoid using real people's medical files, this folder contains realistic, 100% synthetic practice data. You can use these files to test the kiosk, try the camera scanner, and run live demos safely.

---

## 📁 What is Inside the `sample_data/` Folder?

```
sample_data/
├── patients.json                  # Sample patient profiles for testing
├── ravi_kumar_encounter.json      # A complete practice medical case
├── sample_prescription.png        # A sample photo of a paper doctor prescription
├── sample_lab_report.png          # A sample photo of a blood test lab report
└── sample_discharge_summary.png   # A sample photo of a hospital discharge summary
```

---

## 📄 What Each File Contains

### 1. Practice Patient Profiles (`patients.json`)
- Contains test patient profiles, including **Ravi Kumar** (Age 52, Male, Kannada & English speaker).
- When you set up the project for the first time, the backend automatically uses this file to create sample patients so you don't start with an empty database.

---

### 2. Complete Practice Health Record (`ravi_kumar_encounter.json`)
This file represents an entire realistic outpatient visit:
- **Main Problem:** Chest pain for 2 days, rated 7 out of 10 in severity.
- **Where it hurts:** Left chest, spreading to the left arm.
- **Other Symptoms:** Sweating and breathlessness.
- **Past Medical History:** Type 2 Diabetes and High Blood Pressure (Hypertension).
- **Daily Medicines:** Metformin 500mg twice daily, Amlodipine 5mg once daily.
- **Drug Allergies:** Allergic to Penicillin.
- **Past Lab Test:** HbA1c blood sugar level of 8.2% (High).

*Tip: This file is great for testing whether the doctor summary and red-flag danger detectors work properly!*

---

### 3. Practice Photos to Scan (`*.png`)

You can hold these photos up to your webcam or phone camera, or upload them in the Patient Kiosk and Medical Report Scanner:

| Image File | What it Looks Like | What the System Reads |
| :--- | :--- | :--- |
| [`sample_prescription.png`](file:///d:/medikiosk/sample_data/sample_prescription.png) | A doctor's paper prescription with clinic header and handwritten medicines. | Reads medicine names like `Paracetamol 650mg`, `Pantoprazole 40mg`, and `Cetirizine 10mg`, plus dosage instructions. |
| [`sample_lab_report.png`](file:///d:/medikiosk/sample_data/sample_lab_report.png) | A biochemistry pathology lab report. | Reads test names (Blood Sugar, Serum Creatinine), test numbers, normal ranges, and highlights `HIGH` values. |
| [`sample_discharge_summary.png`](file:///d:/medikiosk/sample_data/sample_discharge_summary.png) | A formal hospital discharge summary paper. | Reads the patient's admission diagnosis, hospital treatment, and discharge advice. |

---

## 🔒 100% Privacy & Safety Guarantee

Every name, phone number, and medical record in this folder is **entirely fictional and synthetic**. They do not belong to any real human beings, making this project completely safe to share, test, and demonstrate in public without violating any privacy laws.
