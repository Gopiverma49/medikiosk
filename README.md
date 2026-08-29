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

## Quick Start (Live Server)

Start the entire platform once in continuous live development mode with instant Hot Module Replacement (HMR) — **no restarts needed when editing code files**:

### Option 1: 1-Click Launcher (Windows)
Double-click:
```cmd
start_medikiosk.bat
```
*(Automatically seeds the database, opens the browser, and starts both backend and frontend live servers).*

### Option 2: 1-Command Unified Runner (Terminal)
```bash
npm install
npm run dev
```
*(Uses `concurrently` to run the FastAPI backend on Port 8000 and Next.js frontend on Port 3000 with real-time auto-reloading).*

### Option 3: Docker Compose (Live Hot-Reload Stack)
```bash
docker compose up
```
*(Runs Postgres, FastAPI backend, and Next.js frontend with live volume mounts — file edits reload automatically inside containers).*

---

## Application Portals

Once running, access the portals at:
- **🏠 Main Launchpad**: [http://localhost:3000](http://localhost:3000)
- **🏥 Patient Portal**: [http://localhost:3000/patient](http://localhost:3000/patient)
- **👨‍⚕️ Doctor Portal**: [http://localhost:3000/doctor](http://localhost:3000/doctor)
- **⚙️ Admin Portal**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **📖 API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Complete Clinical Patient Kiosk Workflow

The patient-facing kiosk ([`/patient`](file:///d:/medikiosk/frontend/app/patient/page.tsx)) features an accessible, large-touchscreen interface designed for low-literacy and elderly patients:

1. **Stage 1 — Language & Interaction Mode Selection**:
   - **Languages**: Full bilingual support in **English** and **हिंदी (Hindi)** via a centralized translation framework (`translations/en.json` & `translations/hi.json`).
   - **Interaction Modes**: **TOUCH** (large tactile buttons) or **VOICE** (spoken audio guidance with Web Speech API TTS and listening soundwave feedback).
2. **Stage 2 — Patient Identification**:
   - **Scan ID**: Live camera barcode/QR scanner viewfinder with quick 1-click test simulation buttons and `← Back` option.
   - **Enter ID Number**: Touchscreen on-screen numeric keypad enforcing exact 10-digit Patient ID validation, `✓ Enter` confirmation, and centered `← Back` navigation.
3. **Stage 3 — Patient Database Lookup & Confirmation / Registration**:
   - **Existing Patient**: Displays patient summary (*Name, Age, Gender, Masked Phone*) with explicit confirmation buttons and `← Back` option.
   - **New Patient Registration**: If ID is not found, captures *Full Name, 10-Digit Mobile, Age, and Gender*, validates input, displays a confirmation card, and provides seamless `← Back` navigation to edit details or return to ID entry.
4. **Stage 4 — Previous Treatment History Intelligence**:
   - **Patient With History**: Choice between **SAME ILLNESS** (viewing past visit date, symptoms, diagnosis, and treatment context) and **NEW ILLNESS**, with `← Back` support.
   - **Patient Without History**: Automatically displays a brief transition notice and skips directly to symptom intake without asking redundant questions.
5. **Stage 5 — Symptom Collection & Clinical Routing**:
   - Adaptive SOCRATES questionnaire in the chosen language with question-by-question `← Back` revision.
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

## Development & Validation Commands

| Command | Description |
| :--- | :--- |
| **`npm run dev`** | Starts both Backend (Port 8000) and Frontend (Port 3000) with live reload. |
| **`npm run typecheck`** | Non-destructive TypeScript typecheck without wiping or locking `.next/` cache. |
| **`npm run seed`** | Reseeds demo users, test patients, and clinical red-flag rules. |
| **`docker compose up`** | Starts live containerized stack with volume mounts. |

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
