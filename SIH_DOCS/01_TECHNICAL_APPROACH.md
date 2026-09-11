# 🔬 Smart India Hackathon (SIH) — Technical Approach

> **Project Title:** MediKiosk — AI-Assisted Multilingual Clinical Intake, Document Digitization & Real-Time OPD Orchestration  
> **Target Track:** Healthcare & Biomedical Technology / Smart Automation  
> **Domain:** Outpatient Department (OPD) Automation, Clinical Decision Support, ABDM Interoperability  

---

## 1. Problem Statement & Healthcare Reality in India

Public healthcare infrastructure across India faces severe throughput and accessibility bottlenecks in outpatient departments (OPDs):

| Clinical Metric | Indian Reality (Public Hospitals / PHCs / CHCs) | Standard / WHO Benchmark | Impact on Care |
| :--- | :--- | :--- | :--- |
| **Doctor-to-Patient Ratio** | **1 : 1,456** (National Health Profile) | 1 : 1,000 | Overburdened physicians, physical burnout |
| **Average Consultation Time** | **2.0 to 3.5 minutes** per patient | 15.0 to 20.0 minutes | Incomplete history-taking, missed red flags |
| **Intake / Queue Waiting Time** | **45 to 120 minutes** in unmanaged physical lines | < 15 minutes | Chaotic waiting halls, lost patient records |
| **Language Disconnect** | 22 Official Languages; millions illiterate in English/Hindi | Native Regional Comprehension | Miscommunication of crucial symptoms |
| **Paper Document Fragment** | Handwritten prescriptions, faded thermal receipts | Structured Longitudinal EHR | Drug-drug interactions, redundant tests |

**The MediKiosk Technical Mandate:** Automate the pre-consultation clinical intake process at the hospital entrance, extracting structured clinical facts, evaluating emergency triage flags, and detecting clinical contradictions before the patient even steps into the doctor's room.

---

## 2. Technical Methodology & Core Pipeline

```mermaid
flowchart TD
    subgraph INTAKE ["1. Patient Self-Service Tier (/patient)"]
        A1["Language Selection\n(Kannada, Hindi, Marathi, Tamil, Odia, Nepali, English)"]
        A2["Interaction Choice\n(Voice Guidance vs Touchscreen)"]
        A3["Patient ID Verification\n(Barcode Scan / 10-Digit UHID / Quick Register)"]
        A4["Longitudinal Linkage\n(Same Ongoing Illness vs New Episode)"]
        A5["Adaptive Symptom Intake\n(Dynamic Context-Aware Clinical Flow)"]
        A6["Prescription / Report Capture\n(On-Device Camera OCR Scan)"]
        A1 --> A2 --> A3 --> A4 --> A5 --> A6
    end

    subgraph NORMALIZATION ["2. Normalization & Provenance Tier"]
        B1["Speech Recognition / Touch Text"]
        B2["Language-Neutral Concept Normalizer\n(clinical_schema.py)"]
        B3["Confidence & Provenance Tagging\n(source, confidence, verification_status)"]
        A5 --> B1 --> B2 --> B3
    end

    subgraph ENGINES ["3. Deterministic Clinical Reasoning Tier (FastAPI)"]
        C1["Adaptive Question Engine\n(Certainty: confirmed / denied / unknown)"]
        C2["Document & Medication Extractor\n(Rx Regex + OCR Parsing)"]
        C3["Configurable Red-Flag Triage Engine\n(JSON Rule Evaluator)"]
        C4["Contradiction Detection Engine\n(Cross-Fact & Document Verification)"]
        C5["Deterministic SOAP Summarizer\n(Zero-Hallucination Clinical Draft)"]
        
        B3 --> C1
        A6 --> C2
        C1 & C2 --> C3
        C1 & C2 --> C4
        C1 & C2 & C3 & C4 --> C5
    end

    subgraph OUTPUTS ["4. Healthcare Delivery & Orchestration Tier"]
        D1["Real-Time Token Broadcast Hub\n(WebSocket /ws/tokens)"]
        D2["Multi-Room Token Display TV (/tokens)\n(Audio Chime + Split Columns)"]
        D3["Physician Clinical Workspace (/doctor)\n(Structured Summary + Fact Audit)"]
        D4["FHIR R4 Bundle Export (/api/fhir)\n(ABDM & Interoperability Ready)"]
        
        C3 -- "Emergency Alert" --> D1
        C1 -- "Intake Completed" --> D1
        D1 --> D2
        D1 --> D3
        C5 --> D3
        C5 --> D4
    end
```

