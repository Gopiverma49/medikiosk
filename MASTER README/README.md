# 🏥 MediKiosk — Simple Master Guide

Welcome to **MediKiosk**! This guide explains the entire project in simple, everyday words so anyone can understand how it works, how the folders connect, and what each file does.

---

## 💡 What is MediKiosk?

When patients visit a busy hospital outpatient department (OPD), they usually have to stand in long lines, fill out paper forms, and wait without knowing when their turn is. 

**MediKiosk fixes this by creating a smart, automated hospital experience:**
1. **Patient Kiosk (Tablet or Phone):** The patient walks up to a screen, chooses their language (English, Hindi, etc.), scans their hospital card or types their phone number, answers simple questions about their symptoms (by touch or voice), and scans any previous prescriptions or lab reports.
2. **Instant Token:** The kiosk prints or displays a queue token number (like `OPD-001`).
3. **Waiting Room TV Board:** A big TV screen in the waiting area shows the active tokens, plays a pleasant bell chime when a number is called, and tells the patient which doctor room to go to.
4. **Doctor Station:** The doctor sits at their computer, sees the patient's summarized health story, verifies the symptoms, and writes a digital prescription.

---

## 🗂️ What is Inside Each Folder?

Here is a quick look at every main folder in this project and what it does:

| Folder | What It Does (In Simple Words) | Detailed Guide |
| :--- | :--- | :--- |
| **`frontend/`** | Everything you see on screen — the buttons, touch screens, colors, voice prompts, and waiting room TV display. | [Read Frontend Guide](README_frontend.md) |
| **`backend/`** | The "brain" of the hospital — stores patient records, generates token numbers, checks safety alerts, and connects doctors with patients. | [Read Backend Guide](README_backend.md) |
| **`docs/`** | Explanations, drawings, database tables, and instruction manuals explaining how the project was designed. | [Read Docs Guide](README_docs.md) |
| **`evaluation/`** | Automatic test quizzes that check if the AI understands medical symptoms and medications correctly. | [Read Evaluation Guide](README_evaluation.md) |
| **`sample_data/`** | Practice files (sample patients, fake prescription photos, and test lab reports) so you can test without real patient data. | [Read Sample Data Guide](README_sample_data.md) |
| **`scripts/`** | Helper tools — like the one-click launcher and the mobile QR code generator that lets you open the kiosk on your phone. | [Read Scripts Guide](README_scripts.md) |

---

## 🔄 How Information Travels Through the System

Here is what happens from the moment a patient walks in to when the doctor sees them:

```
[1. Patient at Kiosk] 
      │ (Picks language, enters phone/UHID, talks or taps symptoms, scans old reports)
      ▼
[2. Backend Server]
      │ • Saves the patient's visit
      │ • Reads text from uploaded prescription photos (OCR)
      │ • Checks for danger signs (like severe chest pain)
      │ • Gives the patient a token number (e.g. OPD-001)
      ▼
[3. Waiting Room TV Display]
      │ • Instantly updates live via WebSockets
      │ • Plays a gentle chime sound
      │ • Shows: "Token OPD-001 -> Please go to Room A"
      ▼
[4. Doctor's Computer]
      │ • Doctor clicks "Call Next Patient"
      │ • Reads an easy summary of the patient's problem
      │ • Confirms the symptoms with one click
      │ • Types advice and issues the prescription
```

---

## 🚀 How to Run the App (Quick & Easy)

### On Windows:
Just double-click this file in the project folder:
```text
start_medikiosk.bat
```
This automatically starts both the backend and frontend, and opens the website in your browser!

### Or using the command line:
1. Open your terminal in this folder and run:
   ```bash
   npm run dev:all
   ```
2. Open your web browser and visit:
   - **Main Launchpad:** `http://localhost:3000`
   - **Patient Check-in Kiosk:** `http://localhost:3000/patient`
   - **Waiting Room TV Board:** `http://localhost:3000/tokens`
   - **Doctor Station:** `http://localhost:3000/doctor`
   - **Hospital Admin Desk:** `http://localhost:3000/admin`

---

## 📖 Deep-Dive Guides

Click any of the links below to read the simple, plain-English breakdown for that specific part:

- [**Backend Guide (`README_backend.md`)**](README_backend.md) — How the server, database, and safety rules work.
- [**Frontend Guide (`README_frontend.md`)**](README_frontend.md) — How the screens, buttons, audio chimes, and languages work.
- [**Docs Guide (`README_docs.md`)**](README_docs.md) — All about the project specifications and database tables.
- [**Evaluation Guide (`README_evaluation.md`)**](README_evaluation.md) — How we test the accuracy of the medical AI.
- [**Sample Data Guide (`README_sample_data.md`)**](README_sample_data.md) — Practice images and test patients.
- [**Scripts Guide (`README_scripts.md`)**](README_scripts.md) — One-click launchers and mobile QR code tools.
