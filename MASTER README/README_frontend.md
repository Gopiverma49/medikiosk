# 🖥️ Frontend Guide — Everything You See & Hear on Screen

> **Folder:** `frontend/`  
> **What it does:** This is the visual part of MediKiosk. It includes the patient touch screen, the voice prompts, the waiting room TV token board, and the doctor's workstation.

---

## 📁 What is Inside the `frontend/` Folder?

```
frontend/
├── app/                  # The web pages (Patient Kiosk, Doctor Desk, TV Board, Admin)
├── components/           # Reusable building blocks (buttons, keypads, camera scanners, headers)
│   └── symptoms/         # Special clinical tools (body map, 0-10 pain scale, danger alerts)
├── lib/                  # Helper code (sound generator, language switcher, backend API connector)
└── translations/         # Simple text files for English, Hindi, and 5 other regional languages
```

---

## 📱 The 5 Main Web Pages (`frontend/app/`)

| Page | URL | What It Looks Like & Does |
| :--- | :--- | :--- |
| **Portal Launchpad** | [`/`](file:///d:/medikiosk/frontend/app/page.tsx) | The home page with big cards letting you choose where to go: Patient Kiosk, Doctor Station, TV Board, Nurse Station, or Admin. |
| **Patient Kiosk** | [`/patient`](file:///d:/medikiosk/frontend/app/patient/page.tsx) | **The Patient Self-Check-in Station:**<br>• Step 1: Choose language (English, Hindi, etc.) and mode (Touch or Voice).<br>• Step 2: Scan hospital barcode card or type 10-digit phone number on big buttons.<br>• Step 3: Choose if it's a new problem or follow-up for a past illness.<br>• Step 4: Answer simple symptom questions and scan old paper prescriptions.<br>• Step 5: Get an instant token number (like `OPD-001`).<br>*(Includes a **30-second safety timer** — if a patient walks away, it automatically resets to Step 1 in the chosen language!)* |
| **Live TV Board** | [`/tokens`](file:///d:/medikiosk/frontend/app/tokens/page.tsx) | **The Waiting Room TV Screen:**<br>Shows which token is currently called into which room (e.g. `OPD-001 -> Room A`). Whenever a doctor calls someone, the card flashes bright colors and plays a clean hospital bell chime sound. |
| **Doctor Desk** | [`/doctor`](file:///d:/medikiosk/frontend/app/doctor/page.tsx) | **The Doctor's Workspace:**<br>The doctor clicks "Call Patient", sees an instant summary of what the patient said, confirms the symptoms, types their advice, and prints a digital prescription. |
| **Admin Desk** | [`/admin`](file:///d:/medikiosk/frontend/app/admin/page.tsx) | **Hospital Management:**<br>Hospital managers can add new doctor consultation rooms, create doctor/nurse accounts, reset queues, and view activity history. |

---

## 🧩 Reusable Screen Parts (`frontend/components/`)

Instead of building things from scratch every time, we built smart, reusable pieces:

- **[`KioskKeypad.tsx`](file:///d:/medikiosk/frontend/components/KioskKeypad.tsx):** A high-contrast numeric keypad with large buttons, designed so elderly patients or people with shaky hands can easily tap their phone numbers.
- **[`KioskScanner.tsx`](file:///d:/medikiosk/frontend/components/KioskScanner.tsx):** Turns on the phone or kiosk camera to scan barcodes and QR codes printed on hospital cards.
- **[`MedicalReportScanner.tsx`](file:///d:/medikiosk/frontend/components/MedicalReportScanner.tsx):** Lets patients hold up past paper prescriptions or lab reports to the camera, reading the medicines and lab tests instantly.
- **[`PasswordInput.tsx`](file:///d:/medikiosk/frontend/components/PasswordInput.tsx):** A password box with a little eye icon so hospital staff can click to see what they are typing without making mistakes.
- **[`Header.tsx`](file:///d:/medikiosk/frontend/components/Header.tsx):** The top bar on every page. Has big English and Hindi buttons so you can change languages at any second.

---

## 🩺 Interactive Symptom Tools (`frontend/components/symptoms/`)

To help patients explain how they feel without complex medical words:

- **[`BodyLocationSelector.tsx`](file:///d:/medikiosk/frontend/components/symptoms/BodyLocationSelector.tsx):** An easy human body map where the patient can simply tap where it hurts (Head, Chest, Stomach, Arms, Legs).
- **[`PainScale.tsx`](file:///d:/medikiosk/frontend/components/symptoms/PainScale.tsx):** A visual Wong-Baker FACES pain scale (from 0 = "No Hurt / Smiling" to 10 = "Hurts Worst / Crying").
- **[`AdaptiveSymptomEngine.tsx`](file:///d:/medikiosk/frontend/components/symptoms/AdaptiveSymptomEngine.tsx):** Asks smart follow-up questions depending on what was selected (e.g. if you pick "Fever", it asks "How many days?").
- **[`SafetyAlert.tsx`](file:///d:/medikiosk/frontend/components/symptoms/SafetyAlert.tsx):** If a patient reports dangerous signs (like chest pain spreading to the left arm), a bright red alert pops up instructing them to go straight to emergency care.

---

## 🔊 Sound & Voice Helpers (`frontend/lib/voice.ts`)

- **Dual-Tone Hospital Chime:** When a patient is called, we don't play an MP3 file that might buffer or fail. Instead, the browser's audio synthesizer creates a pleasant two-tone hospital ding-dong sound (`E5` to `C5`) in less than 5 milliseconds!
- **Voice Guidance (Talking Kiosk):** If the patient chooses "Voice Mode", the kiosk speaks questions out loud in their selected language and listens to their spoken answer.

---

## 🌐 Languages (`frontend/translations/`)

MediKiosk comes with translations built right into the project:
- `en.json` (English)
- `hi.json` (Hindi - हिन्दी)
- `mr.json` (Marathi - मराठी)
- `ne.json` (Nepali - नेपाली)
- `kn.json` (Kannada - ಕನ್ನಡ)
- `or.json` (Odia - ଓଡ଼ିଆ)
- `ta.json` (Tamil - தமிழ்)

Whenever you tap English or Hindi at the top, the entire page translates instantly!
