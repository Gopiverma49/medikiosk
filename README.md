# MediKiosk

AI-powered multilingual clinical patient intake and medical document digitization platform designed for high-density outpatient departments (OPDs) and AYUSH institutions in India.

**This is an AI-assisted clinical intake platform.** It does not diagnose patients, prescribe treatment, replace clinicians, or make autonomous clinical decisions. All AI-generated extractions and summaries are initialized as drafts requiring explicit physician verification.

The central architectural principle enforced throughout the codebase:

```
AI ASSISTS → SYSTEM VALIDATES → HUMAN VERIFIES → SYSTEM RECORDS
```
*Never:*
```
AI DECIDES → SYSTEM ACCEPTS
```

---

## Complete Clinical Patient Kiosk Workflow

The patient-facing kiosk ([`/kiosk`](file:///d:/medikiosk-complete/medikiosk/frontend/app/kiosk/page.tsx)) features an accessible, large-touchscreen interface designed for low-literacy and elderly patients:

1. **Stage 1 — Language & Interaction Mode Selection**:
   - **Languages**: Full bilingual support in **English** and **हिंदी (Hindi)** via a centralized translation framework (`translations/en.json` & `translations/hi.json`).
   - **Interaction Modes**: **TOUCH** (large tactile buttons) or **VOICE** (spoken audio guidance with Web Speech API TTS and listening soundwave feedback).
2. **Stage 2 — Patient Identification**:
   - **Scan ID**: Live camera barcode/QR scanner viewfinder with quick 1-click test simulation buttons.
   - **Enter ID Number**: Touchscreen on-screen numeric keypad enforcing exact 10-digit Patient ID validation.
3. **Stage 3 — Patient Database Lookup & Confirmation / Registration**:
   - **Existing Patient**: Displays patient summary (*Name, Age, Gender, Masked Phone*) with explicit confirmation buttons (`[ YES, CONTINUE ]` / `[ NO, ENTER DIFFERENT ID ]`).
   - **New Patient Registration**: If ID is not found, captures *Full Name, 10-Digit Mobile, Age, and Gender*, validates input, displays a confirmation card, and saves the new record to the database.
4. **Stage 4 — Previous Treatment History Intelligence**:
   - **Patient With History**: Choice between **SAME ILLNESS** (viewing past visit date, symptoms, diagnosis, and treatment context) and **NEW ILLNESS**.
   - **Patient Without History**: Automatically displays a brief transition notice and skips directly to symptom intake without asking redundant questions.
5. **Stage 5 — Symptom Collection & Clinical Routing**:
   - Adaptive SOCRATES questionnaire in the chosen language.
   - "I don't know" button preserving certainty as `unknown` without false negatives.
   - Document upload/scan option for prior prescriptions, lab reports, or discharge summaries.
   - AI draft summary generation, red-flag triage evaluation, and instant transmission to the Doctor Dashboard.

---

## Core System Modules

- **Multimodal History Engine (Module A)**: Dual-mode voice and touchscreen interview engine with adaptive clinical branching.
- **AYUSH Clinical Pathway**: Specialized Ayurvedic history intake capturing the **Dashavidha Pariksha** (Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya), Ahara-Vihara, Agni, Koshtha, and Samprapti.
- **Medical Document Intelligence (Module B)**: Digitization and OCR pipeline extracting structured medications, dosages, lab investigation results with reference ranges, and past medical history.
- **Contradiction & Conflict Engine**: Automatically detects cross-source discrepancies (e.g., patient reports "no current medications" while scanned prescription lists active medications).
- **Configurable Red-Flag Triage**: Evaluates emergency symptoms (e.g., acute chest pain with dyspnea/sweating/radiation) and triggers priority triage alerts before routine consultation.
- **Physician Clinical Summary (Module C)**: Synthesizes conversational history, digitized documents, and lab findings into a standard structured summary with 1-click physician verification, editing, and correction.
- **DPDP Act 2023 & ABDM/FHIR Integration (Module D)**: Audio-guided granular patient consent, ABHA ID linking, and FHIR R4 Bundle exports.

---

## Test Patient Accounts & Scenarios

| Patient ID | Name | Age / Gender | Treatment History | Expected Kiosk Flow |
| :--- | :--- | :--- | :--- | :--- |
| **`1000000001`** | Rahul Kumar | 42, Male | **Yes** (Fever & Viral Infection, 12 Aug 2026) | Existing Patient → `[ SAME ILLNESS ]` / `[ NEW ILLNESS ]` prompt |
| **`1000000002`** | Priya Sharma | 30, Female | **None** | Existing Patient → Automatically skips to Symptom Collection |
| **`9999999999`** | *(New)* | *(Any)* | **None** | ID Not Found → Registration Form → Save → Symptom Collection |

---

## Main Real Web Application Portals

The platform is structured into three primary production portals connected to the FastAPI backend and database:

1. **🏥 Patient Intake Kiosk (`/patient` or `/kiosk`)**:
   - 5-stage patient intake with English & Hindi localization.
   - Touchscreen numeric keypad with 10-digit validation and live camera QR/barcode scanner.
   - Database lookup, new patient registration, treatment history branching (*Same vs New Illness*), and adaptive SOCRATES symptom collection.
2. **👨‍⚕️ Doctor Consultation Workspace (`/doctor` or `/doctor/dashboard`)**:
   - Real-time patient queue switcher to review any patient record.
   - Review clinical facts with confidence scores and provenance.
   - Cross-source contradiction resolution panel with audit trail.
   - 1-click verification, correction, or rejection of AI clinical summary drafts.
   - FHIR R4 standard bundle export.
3. **⚙️ Hospital Admin Console (`/admin`)**:
   - Red-flag rule editor and validator.
   - AI precision/recall evaluation benchmark execution against ground-truth datasets.
   - Real-time clinical audit log inspection.

---

## How to Run MediKiosk

### Step 1: Start Backend API (FastAPI + Database)
```bash
cd backend
python -m app.seed          # Seeds demo users, test patients (with/without history) + red-flag rules
uvicorn app.main:app --reload --port 8000
```
- Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- API Health Check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

### Step 2: Start Frontend Web App (Next.js)
```bash
cd frontend
npm install
npm run dev
```
- **🏠 Main Launchpad**: [http://localhost:3000](http://localhost:3000)
- **🏥 Patient Portal**: [http://localhost:3000/patient](http://localhost:3000/patient)
- **👨‍⚕️ Doctor Portal**: [http://localhost:3000/doctor](http://localhost:3000/doctor)
- **⚙️ Admin Portal**: [http://localhost:3000/admin](http://localhost:3000/admin)

### Docker Compose Stack (Production Mode)
```bash
cp .env.example .env
docker compose up --build
```
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:8000](http://localhost:8000)

---

## Project Structure

```
medikiosk/
  backend/            FastAPI + SQLAlchemy + Alembic (see docs/ARCHITECTURE.md)
    app/              models, schemas, routers, services, seed data
    ai/providers/     pluggable ASR/OCR/NLP/Summary/Translation abstraction layer
    integrations/     FHIR R4 / ABDM / HIS interoperability layer
    alembic/          database migrations
    tests/            Pytest suite (28 unit & integration tests)
  frontend/           Next.js 14 (App Router) + TypeScript + Tailwind CSS
    app/              / (Portal Launchpad), /patient, /doctor, /admin
    components/       KioskKeypad, KioskScanner, KioskStepIndicator, KioskVoiceIndicator, ClinicalComponents
    lib/              API client, voice service, translation helper, types
    translations/     en.json, hi.json (centralized localization)
  evaluation/         Synthetic ground-truth datasets + run_evaluation.py harness
  sample_data/        Sample synthetic prescription, lab report, discharge summary
  docs/               Detailed architecture, API, demo walkthrough, and security specs
  docker-compose.yml
  .env.example
```

---

## Testing & Evaluation

### Run Backend Tests (Pytest)
```bash
cd backend
pytest -v
```
*(Executes 28 automated unit & integration tests covering kiosk lookup/registration/history branching, AI fallbacks, contradiction detection, red-flag triggers, verification state machines, and FHIR export).*

### Run AI Evaluation Benchmark
```bash
python evaluation/run_evaluation.py
```
*(Evaluates precision, recall, and F1 across symptom extraction, multilingual normalization, medication/allergy extraction, and red-flag sensitivity; outputs `evaluation/results.json` and `evaluation/report.html`).*

---

## Demo Credentials (Staff)

Seeded synthetic test accounts:
- **Doctor**: `doctor` / `doctor123` *(role: DOCTOR)*
- **Patient**: `patient` / `patient123` *(role: PATIENT)*
- **Triage Nurse**: `triage` / `triage123` *(role: TRIAGE)*
- **Administrator**: `admin` / `admin123` *(role: ADMIN)*

---

## Documentation Links

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — System architecture, clinical data model, verification state machines, contradiction engine.
- [docs/API.md](docs/API.md) — Complete REST API endpoint reference.
- [docs/DEMO.md](docs/DEMO.md) — Step-by-step 22-stage acceptance criteria walkthrough.
- [docs/SECURITY.md](docs/SECURITY.md) — DPDP Act 2023 compliance, RBAC, session management, and audit logging.
- [docs/EVALUATION.md](docs/EVALUATION.md) — Benchmark methodology and ground-truth validation.