---

## 3. Deep-Dive: Core Technical Components & Algorithms

### 3.1. Language-Neutral Clinical Schema (`clinical_schema.py`)
India's multilingual diversity makes storing raw localized strings dangerous for clinical safety rules. MediKiosk enforces a **two-layer clinical architecture**:
1. **Perception Layer:** Accommodates regional patient speech/text in Hindi, Kannada, Marathi, Tamil, Odia, Nepali, and English.
2. **Canonical Schema Layer:** Instantly normalizes clinical concepts into structured, language-neutral identifiers aligned with SNOMED-CT / ICD-10 conceptual keys:

$$\text{Patient Input (e.g. "ಛಾತಿ ನೋವು" / "सीने में दर्द")} \xrightarrow{\text{ASR / Parser}} \text{Concept: } \mathtt{chest\_pain}$$

Every fact is stored as an atomic `ClinicalFact` record maintaining provenance:
```json
{
  "id": "7b8f9e12-4c22-4a90-8d2b-6f81a7b6c501",
  "encounter_id": "e30f1b21-...",
  "concept": "chest_pain",
  "label": "Left-sided retrosternal chest pain",
  "value": true,
  "certainty": "confirmed",
  "source": "PATIENT_SPOKEN",
  "source_language": "kn",
  "confidence": 0.96,
  "verification_status": "UNVERIFIED"
}
```

### 3.2. Dynamic Adaptive Symptom Engine (`AdaptiveSymptomEngine.tsx`)
Rather than confronting patients with overwhelming static questionnaires, MediKiosk implements an **adaptive decision tree algorithm**:
- **Root Trigger:** Chief complaint selection (e.g., Chest Pain, Fever, Cough, Headache, Abdominal Pain).
- **Dynamic Branching:** Subsequent questions are evaluated on-the-fly based on prior answers.
- **Three-State Epistemic Certainty:**
  - `confirmed` (Patient explicitly affirms symptom)
  - `denied` (Patient explicitly denies symptom)
  - `unknown` (Patient does not know or skipped)
- **Emergency Circuit-Breaker:** If an answer triggers an acute red-flag threshold (e.g., chest pain radiating to left arm + diaphoresis), the flow immediately signals emergency triage.

### 3.3. Multi-Modal Document Extraction & OCR Pipeline (`document_extractor.py`)
Patients frequently bring bundles of old handwritten paper prescriptions and laboratory reports:
1. **Image Preprocessing:** Grayscale conversion, Otsu binarization, skew correction, and noise reduction.
2. **OCR Engine:** Tesseract.js client-side fallback / server-side Tesseract OCR / Google Vision API.
3. **Deterministic Clinical Regex Extractors:**
   - **Medications:** Matches drug names, formulations (Tab, Cap, Syrup), strengths (500mg, 5mg), and frequency abbreviations (`OD`, `BD`, `TID`, `QID`, `SOS`, `1-0-1`, `once daily`).
   - **Lab Investigations:** Regex parsing of quantitative lab parameters (HbA1c, Blood Glucose, Serum Creatinine, Hemoglobin, Platelet count).
   - **Diagnoses & Past History:** Extracted and linked to previous treatment encounters.

### 3.4. Deterministic Contradiction Detection Engine (`contradiction_engine.py`)
Hallucinations and clinical inconsistencies are lethal in healthcare. MediKiosk enforces an algorithmic, rule-based contradiction detector that cross-references patient kiosk answers against extracted medical documents:

```mermaid
flowchart LR
    A["Patient Kiosk Statement\n('I do not have Diabetes')"] --> C{"Cross-Validation\nEngine"}
    B["Scanned Document Extraction\n(Active Rx: Metformin 500mg BD\nLab: HbA1c 8.4%)"] --> C
    C -->|Conflict Detected| D["⚠️ Contradiction Flag Raised\nLevel: WARNING\nStatus: UNRESOLVED"]
    D --> E["Physician Consultation Workspace\n(Highlighted in Amber with Audit Trail)"]
```

