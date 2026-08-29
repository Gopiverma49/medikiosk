# 🏥 MediKiosk — Smart Multilingual Hospital Intake Platform

> **Simple, fast, and accessible digital patient check-in for busy outpatient hospital clinics.**  
> Supports **English** and **हिंदी (Hindi)** with large touch controls, voice guidance, and smart symptom collection.

---

## 🌟 The Core Principle

```mermaid
flowchart LR
    A["🤖 AI Collects & Assists"] --> B["⚙️ System Validates & Screens"]
    B --> C["👨‍⚕️ Doctor Reviews & Verifies"]
    C --> D["📋 Official Medical Record"]
    
    style A fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1
    style B fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e
    style C fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#15803d
    style D fill:#f1f5f9,stroke:#475569,stroke-width:2px,color:#334155
```

> [!IMPORTANT]
> **Safety First:** MediKiosk assists patients and doctors by collecting information in advance. It **never** prescribes medicines or replaces the doctor. Every summary and extraction must be confirmed by a licensed physician.

---

## 🚀 How to Start the App (1-Click Setup)

### Option 1: Double-Click the Launcher (Windows)
Simply double-click:
```cmd
start_medikiosk.bat
```
*This opens your browser and starts everything with live auto-refresh enabled.*

### Option 2: Run in Terminal (Mac / Linux / Windows)
```bash
npm install
npm run dev
```

---

## 🌐 Quick Access Links

| Portal | URL | Description |
| :--- | :--- | :--- |
| **🏠 Portal Launchpad** | [http://localhost:3000](http://localhost:3000) | Choose between Patient, Doctor, and Admin views |
| **🏥 Patient Kiosk** | [http://localhost:3000/patient](http://localhost:3000/patient) | Touch & voice self check-in station for patients |
| **👨‍⚕️ Doctor Station** | [http://localhost:3000/doctor](http://localhost:3000/doctor) | Doctor consultation queue, AI summary & verification |
| **⚙️ Admin Station** | [http://localhost:3000/admin](http://localhost:3000/admin) | Hospital triage rules & accuracy benchmarks |
| **📖 API Documentation** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive backend API testing interface |

---

## 🗺️ Step-by-Step Patient Check-In Journey

```mermaid
flowchart TD
    Step1["Step 1: Choose Language & Mode\n(English / Hindi • Touch or Voice)"] --> Step2["Step 2: Enter Patient ID\n(Scan Card OR Type 10-Digit ID)"]
    
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
    
    SafetyCheck -- "Yes" --> Alert["⚠️ Show Urgent Medical Alert\n(Notify Triage Nurse)"] --> Done
    SafetyCheck -- "No" --> Done["Step 6: All Done!\n(Auto-sent to Doctor Dashboard)"]
    
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

## 🎯 Key Features Explained Simply

### 1. 🗣️ Continuous Spoken Voice Guidance
- When the patient chooses **VOICE**, the kiosk gently speaks instructions in their language (English or Hindi) at **every step**.
- If voice recognition is noisy, the patient can simply tap the screen at any time.

### 2. ⚡ Adaptive Symptom Collection (No Long Forms)
- Instead of showing a giant medical form, the kiosk asks:  
  **"Select the problem that best describes why you are visiting today."**
- The system automatically asks follow-up questions based on the complaint:
  - **Fever:** How many days? Any chills, body pain, or cough?
  - **Pain:** Interactive body area picker (Head, Chest, Abdomen, Arm, Leg), 0–10 pain scale, duration.
  - **Eye Problem:** Left, right, or both eyes? Redness, watering, or blurred vision?
  - **Injury:** What happened (fall, cut, burn, accident)? Any active bleeding?
  - **Animal Bite:** Dog, cat, monkey? Did it break the skin? (Alerts staff immediately if Rabies shots are needed).
  - **Other Problem:** Speak or type freely in your own words.

### 3. ❓ Always Allows "I Don't Know"
- Patients are never forced to guess. Every question has an **"I don't know"** button. The system saves it honestly as unknown rather than making up answers.

### 4. 🚨 Automatic Safety Screening
- If dangerous symptoms are reported (e.g. chest pain spreading to the arm, dog bite with bleeding, severe breathing difficulty), the kiosk shows an **Urgent Medical Advisory** prompting the patient to inform hospital staff right away.

### 5. ⏱️ Smart Kiosk Timers
- **7-Second Auto-Reset:** When intake finishes, the screen shows a 7-second countdown and resets automatically for the next person in line.
- **30-Second Inactivity Reset:** If a patient walks away midway, the screen refreshes back to the start page after 30 seconds of inactivity to protect privacy.

---

## 🧪 Demo Test Patient Accounts

Try these pre-made test IDs on the kiosk keypad:

| Patient ID | Patient Name | Past History | What Happens in the Kiosk? |
| :--- | :--- | :--- | :--- |
| **`1000000001`** | **Rahul Kumar** (42M) | **Yes** (Fever & Viral Infection) | Prompts: *"Continue previous illness or start a new problem?"* |
| **`1000000002`** | **Priya Sharma** (30F) | **None** | Confirms identity and moves directly to symptom collection. |
| **`9999999999`** | *(New Patient)* | **None** | ID not found → Opens 1-minute registration form → Saves new record. |

---

## 👨‍⚕️ What the Doctor Sees

When the patient finishes at the kiosk, their record appears instantly on the **Doctor Station**:

```mermaid
flowchart LR
    A["Patient Completes Kiosk"] --> B["Doctor Queue Updates Live"]
    B --> C["Review AI Intake Summary\n(Complaints, Pain Score, History)"]
    C --> D["Check Safety Alerts &\nContradiction Warnings"]
    D --> E["1-Click Verify, Edit,\nor Add Prescription"]
    
    style A fill:#e0f2fe,stroke:#0284c7,stroke-width:2px
    style B fill:#fef3c7,stroke:#d97706,stroke-width:2px
    style C fill:#f0fdfa,stroke:#0d9488,stroke-width:2px
    style D fill:#fee2e2,stroke:#dc2626,stroke-width:2px
    style E fill:#dcfce7,stroke:#16a34a,stroke-width:2px
```

- **Conflict Detection:** Warns the doctor if the patient says they take no medicines, but an uploaded prescription shows active pills.
- **1-Click Review:** The doctor can approve the intake with one click or edit any detail during consultation.

---

## 🛠️ Helpful Commands for Developers

| Action | Command |
| :--- | :--- |
| **Start Everything (Live Dev)** | `npm run dev` |
| **Check Code for Errors** | `npm run typecheck` |
| **Reset Demo Database** | `npm run seed` |
| **Run Automated Tests** | `cd backend && pytest -v` |

---

## 🔒 Privacy & Safety Notice
MediKiosk is designed following Indian healthcare digital standards (ABDM, FHIR R4, and DPDP Act 2023). All test data in this demo is synthetic and safe for demonstration purposes.
