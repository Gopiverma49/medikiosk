# 🏥 MediKiosk — Smart Multilingual Hospital Intake & Physician Workflow Platform

> **Accessible digital check-in, real-time multi-room queue management, and physician AI verification workspace for busy outpatient hospital departments (OPDs).**  
> Supports **English** and **हिंदी (Hindi)** with large touch controls, voice guidance, live barcode scanning, and multi-room TV token broadcast.

---

## 🌟 System Architecture & Workflow

```mermaid
flowchart TD
    subgraph KIOSK ["🏥 Patient Intake Kiosk (Mobile / Tablet / Kiosk)"]
        A1["1. Language & Mode\n(English / Hindi • Touch / Voice)"]
        A2["2. Patient Identification\n(Barcode Scan / 10-Digit UHID / Quick Register)"]
        A3["3. Past History Confirmation\n(Same Illness vs New Problem)"]
        A4["4. Dynamic Clinical Intake\n(Speech / Touch Symptom Flow)"]
        A5["5. Token Issued\n(Real-Time Audio Chime & Number)"]
        A1 --> A2 --> A3 --> A4 --> A5
    end

    subgraph BACKEND ["⚙️ Real-Time Clinical Engine (FastAPI + SQLite/Postgres)"]
        B1["Clinical Fact Extraction\n(Confidence & Provenance Tracking)"]
        B2["Red Flag & Safety Screening\n(Automated Triage Signals)"]
        B3["Contradiction Detection Engine\n(Cross-Fact & Document Checks)"]
        B4["Deterministic Clinical Summarizer\n(Structured Physician Draft)"]
        B5["WebSocket Token Broadcast Hub\n(Multi-Room Queue Sync)"]
    end

    subgraph STATIONS ["👨‍⚕️ Clinical Workstations & TV Displays"]
        C1["📺 Live Token Display TV\n(Multi-Room Broadcast + Audio Chimes)"]
        C2["👨‍⚕️ Doctor Consultation Workspace\n(Queue Call, Structured Summary, Fact Verification)"]
        C3["⚙️ Hospital Admin & Audit\n(Doctor Accounts, Triage Rules, Accuracy Metrics)"]
    end

    A4 --> B1
    B1 --> B2 & B3 --> B4
    A5 --> B5
    B5 <== "Live WebSocket Sync" ==> C1
    B5 <== "Live WebSocket Sync" ==> C2
    B4 --> C2
```

---

## 🚀 How to Start the App (1-Command Unified Launcher)

### Option 1: Double-Click Launcher (Windows)
Double-click:
```cmd
start_medikiosk.bat
```
*Automatically starts the Backend, Frontend, and Cloudflare Mobile HTTPS Tunnel, opening `http://localhost:3000` in your browser.*

### Option 2: Command Line (Any OS)
```bash
# 1. Install dependencies
npm install

# 2. Start Full Suite (Laptop + Mobile Tunnel)
npm run dev:all
```

*Or start local-only:*
```bash
npm run dev
```

---

## 🌐 Quick Access Portals

