# 📚 Docs Guide — Instruction Manuals & Blueprints

> **Folder:** `docs/`  
> **What it does:** This folder contains the blueprints, technical guides, database tables, and presentation walkthroughs for the entire project.

---

## 📁 What is Inside the `docs/` Folder?

```
docs/
├── API.md                     # List of all server doors (endpoints) and how to talk to them
├── ARCHITECTURE.md            # The big picture drawing showing how all parts talk to each other
├── DATABASE_SCHEMA.md         # A simple guide to all 20 tables in our hospital database
├── DEMO.md                    # A step-by-step script to show off MediKiosk in a live demo
├── EVALUATION.md              # How we measure the accuracy and safety of our medical AI
├── MOBILE_SETUP_GUIDE.md      # How to run the kiosk on your smartphone (Wi-Fi or Web Link)
└── SECURITY.md                # How we keep patient health data private and secure
```

---

## 📄 What Each Document Explains (In Plain Words)

### 1. [`ARCHITECTURE.md`](file:///d:/medikiosk/docs/ARCHITECTURE.md) — The Big Picture
- Explains the 4 layers of MediKiosk:
  1. **Screens:** What the patient and doctor see (Next.js).
  2. **Server:** The traffic controller that coordinates everything (FastAPI).
  3. **Medical Logic:** The rule checker that looks for emergency danger signs.
  4. **Database:** The filing cabinet that stores records safely.
- Has diagrams showing what happens step-by-step from when a patient walks in to when the prescription is signed.

---

### 2. [`DATABASE_SCHEMA.md`](file:///d:/medikiosk/docs/DATABASE_SCHEMA.md) — The Filing Cabinet
- Explains the **20 tables** in our database in plain English:
  - **`patients`**: Name, phone number, age, gender, and preferred language.
  - **`token_queue`**: Token number (e.g. `OPD-001`), current status (`WAITING`, `CALLED`, `COMPLETED`), and assigned room.
  - **`encounters`**: Every visit a patient makes to the hospital.
  - **`clinical_facts`**: Extracted symptoms, duration, and severity.
  - **`consultation_rooms`**: The doctor rooms (Room A, Room B, etc.).
  - **`users`**: Logins for doctors and hospital administrators.
  - **`audit_logs`**: A black-box record of every doctor action for hospital safety.

---

### 3. [`DEMO.md`](file:///d:/medikiosk/docs/DEMO.md) — How to Give a Great Presentation
- A ready-to-use presentation script for showing MediKiosk to hospital directors, evaluators, or hackathon judges.
- Gives you two ready-made test personas:
  - **Persona 1 (Ravi Kumar - Returning Patient):** Show how quick it is to check in for a follow-up visit.
  - **Persona 2 (Emergency Walk-In):** Show how reporting severe chest pain triggers an instant emergency warning on the screen.
- Shows how to demonstrate the multi-room TV board playing the chime sound.

---

### 4. [`MOBILE_SETUP_GUIDE.md`](file:///d:/medikiosk/docs/MOBILE_SETUP_GUIDE.md) — Phone Setup
- Shows how to open the patient kiosk on any smartphone:
  - **Universal Mobile QR Code (Option A):** Run `npm run dev:all` (or `start_medikiosk.bat`), scan the single unified terminal QR code, and MediKiosk opens immediately on your phone—working seamlessly on both the local clinic Wi-Fi and external 4G/5G mobile data with automated SSH keepalive.
  - **Local LAN IP:** Access via `http://<laptop-ip>:3000` for pure offline intranet hospital deployments.

---

### 5. [`SECURITY.md`](file:///d:/medikiosk/docs/SECURITY.md) — Privacy & Protection
- Explains how we protect patient health data:
  - Encrypting data so hackers cannot read it.
  - Scrambling doctor passwords with bcrypt so they can never be stolen.
  - Making doctors review and approve any AI-suggested summaries before they become official medical notes.

---

### 6. [`API.md`](file:///d:/medikiosk/docs/API.md) & [`EVALUATION.md`](file:///d:/medikiosk/docs/EVALUATION.md)
- **`API.md`:** Technical list of web addresses for developers who want to connect other hospital software to MediKiosk.
- **`EVALUATION.md`:** Details our testing method to ensure the medical AI scores above 99% on catching emergency danger signs.

---

## 🏆 Smart India Hackathon (SIH) Master Dossiers (`SIH_DOCS/`)

For grand evaluations, technical juries, and hackathon reviewers, the repository includes a complete, high-impact documentation suite in the [`SIH_DOCS/`](file:///d:/medikiosk/SIH_DOCS/README.md) directory:

| Document | Focus & Highlights |
| :--- | :--- |
| **[`SIH_DOCS/README.md`](file:///d:/medikiosk/SIH_DOCS/README.md)** | **Master Pitch & Jury Map:** Executive problem statement, innovation matrix, live demo checklist, and rapid judge Q&A defense. |
| **[`01_TECHNICAL_APPROACH.md`](file:///d:/medikiosk/SIH_DOCS/01_TECHNICAL_APPROACH.md)** | **Technical Approach:** 7-language concept normalization, hybrid offline/cloud NLP, clinical extraction, and red-flag rules. |
| **[`02_FEASIBILITY_AND_VIABILITY.md`](file:///d:/medikiosk/SIH_DOCS/02_FEASIBILITY_AND_VIABILITY.md)** | **Feasibility & Viability:** Deployment topologies (from ₹25,000 PHC kiosk to Tertiary hospital), ₹0.00 zero-marginal inference cost, ABDM M1/M2/M3 & DPDP Act 2023 compliance. |
| **[`03_IMPACT_AND_BENEFITS.md`](file:///d:/medikiosk/SIH_DOCS/03_IMPACT_AND_BENEFITS.md)** | **Impact & Benefits:** 72% intake duration reduction (18m down to 5m), 100% emergency red-flag sensitivity, 68% clinician burnout relief, and economic ROI models. |
| **[`04_SYSTEM_ARCHITECTURE.md`](file:///d:/medikiosk/SIH_DOCS/04_SYSTEM_ARCHITECTURE.md)** | **System Architecture:** 5 Mermaid architectural diagrams (component topology, clinical sequence, DB schema, triage state machine, network tunnel). |
