# Architecture

## Core workflow

```
PATIENT
  → LANGUAGE
  → CONSENT
  → VOICE/TOUCH HISTORY
  → LANGUAGE-NEUTRAL CLINICAL SCHEMA
  → DOCUMENT PROCESSING
  → INFORMATION EXTRACTION
  → CONFIDENCE + PROVENANCE
  → UNCERTAINTY HANDLING
  → CONTRADICTION DETECTION
  → CONFIGURABLE RED-FLAG RULE ENGINE
  → HUMAN REVIEW
  → CLINICAL SUMMARY
  → PHYSICIAN VERIFICATION
  → MOCK FHIR/ABDM/HIS INTEGRATION
```

## Clinical information model

See `backend/app/models.py` for the full SQLAlchemy schema. Key entities:
`Patient`, `Encounter`, `ClinicalFact`, `Medication`, `Allergy`, `Document`,
`DocumentExtraction`, `LabResult`, `ClinicalSummary`, `RedFlagRule` /
`RedFlagRuleVersion` / `RedFlagEvent`, `TriageEvent`, `Contradiction` /
`ContradictionResolution`, `AIProvenance`, `AIEvaluation`,
`HumanVerification`, `AuditLog`.

Every clinically meaningful row carries, where applicable: `source`,
`confidence`, `verification_status`, `created_at` / `updated_at`, and UUID
primary keys throughout.

### The `ClinicalFact` row — the central unit of the system

```json
{
  "concept": "chest_pain",
  "value": true,
  "certainty": "confirmed",
  "source": "PATIENT_SPOKEN",
  "source_language": "kn",
  "confidence": 0.94,
  "verification_status": "UNVERIFIED",
  "verified_by": null
}
```

## Multilingual → language-neutral architecture

```
PATIENT LANGUAGE → ASR → NORMALIZED TEXT → CLINICAL ENTITY EXTRACTION
                                          → LANGUAGE-NEUTRAL CLINICAL SCHEMA
```

Implemented in `backend/app/services/clinical_schema.py`. The rest of the
application — the red-flag engine, contradiction detection, summary
generation, analytics — depends **only** on the `concept` key (e.g.
`chest_pain`), never on which language the patient used. `original_text` and
`source_language` are stored on the fact strictly for provenance display;
downstream business logic never reads them.

Supported languages in this prototype: English, Hindi, Kannada.

## AI confidence architecture

Every AI-extracted or AI-generated clinical fact carries an `confidence`
value (0–1), bucketed for UI display as:

| Band   | Range     |
|--------|-----------|
| HIGH   | ≥ 0.90    |
| MEDIUM | 0.70–0.89 |
| LOW    | < 0.70    |

The UI always labels this **"extraction confidence"**, never "diagnostic
confidence" — the two are explicitly different concepts, and the interface
(`frontend/components/ClinicalComponents.tsx` `ConfidenceBadge`) never
conflates them. Facts below 0.90 confidence trigger an explicit
"needs confirmation" gate before being treated as confirmed (see
`kioskLowConfidenceCheck` equivalent flow in `frontend/app/kiosk/page.tsx`
and the standalone demo).

## Provenance architecture

Every fact records where it came from via the `source` enum:
`PATIENT_SPOKEN`, `PATIENT_TOUCH`, `UPLOADED_DOCUMENT`, `OCR`, `AI_INFERENCE`,
`PHYSICIAN_ENTERED`, `PHYSICIAN_VERIFIED` — plus, where relevant,
`source_language`, `original_text`, and `source_document_id`. The doctor
dashboard's fact-detail panel (`FactCard` → modal) surfaces all of this so a
physician can always answer "where did this information come from?".

## Human-in-the-loop / verification architecture

```
PATIENT
  → AI DATA COLLECTION
  → STRUCTURED CLINICAL FACTS
  → CONFIDENCE + PROVENANCE
  → VALIDATION
  → CONTRADICTION DETECTION
  → RED-FLAG RULE ENGINE
  → AI-GENERATED SUMMARY
  → ╔══════════════════════════════╗
    ║  HUMAN / PHYSICIAN REVIEW    ║
    ║  Edit · Verify · Reject      ║
    ║  Add information             ║
    ╚══════════════════════════════╝
  → CONFIRMED CLINICAL RECORD
  → FHIR / HIS / ABDM
```

`verification_status` state machine (see `models.VerificationStatus`):

```
UNVERIFIED / UNKNOWN
      │
      ├─ patient confirms ──────────► PATIENT_CONFIRMED
      ├─ physician verifies ────────► PHYSICIAN_VERIFIED
      ├─ physician edits value ─────► PHYSICIAN_CORRECTED  (original snapshot kept)
      └─ physician rejects ─────────► REJECTED
```

Nothing ever transitions to `PHYSICIAN_VERIFIED` automatically — every such
transition in the codebase originates from an explicit API call made by a
doctor-facing UI action (`clinical_facts.py::verify_fact`,
`summaries.py::confirm`, `contradictions.py::resolve`).

## Contradiction detection architecture

Implemented in `backend/app/services/contradiction_engine.py`. Compares
clinical facts from different sources within the same encounter. Currently
implemented patterns (of the 7 types defined in
`contradiction_engine.CONTRADICTION_TYPES`):

- **MEDICATION_CONFLICT** — patient reports no current medication, but an
  uploaded document lists one.