**Resolution Workflow:** Only an authenticated physician can resolve a contradiction (`PHYSICIAN_VERIFIED` or `PHYSICIAN_CORRECTED`) with single-click rationale recording.

### 3.5. JSON-Driven Configurable Red-Flag & Triage Engine (`red_flag_engine.py`)
Hospital administrators and chief medical officers can define and version clinical red-flag rules in pure JSON without writing backend code:

```json
{
  "rule_id": "RED_FLAG_ACUTE_CORONARY",
  "category": "cardiovascular",
  "severity": "CRITICAL",
  "conditions": {
    "all": [
      { "concept": "chest_pain", "operator": "==", "value": true },
      { "concept": "pain_radiation", "operator": "==", "value": "left_arm" }
    ]
  },
  "action": {
    "triage_priority": "EMERGENCY_RED",
    "display_alert": "Suspected Acute Coronary Syndrome (ACS)",
    "queue_jump": true
  }
}
```
- **Execution Speed:** In-memory AST evaluation executes in $< 2\text{ ms}$.
- **Safety Guarantee:** Rule evaluations are logged in immutable `AuditLog` rows for medicolegal compliance.

### 3.6. Deterministic SOAP Clinical Summarizer (`summary_service.py`)
Rather than relying on unconstrained generative LLMs that risk clinical hallucinations, MediKiosk generates clinical notes deterministically according to the standard **SOAP (Subjective, Objective, Assessment, Plan)** format:
- **Subjective:** Chief complaints, onset, duration, severity, and associated symptoms.
- **Objective:** Vitals recorded at intake, OCR-extracted laboratory parameters.
- **Assessment:** Triage classification, flagged red-flags, and noted contradictions.
- **Plan:** Active medications, suggested investigations, and physician prescription draft.

---

## 4. Real-Time Token Orchestration Architecture

```mermaid
sequenceDiagram
    autonumber
    actor P as Patient
    participant K as Kiosk Terminal (/patient)
    participant B as Backend Server (FastAPI)
    participant WS as WebSocket Hub (/ws/tokens)
    participant TV as Waiting TV Display (/tokens)
    participant D as Doctor Station (/doctor)

    P->>K: Completes Intake & Submits
    K->>B: POST /api/tokens/generate {patient_id, encounter_id}
    B->>B: Sequence Token (e.g., A-101), assign room
    B->>WS: Broadcast TOKEN_CREATED
    WS->>TV: Push new token to Waiting Column
    WS->>D: Push patient to Doctor Live Queue
    K->>P: Displays & Prints Token Slip A-101

    Note over D, TV: When Doctor is Ready for Next Patient
    D->>B: POST /api/tokens/call {token_id: A-101, room: "Room 1"}
    B->>WS: Broadcast TOKEN_CALLED {token: A-101, room: "Room 1"}
    WS->>TV: Flashes Room 1 Card, triggers Chime Audio
    WS->>D: Loads Patient Clinical Summary into Workspace
    TV->>P: "Token A-101 proceed to Room 1"
```

---

## 5. Technical Highlights & Innovation Matrix

| Feature | Legacy Hospital System | Generic AI Chatbot | MediKiosk Innovation |
| :--- | :--- | :--- | :--- |
| **Data Normalization** | Manual reception typing | Free-text unstructured text | Language-neutral concept keys (`SNOMED` aligned) |
| **Safety Verification** | None | Probabilistic (hallucination risk) | **100% Deterministic Rule Engine** (0% hallucination) |
| **Contradiction Detection** | Manual chart review (often missed) | Inconsistent | Automated cross-fact & document contradiction check |
| **Network Architecture** | Heavy centralized server | Cloud internet mandatory | **LAN-First Offline Resilience** (Works without WAN) |
| **Interoperability** | Siloed proprietary vendor format | Raw text strings | Native **FHIR R4 Bundle** (`/api/fhir/encounter/{id}`) |
| **Queue Integration** | Disconnected paper tokens | Disconnected | Real-time WebSocket multi-room sync + audio chime |
