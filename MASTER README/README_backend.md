# ⚙️ Backend Guide — The Server & Brain of the System

> **Folder:** `backend/`  
> **What it does:** This is the engine behind MediKiosk. It stores patient files, creates queue token numbers, checks for medical emergency red flags, and sends live updates to the waiting room TV.

---

## 📁 What is Inside the `backend/` Folder?

```
backend/
├── app/                  # The main Python server code
│   ├── routers/          # The doors (API routes) that the website knocks on to send or get data
│   ├── services/         # The smart helpers (reading photos, checking safety rules, writing summaries)
│   ├── main.py           # The starting point that turns on the server
│   ├── database.py       # Connects the server to the database file
│   ├── models.py         # Defines the shape of data (like what is in a Patient or a Token)
│   ├── schemas.py        # Rules checking that incoming data is clean and valid
│   ├── security.py       # Keeps passwords safe and verifies doctor logins
│   ├── seed.py           # Adds sample doctors, rooms, and patients so you can test right away
│   └── config.py         # Settings like server port numbers and security keys
├── ai/                   # AI helpers that read medical text (both offline practice mode and cloud mode)
├── integrations/         # Code to connect with government health systems (like India's ABDM / FHIR)
└── tests/                # 47 automated health checks ensuring the code never breaks
```

---

## 📄 Main Server Files Explained in Plain Words

| File | What it does |
| :--- | :--- |
| [`main.py`](file:///d:/medikiosk/backend/app/main.py) | **The Front Door:** When you run the server, this file starts up, sets up safety rules (CORS), connects all the API routes, and gets the database ready. |
| [`database.py`](file:///d:/medikiosk/backend/app/database.py) | **The Filing Cabinet Helper:** Opens and closes connections to the SQLite database file (`medikiosk.db`) where all hospital visits and tokens are saved. |
| [`models.py`](file:///d:/medikiosk/backend/app/models.py) | **The Blueprints:** Describes what each hospital record looks like — such as what information a `Patient`, `TokenQueue`, `Encounter`, or `Doctor` has. |
| [`schemas.py`](file:///d:/medikiosk/backend/app/schemas.py) | **The Form Checker:** Makes sure nobody sends broken data (like an empty phone number or missing token ID) to the server. |
| [`security.py`](file:///d:/medikiosk/backend/app/security.py) | **The Guard:** Scrambles passwords so they cannot be stolen, and checks doctor/nurse badges (tokens) when they log in. |
| [`seed.py`](file:///d:/medikiosk/backend/app/seed.py) | **The Sample Data Loader:** Fills the fresh database with initial test doctors (`Dr. Sharma`, `Dr. Verma`), rooms (`Room A`, `Room B`), and demo patients. |
| [`config.py`](file:///d:/medikiosk/backend/app/config.py) | **The Settings Page:** Reads configuration like which port to run on and whether to use offline mock AI or cloud AI. |

---

## 🚪 API Routes (`backend/app/routers/`) — Where Data Enters

Think of "routers" as different counter desks in a hospital. When the frontend needs something, it talks to a specific router:

- **[`tokens.py`](file:///d:/medikiosk/backend/app/routers/tokens.py) (Token & Queue Counter):**
  - Gives out token numbers like `OPD-001`.
  - Keeps a live connection (WebSocket) open with the waiting room TV so when a doctor presses "Call Patient", the TV screen updates instantly with no delay.
- **[`patients.py`](file:///d:/medikiosk/backend/app/routers/patients.py) (Reception Desk):**
  - Searches for patients by hospital ID (UHID), phone number, or barcode scan.
  - Creates new accounts if a patient is visiting for the first time.
- **[`documents.py`](file:///d:/medikiosk/backend/app/routers/documents.py) (Document Scanning Counter):**
  - Accepts photos of prescriptions or lab reports and sends them to the OCR service to read the text.
- **[`summaries.py`](file:///d:/medikiosk/backend/app/routers/summaries.py) (Doctor Summary Desk):**
  - Writes a simple, organized paragraph summarizing the patient's illness for the doctor.
- **[`clinical_facts.py`](file:///d:/medikiosk/backend/app/routers/clinical_facts.py) (Symptom Facts Desk):**
  - Saves individual medical facts (like "fever for 3 days" or "takes Metformin 500mg") and lets the doctor click "Approve" or "Reject".
- **[`red_flags.py`](file:///d:/medikiosk/backend/app/routers/red_flags.py) (Emergency Triage Desk):**
  - Looks for danger signs (like severe chest pain or extreme breathing trouble) and alerts hospital staff immediately.
- **[`contradictions.py`](file:///d:/medikiosk/backend/app/routers/contradictions.py) (Discrepancy Checker):**
  - Warns the doctor if the patient says one thing (e.g. "I have no diabetes") but their uploaded prescription lists diabetes medicine.
- **[`admin.py`](file:///d:/medikiosk/backend/app/routers/admin.py) (Hospital Manager Desk):**
  - Lets hospital managers add new doctor rooms, create staff accounts, reset queues, and see history logs.
- **[`auth.py`](file:///d:/medikiosk/backend/app/routers/auth.py) (Staff Login):**
  - Verifies doctor and nurse usernames and passwords.
- **[`fhir.py`](file:///d:/medikiosk/backend/app/routers/fhir.py) (Government Health Record Exporter):**
  - Turns patient records into standard digital health cards (HL7 FHIR / ABDM) used by hospitals across India.

---

## 🧠 Smart Services (`backend/app/services/`) — The Brains

These are background helpers that do heavy thinking:

- **[`ocr_service.py`](file:///d:/medikiosk/backend/app/services/ocr_service.py) (Picture Reader):** Reads the words inside uploaded images of paper prescriptions or lab tests using Tesseract OCR.
- **[`document_extractor.py`](file:///d:/medikiosk/backend/app/services/document_extractor.py) (Medical Information Finder):** Finds medicine names (like Paracetamol), doses (like 500mg), and lab values (like Blood Sugar) from the messy text read by the OCR.
- **[`red_flag_engine.py`](file:///d:/medikiosk/backend/app/services/red_flag_engine.py) (Emergency Watchdog):** A strict list of rules that flags patients needing urgent care before their condition worsens.
- **[`contradiction_engine.py`](file:///d:/medikiosk/backend/app/services/contradiction_engine.py) (Fact Cross-Examiner):** Compares patient answers with past medical records to catch mistakes.
- **[`summary_service.py`](file:///d:/medikiosk/backend/app/services/summary_service.py) (Clinical Drafter):** Organizes patient complaints, symptoms, and duration into a tidy note for the doctor.
- **[`audit.py`](file:///d:/medikiosk/backend/app/services/audit.py) (Black Box Recorder):** Records who logged in, what was changed, and when prescriptions were approved for medical safety.

---

## 🧪 Tests (`backend/tests/`)

We have **47 automated tests** covering every part of the backend. You can run them anytime using:
```bash
pytest backend/tests
```
If anything ever breaks, these tests will tell you immediately before real patients use the system.