- **ALLERGY_CONFLICT** — patient reports no known drug allergy, but an
  uploaded document lists one.
- **TEMPORAL_CONFLICT** — `symptom_onset` reported more than once with
  different values.

The engine **never** auto-resolves a conflict or picks a "correct" source —
it only ever creates a `Contradiction` row with `status=UNRESOLVED`.
Resolution is exclusively a physician action via
`POST /api/contradictions/{id}/resolve`, which requires an explicit decision
string and records a `ContradictionResolution` row for audit.

## Configurable red-flag rule engine

Implemented in `backend/app/services/red_flag_engine.py`. Rules are pure
data (`RedFlagRule.conditions`), never hard-coded into application/UI code:

```json
{
  "all": [{"concept": "chest_pain", "operator": "equals", "value": true}],
  "any": [
    {"concept": "dyspnea", "operator": "equals", "value": true},
    {"concept": "radiation_to_arm", "operator": "equals", "value": true},
    {"concept": "sweating", "operator": "equals", "value": true}
  ]
}
```

A rule fires when **all** of `conditions.all` are true AND (if present) at
least one of `conditions.any` is true. Operators supported: `equals`, `gte`,
`lte`, `gt`, `lt`. Rules are versioned (`RedFlagRuleVersion`) on every edit
and can be enabled/disabled/tested from the admin UI without a code deploy.
The rule-test endpoint (`POST /api/red-flags/rules/{id}/test`) calls the
exact same `eval_rule()` function used in production, so admin testing
reflects real behavior.

**The prototype's rules are demonstrations only** and must be clinically
reviewed and validated before real deployment.

## AI provider abstraction

`backend/ai/providers/base.py` defines abstract interfaces:
`SpeechToTextProvider`, `TextToSpeechProvider`, `OCRProvider`,
`ClinicalNLPProvider`, `SummaryProvider`, `TranslationProvider`. Application
code never imports a vendor SDK directly — it calls
`backend/ai/providers/factory.py::get_*_provider()`, which returns a
`FallbackProvider`-wrapped instance. `FallbackProvider.call()` never lets a
provider exception reach the caller; on failure it returns a safe
`ProviderResult(ok=False, ...)` that the router turns into a UI fallback
(retry / type instead / select from options / manual entry / continue
without document — see `docs/DEMO.md` "Simulating AI failures").

Two implementations exist per interface:
- `mock_providers.py` — deterministic, zero-API-key, used by default
  (`*_PROVIDER=mock` in `.env`). This is what makes `docker compose up`
  work with no vendor credentials at all.
- `production_providers.py` — clean stubs reading `*_API_KEY` from the
  environment, intentionally left as `NotImplementedError` until a real
  vendor SDK call is added.

## FHIR / ABDM / HIS mock integration

`backend/integrations/fhir_abdm_his.py` defines `FHIRProvider`,
`ABDMProvider`, `HISProvider` interfaces with `Mock*` implementations.
`MockFHIRProvider.build_bundle()` maps internal records to FHIR R4-shaped
resources (`Patient`, `Encounter`, `Condition`, `MedicationStatement`,
`AllergyIntolerance`, `Observation`, `DocumentReference`) — structurally
FHIR-shaped, but **not validated against a real FHIR server**, and ABDM/HIS
are sandbox/mock only. `GET /api/fhir/status` always reports
`{"fhir": "READY", "abdm": "MOCK/SANDBOX", "his": "MOCK CONNECTED"}` — the
codebase never claims production ABDM connectivity.

## AYUSH pathway

`backend/app/routers/ayush.py` implements the Dashavidha Pariksha
(ten-fold examination) field set: Prakriti, Vikriti, Sara, Samhanana,
Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya, plus Ahara,
Vihara, Nidana, Agni, Koshtha, Samprapti. Responses are stored exactly like
any other `ClinicalFact` (confidence, provenance, uncertainty,
verification_status) and are surfaced to the practitioner for
interpretation — the AI never generates an Ayurvedic diagnosis or treatment
recommendation from them.

## Auditability

`backend/app/services/audit.py::log_event()` is called from every service
that performs a clinically meaningful action (patient created, consent
recorded, answer received, document uploaded, OCR run, red flag triggered,
contradiction detected/resolved, fact verified/corrected/rejected, summary
generated/confirmed/rejected, FHIR export performed). Entries are timestamped
`AuditLog` rows exposed via `GET /api/admin/audit-log`. Raw sensitive
payloads are deliberately not stored in log details — only short event/detail
strings.

## Why this differs from `AI DECIDES → SYSTEM ACCEPTS`

Concretely, in code:
- `ClinicalFact.verification_status` defaults to `UNVERIFIED` (or `UNKNOWN`)
  for every AI/patient-sourced fact — see `models.py`.
- `summary_service.generate_summary()` always sets `status="AI_DRAFT"`;
  only `routers/summaries.py::confirm()` (an explicit physician action) can
  set `PHYSICIAN_VERIFIED`.
- `contradiction_engine.detect_contradictions()` only ever writes
  `status="UNRESOLVED"` rows; only `resolve_contradiction()` (again, an
  explicit physician decision) can close one.
- Unknown answers are stored with `value=None, certainty="unknown"` and are
  never coerced to a negative/"No" answer anywhere in the codebase — see
  `backend/tests/test_unknown_answers.py`.