| Portal | URL | Description |
| :--- | :--- | :--- |
| **🏠 Portal Launchpad** | [http://localhost:3000](http://localhost:3000) | Hub to launch all patient, doctor, display, and admin portals |
| **🏥 Patient Kiosk** | [http://localhost:3000/patient](http://localhost:3000/patient) | Touch & voice self check-in station for patients |
| **👨‍⚕️ Doctor Station** | [http://localhost:3000/doctor](http://localhost:3000/doctor) | Doctor consultation queue, structured AI summary & verification |
| **📺 Token Display** | [http://localhost:3000/tokens](http://localhost:3000/tokens) | Multi-room live waiting-room TV display with simultaneous doctor calling |
| **⚙️ Admin Station** | [http://localhost:3000/admin](http://localhost:3000/admin) | Physician accounts, triage safety rules & AI accuracy benchmarks |
| **📖 API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive FastAPI Swagger documentation & test sandbox |
| **🗄️ Database Schema** | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Complete reference for all 20 active database tables & relationships |

---

## 📱 Running on Mobile Phones & Tablets

MediKiosk is fully responsive and supports running directly on smartphones and tablets:

1. **Option A (Secure HTTPS Tunnel — Works Anywhere over 4G/5G/Wi-Fi):**
   - Run `npm run dev:all` (or `npm run dev:tunnel`).
   - Copy the generated `https://*.trycloudflare.com` link and open it in Chrome/Safari on your phone.
   - Enables full camera barcode scanning and microphone voice input out of the box.

2. **Option B (Same Wi-Fi Local IP):**
   - Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your laptop's local IPv4 address (e.g. `192.168.1.50`).
   - Open `http://YOUR_LOCAL_IP:3000` on your phone browser.

---

## 🗺️ Step-by-Step Patient Check-In Journey

```mermaid
flowchart TD
    Step1["Step 1: Language & Mode\n(English / Hindi • Touch or Voice)"] --> Step2["Step 2: Enter Patient ID\n(Scan Card Barcode OR Type 10-Digit ID)"]
    
    Step2 --> Lookup{"Found in\nDatabase?"}
    
    Lookup -- "Yes" --> Step3A["Step 3A: Confirm Identity\n(Name, Age, Masked Mobile)"]
    Lookup -- "No" --> Step3B["Step 3B: Quick Registration\n(Name, Mobile, Age, Gender)"]
    
    Step3A --> History{"Has Past Visit\nRecords?"}
    Step3B --> Step5["Step 5: Dynamic Symptoms Intake"]
    
    History -- "Yes" --> Step4["Step 4: Past Illness Choice\n(Same Illness vs New Problem)"]
    History -- "No" --> Step5
    Step4 --> Step5
    
    Step5 --> Summary["Review & Confirm Symptoms"]
    Summary --> SafetyCheck{"Urgent Red Flag\nDetected?"}
    
    SafetyCheck -- "Yes" --> Alert["⚠️ Urgent Medical Alert\n(Immediate Nurse Intervention)"] --> Done
    SafetyCheck -- "No" --> Done["Step 6: Consultation Token Issued\n(Real-Time Audio Chime)"]
    
    Done --> Reset["⏳ Auto-Resets in 7s for Next Patient"]

    style Step1 fill:#f0fdfa,stroke:#0d9488,stroke-width:2px
    style Step2 fill:#f0fdfa,stroke:#0d9488,stroke-width:2px
    style Step3A fill:#f0fdfa,stroke:#0d9488,stroke-width:2px
    style Step3B fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style Step4 fill:#f0fdfa,stroke:#0d9488,stroke-width:2px
    style Step5 fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style Alert fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style Done fill:#dcfce7,stroke:#16a34a,stroke-width:2px
    style Reset fill:#f1f5f9,stroke:#64748b,stroke-width:1px
```

---

## 👨‍⚕️ Doctor Consultation Workspace (4-Tab Interface)

The attending physician consultation workstation (`/doctor`) provides a streamlined 4-tab workflow:

1. **📋 Summary:** Structured view of patient-reported chief complaints, symptom duration, associated symptoms, step details, current daily medications, and known drug allergies.
2. **📜 Past Medical History:** Longitudinal history of previous hospital OPD visits, past diagnoses, and previous treatments.
3. **📄 Documents:** Encounter documents (prescriptions, lab reports, discharge summaries) with extracted OCR text.
4. **💊 Prescription & Medicines:** Interactive prescription builder with instant quick-fill chips for common medications (Dolo 650, Augmentin, Pan 40, Cetirizine, etc.), custom dosage/schedule builder, doctor notes, diagnosis input, and one-click saving to the patient record.

---

## 🧪 Testing & Quality Assurance

The codebase includes an automated test suite verifying AI fallback resilience, contradiction detection, red flag safety rules, FHIR exports, and token queues.

```bash
# Run all backend unit & integration tests
pytest

# Run frontend TypeScript typecheck
npm run typecheck
```

---

## 🔒 Safety & Medical Disclaimer

> [!IMPORTANT]
> **Safety Principle:** MediKiosk is designed to assist hospital intake workflows by collecting structured symptoms and history in advance. It **never** prescribes medications, issues autonomous medical diagnoses, or bypasses clinical oversight. All AI extractions require explicit human verification by a licensed healthcare professional.
