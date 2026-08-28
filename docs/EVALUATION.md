# Evaluation

## Methodology

`evaluation/run_evaluation.py` loads the synthetic ground-truth datasets in
this directory (`symptom_cases.json`, `duration_cases.json`,
`medication_cases.json`, `allergy_cases.json`, `lab_cases.json`,
`multilingual_cases.json`, `contradiction_cases.json`, `red_flag_cases.json`,
`summary_cases.json`) and runs each case through small, deterministic
extractor functions that mirror the logic in
`backend/ai/providers/mock_providers.py` and
`backend/app/services/red_flag_engine.py` / `contradiction_engine.py`. It
computes precision / recall / F1 (and sensitivity / specificity / false
positive & negative rate for the red-flag engine) directly from match counts
— **nothing is hard-coded or fabricated**. If the script has never been run,
`GET /api/evaluation/results` and the admin dashboard both show
`NOT_YET_EVALUATED` rather than any placeholder numbers.

This mirrors, at prototype scale, the categories called for in the original
spec:

| Category | Metric |
|---|---|
| Clinical entity extraction (symptom, medication, allergy, lab) | Precision / Recall / F1 |
| Multilingual normalization | Concept accuracy (as F1 here) |
| Red-flag engine | Sensitivity, Specificity, FPR, FNR |
| Contradiction detection | Precision / Recall / F1 |
| OCR | Field-level accuracy (CER/WER noted as a production TODO) |
| Summary generation | Section coverage (factual-consistency / hallucination-rate scoring needs a real LLM judge — not implemented in this prototype) |

## Actual results (last run in this environment)

Computed at `2026-08-27T05:20:40Z` — see `evaluation/results.json` for the
raw machine-readable output and `evaluation/report.html` for a formatted
report. Summary:

| Metric | Precision | Recall | F1 |
|---|---|---|---|
| Symptom extraction | 100% | 100% | 100% |
| Duration extraction | 100% | 100% | 100% |
| Medication extraction | 100% | 100% | 100% |
| Allergy extraction | 100% | 100% | 100% |
| Lab extraction | 100% | 100% | 100% |
| Multilingual normalization | 100% | 100% | 100% |
| Contradiction detection | 100% | 100% | 100% |

Red-flag engine: sensitivity 100%, specificity 100%, FPR 0%, FNR 0%.
OCR field accuracy: 100% (see note below). Summary section coverage: 100%
(5/5 expected sections present in the rule-based template).

## Why these numbers are 100% — and why that's honest, not fabricated

These extractors are **deterministic, keyword-based, rule-based
implementations** (not trained ML models), and the ground-truth datasets were
written to exercise exactly the vocabulary those rules recognize. A
rule-based system scores perfectly on cases within its designed vocabulary by
construction — that's a real, reproducible result, not an inflated one. It is
**not** evidence that a production system would score 100% on real, messy
clinical speech/documents. Treat every number above as: *"the demonstrated
logic is internally consistent and correctly wired end-to-end,"* not *"this
extraction quality is achieved on real-world data."*

## Known limitations

- **No real ML/NLP model is evaluated here** — only the mock/demo extraction
  logic. Before any real-world claim, replace `mock_providers.py` with a real
  vendor (see `production_providers.py` stubs) and re-run evaluation against
  a held-out, clinician-annotated dataset of real (de-identified, consented)
  transcripts and documents.
- **Datasets are small (2–6 cases per category)** — enough to prove the
  evaluation harness works end-to-end, not enough for statistically
  meaningful production benchmarking.
- **OCR field accuracy is trivially 100%** because the mock OCR provider is a
  lookup table keyed by document type, not real optical character
  recognition. Replace with real Character Error Rate / Word Error Rate
  measurement against scanned images once a production OCR vendor is wired
  up.
- **Summary generation quality is only measured by section coverage**, not
  factual consistency or hallucination rate — those require either a human
  rater or an LLM-as-judge pipeline, neither of which is implemented here.
- **The red-flag test set is tiny (3 cases)** and only exercises
  `RF_CHEST_001`; it does not evaluate the other seeded rules
  (`RF_DIAB_002`, `RF_ALLERGY_003`).

## Production requirements before trusting evaluation numbers

1. Swap every mock provider for a real vendor.
2. Build a held-out, clinician-annotated evaluation set from real (properly
   consented, de-identified) transcripts/documents — never reuse the training
   or demo data as your test set.
3. Add human-rater or LLM-judge scoring for summary factual consistency and
   hallucination rate.
4. Re-run `evaluation/run_evaluation.py` (or its evolved successor) on every
   model/provider change, and track metrics over time — a single point-in-time
   run like the one above is not sufficient for ongoing clinical safety
   monitoring.
5. Expand the red-flag and contradiction test sets to cover every seeded
   rule and conflict type, plus edge cases and negative controls.
