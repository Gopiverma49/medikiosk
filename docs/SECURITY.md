# Security

## Scope

This is a **prototype using synthetic data only**. It is not certified for
real patient data. Before any real deployment, see "Known limitations &
production requirements" in the root README.

## Authentication

JWT bearer tokens (`backend/app/security.py`), issued by `POST
/api/auth/login`, expiring after `JWT_EXPIRE_MINUTES` (default 480). Passwords
are hashed with bcrypt via `passlib`. `JWT_SECRET` **must** be changed before
any deployment outside a local demo — the default in `.env.example` is
intentionally an obvious placeholder.

## RBAC

Four roles (`models.Role`): `PATIENT`, `DOCTOR`, `TRIAGE`, `ADMIN`. Protect a
route with `Depends(require_role('DOCTOR', 'ADMIN'))` (see
`backend/app/security.py::require_role`). The demo routers in this prototype
do not all enforce role checks by default (to keep the guided demo
frictionless) — before production use, add `require_role(...)` dependencies
to every state-changing endpoint (`clinical_facts.py` verify/correct/reject,
`contradictions.py` resolve, `summaries.py` confirm/reject, `red_flags.py`
create/update/disable, `fhir.py` export) restricted to `DOCTOR`/`ADMIN` as
appropriate.

## Demo credentials

Seeded by `backend/app/seed.py` (`python -m app.seed`, or automatically on
`docker compose up` via the backend `CMD`):

| Username | Password | Role |
|---|---|---|
| patient | patient123 | PATIENT |
| doctor | doctor123 | DOCTOR |
| triage | triage123 | TRIAGE |
| admin | admin123 | ADMIN |

These are synthetic, prototype-only credentials. Never reuse them, and never
seed them in an environment reachable from the public internet.

## Data handling

- All patient/document data in this repository (`sample_data/`,
  `docs/DEMO.md`, evaluation datasets) is synthetic.
- `backend/app/services/audit.py::log_event()` deliberately stores only short
  event/detail strings, not raw sensitive payloads.
- Document uploads in this prototype are simulated (`doc_type` selects a
  canned sample; see `backend/ai/providers/mock_providers.py`) — there is no
  real file-upload handling wired up yet. Before accepting real file uploads,
  add: file-type allow-listing, size limits, antivirus/malware scanning, and
  storage outside the application container (e.g. object storage with
  signed URLs).
- CORS is restricted via `CORS_ORIGINS` (see `.env.example`); tighten this to
  your real frontend origin(s) in production.

## Secrets

- Never commit real secrets. `.env` is committed here with placeholder/demo
  values only, matching `.env.example`, because everything in it is
  intentionally non-sensitive for a local demo. Replace both files' contents
  (and stop committing `.env`) before any real deployment.
- API keys for real AI vendors (`ASR_API_KEY`, `OCR_API_KEY`, etc.) are read
  from environment variables only (`backend/app/config.py`) — never
  hard-coded, never sent to the frontend.

## Input validation

Pydantic schemas (`backend/app/schemas.py`) validate all request bodies.
Query-parameter-driven endpoints (several document/history endpoints use
query params for simplicity in this prototype) should be migrated to
validated request bodies before production use.
