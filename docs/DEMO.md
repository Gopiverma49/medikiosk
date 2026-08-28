# Guided Demo

This walks through the acceptance-criteria journey end to end using the real
stack. All data is synthetic.

## 0. Start everything

```bash
docker compose up --build
```

Wait for the backend log line `Application startup complete` and the
frontend log line `Ready`. Then:
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

Demo credentials (see `docs/SECURITY.md` for details) — the frontend demo
flow doesn't require logging in (it acts as the patient/doctor directly for
simplicity), but the API supports full RBAC login if you want to test it via
`/docs`:

| Username | Password | Role |
|---|---|---|
| patient | patient123 | PATIENT |
| doctor | doctor123 | DOCTOR |
| triage | triage123 | TRIAGE |
| admin | admin123 | ADMIN |

## 1. Patient kiosk (http://localhost:3000/kiosk)

1. **Start as: Ravi Kumar** — creates a synthetic patient + encounter.
2. **Select Kannada.**
3. **Consent** — recorded, audit-logged.
4. **Chief complaint** — click "Speak (voice simulation)". This calls the
   mock ASR provider, transcribes a canned Kannada sentence, and normalizes
   it to the language-neutral concept `chest_pain`.
5. **Adaptive questions** — onset, location, character, severity, radiation,
   breathlessness, sweating, medications, allergies. Try clicking **"I don't
   know"** on any question and then check the doctor dashboard's Facts tab —
   the fact shows `UNKNOWN`, never `No`.
6. **Upload documents** — click all three (Prescription, Lab Report,
   Discharge Summary). Each runs mock OCR + extraction and immediately
   re-runs contradiction detection.
   - Because you answered "No" to "are you taking any medicines?" earlier,
     and the prescription document contains Metformin, this **intentionally
     creates a MEDICATION_CONFLICT** — visible on the doctor dashboard.
7. Click **Continue** — generates the AI draft summary and finishes the
   kiosk flow.

## 2. Doctor dashboard (http://localhost:3000/doctor/dashboard)

- **Overview** — shows the triggered red flag (if chest_pain + ≥1 of
  dyspnea/radiation/sweating were answered "Yes") and any unverified facts.
- **Facts & Provenance** — click any fact to open its detail panel: source,
  original text, extraction confidence, verification status. Try **Verify**,
  **Edit / Correct**, and **Reject**.
- **Conflicts** — resolve the medication contradiction created in step 6.
  Note the system never auto-picks a side; you choose.
- **Documents** — OCR text + extracted facts per uploaded document.
- **Clinical Summary** — an AI-generated draft, explicitly labeled. Edit it,
  then **Confirm** — status changes to `PHYSICIAN_VERIFIED`.
- **FHIR / ABDM Export** — click **Export to Mock FHIR Bundle** to see the
  mapped resource bundle. Note the `MOCK/SANDBOX` / `MOCK CONNECTED` badges —
  this prototype never claims production ABDM connectivity.

## 3. Admin (http://localhost:3000/admin)

- **Red-Flag Rules** — view the versioned, JSON-configured rules. Disable
  `RF_CHEST_001` and re-run the kiosk flow with the same answers — no red
  flag fires. This proves rules aren't hard-coded into the UI.
- **Test Rule** — flip inputs and click RUN TEST; it calls the exact same
  `eval_rule()` function used in production.
- **Evaluation** — click **Run Evaluation**. This runs
  `evaluation/run_evaluation.py` and displays real computed precision /
  recall / F1 (never fabricated numbers) plus red-flag sensitivity /
  specificity / false-negative rate.
- **Audit Log** — every action taken above is here, timestamped.

## Simulating AI failures

The admin API (and, if you extend the frontend, an admin toggle) can force
any provider down:

```bash
curl -X POST http://localhost:8000/api/admin/ai-status/ocr/toggle
curl -X POST http://localhost:8000/api/admin/ai-status/asr/toggle
curl -X POST http://localhost:8000/api/admin/ai-status/llm/toggle
```

With OCR down, uploading a document in the kiosk returns
`{"ok": false, "fallback": ["retake_photo", "enter_manually", "continue_without_document"]}`
instead of crashing. With ASR down, the chief-complaint step returns
`{"ok": false, "fallback": "type_or_select"}` and the kiosk falls back to
typed input. With LLM down, `POST /api/summaries/generate` still returns a
complete summary via the rule-based template — the application never
crashes because a provider is unavailable. Toggle again to restore.

## Running the automated tests

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Covers: patient/encounter/consent creation, history branching, unknown
answers staying unknown, red-flag rule firing/non-firing/configuration,
contradiction detection + resolution, human verification states (verify /
correct / reject), AI-extracted facts never auto-verified, summary
confirmation flow, AI provider failure fallbacks (ASR/OCR/LLM), FHIR resource
mapping, and RBAC login.

## Standalone evaluation run

```bash
cd evaluation
python3 run_evaluation.py
cat results.json
open report.html   # or just open the file in a browser
```
