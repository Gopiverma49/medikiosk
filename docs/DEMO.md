# 🎯 MediKiosk Interactive Demonstration Guide

This guide walks through the end-to-end hospital workflow using the real application stack and synthetic patient data.

---

## 0. Start the Application

### Option A: Unified 1-Command Launcher (Recommended)
```bash
# Start backend, frontend, and mobile HTTPS tunnel
npm run dev:all
```
*(On Windows, you can simply double-click `start_medikiosk.bat`)*

### Option B: Docker Compose
```bash
docker compose up --build
```

### Access URLs:
- **🏠 Portal Launchpad:** [http://localhost:3000](http://localhost:3000)
- **🏥 Patient Check-In Kiosk:** [http://localhost:3000/patient](http://localhost:3000/patient)
- **👨‍⚕️ Doctor Consultation Station:** [http://localhost:3000/doctor](http://localhost:3000/doctor)
- **📺 Live Multi-Room Token TV Display:** [http://localhost:3000/tokens](http://localhost:3000/tokens)
- **⚙️ Hospital Admin & Audit Station:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **📖 FastAPI Swagger API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 1. Patient Self Check-In Journey (`/patient`)

1. **Language & Mode Selection:**
   - Choose between **English** or **हिंदी (Hindi)**.
   - Choose between **Touch** mode or **Voice-guided** mode.
2. **Patient Identification:**
   - **Returning Patient:** Enter existing 10-digit UHID (e.g. `1000000001` for Ravi Kumar) or click **Scan Barcode Card**.
   - **New Patient:** Click **Quick Register** to enter Name, Age, Gender, and Mobile Number.
3. **Past Medical History Confirmation:**
   - For returning patients with past OPD visits, the kiosk displays past illnesses.
   - Choose **"Same Illness (Follow-up)"** to link to existing condition, or **"New Health Issue"** to start a fresh complaint.
4. **Dynamic Clinical Intake:**
   - **Chief Complaints:** Select primary symptoms (e.g. *Fever*, *Cough*, *Chest Pain*) via large touch cards or simulated voice speech.
   - **Adaptive Steps:**
     - Step 2: Duration / Onset (e.g. *1–3 days*).
     - Step 3: Associated Symptoms (e.g. *Sweating*, *Breathlessness*).
     - Step 4+: Pain Location, Severity Score (1–10 slider/touch), Daily Medications, Known Drug Allergies.
   - Try clicking **"I don't know"** on any question — the system records an explicit `UNKNOWN` certainty rather than coercing it to "No".
5. **Urgent Safety & Red Flag Screening:**
   - If high-risk criteria are met (e.g. *Chest pain + breathlessness + sweating*), the kiosk triggers an **Urgent Medical Alert** advising immediate clinical attention.
6. **Token Generation:**
   - A consultation token is issued (e.g. `A-101`) with assigned room and pleasant audio chime.
   - The token immediately syncs in real-time to the **Token Display TV** and the **Doctor Station**.

---

## 2. Live Waiting-Room Token Display (`/tokens`)

- Open [http://localhost:3000/tokens](http://localhost:3000/tokens) on a separate browser window or monitor.
- Displays multi-room split columns (**Room A**, **Room B**, etc.).
- When a doctor calls a patient, the token card flashes prominently in high-visibility amber/green with an audible hospital chime notification.

---

## 3. Doctor Consultation Station (`/doctor`)

1. **Room & Doctor Setup:**
   - Select your consultation room (e.g. *Room A — General Medicine*) and attending physician profile (e.g. *Dr. Rahul Sharma*).
2. **Queue Management:**
   - Click **"Call Next Patient"** to pull the next waiting token.
   - Click **"⚡ Recall"** to trigger a repeat audio chime for the patient in the waiting lobby.
3. **4-Tab Clinical Workspace:**
   - **📋 Tab 1: Summary**
     - Clean, structured breakdown of patient-reported chief complaints, symptom duration, associated symptoms, question step details, current daily medications, and known allergies.
   - **📜 Tab 2: Past Medical History**
     - Complete timeline of patient's previous hospital visits, historical diagnoses, and past prescribed treatments.
   - **📄 Tab 3: Documents**
     - Uploaded prescriptions, lab reports, and discharge summaries with OCR text extractions.
   - **💊 Tab 4: Prescription & Medicines**
     - **Quick-Fill Common Medicines:** Click instant chips (e.g. *Paracetamol 650mg*, *Amoxicillin+Clavulanate*, *Pantoprazole*, *Cetirizine*, *Cough Syrup*) to auto-populate dose, frequency (1-0-1), duration, and food instructions.
     - **Custom Medicine Input:** Add custom formulations with dosage and directions.
     - **Diagnosis & Doctor Notes:** Enter clinical impressions and advice.
4. **Complete Consultation:**
   - Click **"Save Prescription & Complete"** — automatically saves prescription to the patient's permanent record, clears the active queue, and prepares the workspace for the next patient.

---

## 4. Hospital Admin Station (`/admin`)

- **👨‍⚕️ Doctor Accounts & Room Assignments:** Add/manage physician accounts and assign doctors to OPD rooms.
- **🛡️ Red-Flag Rules:** Inspect and modify versioned JSON safety rules (e.g. `RF_CHEST_001`).
- **🧪 Test Rule Engine:** Test rule inputs interactively to verify trigger conditions in real time without deploying code.
- **📊 Accuracy & Evaluation Metrics:** Click **Run Evaluation** to run `evaluation/run_evaluation.py` and inspect genuine computed precision, recall, F1, and sensitivity metrics.
- **📜 Live Audit Log:** Timestamped chronological audit trail of all patient check-ins, token actions, clinical extractions, and prescription saves.

---

## 5. Simulating AI Provider Fallbacks

Test system resilience by simulating provider downtime:

```bash
# Toggle OCR or ASR provider status
curl -X POST http://localhost:8000/api/admin/ai-status/ocr/toggle
curl -X POST http://localhost:8000/api/admin/ai-status/asr/toggle
```

When providers are forced down, the system gracefully falls back to structured touch selection and manual entry without interrupting patient check-in or doctor workflows.
