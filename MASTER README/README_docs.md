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
- Shows you the two easiest ways to open the patient kiosk on your phone:
  - **Option 1 (Local Wi-Fi):** Connect your laptop and phone to the same Wi-Fi, and open `http://<your-laptop-ip>:3000`. Fast, private, and works with no internet!
  - **Option 2 (Public Web Link):** Run `npm run dev:all`, scan the QR code in your terminal, and open it on your phone over 4G/5G mobile internet.

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
