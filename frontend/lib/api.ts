/**
 * Thin REST client for the MediKiosk FastAPI backend. Requests to /api/* are
 * proxied to NEXT_PUBLIC_API_BASE by the rewrite rule in next.config.js, so
 * this file never needs to know the backend's real host in dev vs Docker.
 */
import type { ClinicalFact, Patient, Encounter, Contradiction, RedFlagRule, Summary } from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${detail}`);
  }
  return res.json();
}

export const api = {
  // --- patients / encounters / consent ---
  lookupPatient: (patient_id: string) =>
    request<{ found: boolean; patient: Patient | null; treatment_records_count?: number }>("/patients/lookup", {
      method: "POST",
      body: JSON.stringify({ patient_id }),
    }),
  getPatientTreatments: (patient_id: string) =>
    request<import("./types").TreatmentRecord[]>(`/patients/${patient_id}/treatments`),
  createPatient: (data: Partial<Patient>) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(data) }),
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  listPatients: () => request<Patient[]>("/patients"),
  listPatientEncounters: (patient_id: string) => request<Encounter[]>(`/patients/${patient_id}/encounters`),
  createEncounter: (patient_id: string, mode: string = "general", previous_illness_id?: string) =>
    request<Encounter>("/encounters", {
      method: "POST",
      body: JSON.stringify({ patient_id, mode, previous_illness_id }),
    }),
  recordConsent: (encounter_id: string, granted: boolean) =>
    request("/consents", { method: "POST", body: JSON.stringify({ encounter_id, granted }) }),

  // --- history / adaptive questionnaire ---
  startHistory: (encounter_id: string) =>
    request(`/history/start?encounter_id=${encounter_id}`, { method: "POST" }),
  submitAnswer: (payload: { encounter_id: string; question_concept: string; raw_answer: any; certainty?: string; source_language?: string }) =>
    request<ClinicalFact>("/history/answer", { method: "POST", body: JSON.stringify(payload) }),
  getHistory: (encounter_id: string) => request<ClinicalFact[]>(`/history/${encounter_id}`),

  // --- speech / chief complaint ---
  extractFromSpeech: (encounter_id: string, language: string) =>
    request(`/clinical-facts/extract?encounter_id=${encounter_id}&language=${language}`, { method: "POST" }),

  // --- facts ---
  listFacts: (encounter_id: string) => request<ClinicalFact[]>(`/clinical-facts/${encounter_id}`),
  verifyFact: (fact_id: string, performed_by = "Dr. (demo) Physician") =>
    request<ClinicalFact>("/clinical-facts/verify", { method: "POST", body: JSON.stringify({ fact_id, performed_by }) }),
  correctFact: (fact_id: string, new_value: any, new_label?: string, performed_by = "Dr. (demo) Physician") =>
    request<ClinicalFact>("/clinical-facts/correct", { method: "POST", body: JSON.stringify({ fact_id, new_value, new_label, performed_by }) }),
  rejectFact: (fact_id: string, performed_by = "Dr. (demo) Physician") =>
    request<ClinicalFact>("/clinical-facts/reject", { method: "POST", body: JSON.stringify({ fact_id, performed_by }) }),

  // --- documents ---
  uploadDocument: (encounter_id: string, doc_type: string, filename: string) =>
    request(`/documents/upload?encounter_id=${encounter_id}&doc_type=${doc_type}&filename=${encodeURIComponent(filename)}`, { method: "POST" }),
  processDocument: (document_id: string) => request(`/documents/${document_id}/process`, { method: "POST" }),
  listDocuments: (encounter_id: string) => request(`/documents/${encounter_id}/list`),

  // --- timeline ---
  getTimeline: (patient_id: string) => request(`/timeline/${patient_id}`),

  // --- contradictions ---
  detectContradictions: (encounter_id: string) =>
    request<Contradiction[]>(`/contradictions/detect?encounter_id=${encounter_id}`, { method: "POST" }),
  listContradictions: (encounter_id: string) => request<Contradiction[]>(`/contradictions/${encounter_id}`),
  resolveContradiction: (id: string, decision: string, kept_fact_id?: string, discarded_fact_id?: string) =>
    request<Contradiction>(`/contradictions/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ decision, kept_fact_id, discarded_fact_id }),
    }),

  // --- red flags / triage ---
  listRules: () => request<RedFlagRule[]>("/red-flags/rules"),
  createRule: (rule: Partial<RedFlagRule>) => request<RedFlagRule>("/red-flags/rules", { method: "POST", body: JSON.stringify(rule) }),
  updateRule: (rule_id: string, rule: Partial<RedFlagRule>) =>
    request<RedFlagRule>(`/red-flags/rules/${rule_id}`, { method: "PUT", body: JSON.stringify(rule) }),
  testRule: (rule_id: string, inputs: Record<string, any>) =>
    request(`/red-flags/rules/${rule_id}/test`, { method: "POST", body: JSON.stringify({ rule_id, inputs }) }),
  disableRule: (rule_id: string) => request<RedFlagRule>(`/red-flags/rules/${rule_id}/disable`, { method: "POST" }),
  evaluateTriage: (encounter_id: string) => request(`/triage/evaluate?encounter_id=${encounter_id}`, { method: "POST" }),
  getTriageStatus: (encounter_id: string) => request(`/triage/${encounter_id}`),

  // --- summaries ---
  generateSummary: (encounter_id: string) => request<Summary>(`/summaries/generate?encounter_id=${encounter_id}`, { method: "POST" }),
  getSummary: (encounter_id: string) => request<Summary>(`/summaries/${encounter_id}`),
  confirmSummary: (summary_id: string) => request<Summary>(`/summaries/${summary_id}/confirm`, { method: "POST" }),
  rejectSummary: (summary_id: string) => request<Summary>(`/summaries/${summary_id}/reject`, { method: "POST" }),
  editSummary: (summary_id: string, text: string) =>
    request<Summary>(`/summaries/${summary_id}/edit`, { method: "POST", body: JSON.stringify({ text }) }),

  // --- FHIR / ABDM / HIS ---
  fhirStatus: () => request("/fhir/status"),
  fhirExport: (encounter_id: string) => request(`/fhir/export?encounter_id=${encounter_id}`, { method: "POST" }),

  // --- AYUSH ---
  getAyushFields: () => request("/ayush/fields"),
  submitAyushAnswer: (encounter_id: string, concept: string, value?: string) =>
    request(`/ayush/answer?encounter_id=${encounter_id}&concept=${concept}${value ? `&value=${encodeURIComponent(value)}` : ""}`, { method: "POST" }),

  // --- evaluation ---
  getEvaluationResults: () => request("/evaluation/results"),
  runEvaluation: () => request("/evaluation/run", { method: "POST" }),

  // --- admin ---
  getAuditLog: () => request("/admin/audit-log"),
  toggleAIStatus: (provider: string) => request(`/admin/ai-status/${provider}/toggle`, { method: "POST" }),
  getAIStatus: () => request("/admin/ai-status"),
};
