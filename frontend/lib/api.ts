/**
 * Thin REST client for the MediKiosk FastAPI backend. Requests to /api/* are
 * proxied to NEXT_PUBLIC_API_BASE by the rewrite rule in next.config.js, so
 * this file never needs to know the backend's real host in dev vs Docker.
 */
import type {
  ClinicalFact,
  Patient,
  Encounter,
  Contradiction,
  RedFlagRule,
  Summary,
  TreatmentRecord,
  PrescribedMedicine,
  DocumentOutDetailed,
  ClinicalDocumentExtraction,
  DoctorAccount,
  NurseAccount,
  ConsultationRoomItem,
  TokenItem,
  TokenQueueItem,
  TokenDisplayState,
  AdminPatientRecord,
} from "./types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers, ...restOptions } = options;
  const isFormData = typeof FormData !== "undefined" && restOptions.body instanceof FormData;
  const defaultHeaders: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  const res = await fetch(`/api${path}`, {
    cache: "no-store",
    headers: { ...defaultHeaders, ...((headers as Record<string, string>) || {}) },
    ...restOptions,
  });
  if (!res.ok) {
    const raw = await res.text();
    let message = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (parsed && typeof parsed.message === "string") {
        message = parsed.message;
      }
    } catch {
      // keep raw string
    }
    const err: any = new Error(message || `API ${path} failed: ${res.status}`);
    err.status = res.status;
    throw err;
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
    request<TreatmentRecord[]>(`/patients/${patient_id}/treatments`),
  savePrescription: (
    patient_id: string,
    payload: {
      encounter_id?: string;
      diagnosis?: string;
      doctor_notes?: string;
      doctor_name?: string;
      prescribed_medicines: PrescribedMedicine[];
    }
  ) =>
    request<TreatmentRecord>(`/patients/${patient_id}/prescriptions`, {
      method: "POST",
      body: JSON.stringify({ patient_id, ...payload }),
    }),
  getEncounterPrescription: (encounter_id: string) =>
    request<TreatmentRecord | null>(`/encounters/${encounter_id}/prescription`),
  createPatient: (patient: Partial<Patient>) =>
    request<Patient>("/patients", { method: "POST", body: JSON.stringify(patient) }),
  getPatient: (id: string) => request<Patient>(`/patients/${id}`),
  listPatients: () => request<Patient[]>("/patients"),
  listPatientEncounters: (patient_id: string) => request<Encounter[]>(`/patients/${patient_id}/encounters`),
  createEncounter: (patient_id: string, mode: string = "general", previous_illness_id?: string) =>
    request<Encounter>("/encounters", {
      method: "POST",
      body: JSON.stringify({ patient_id, mode, previous_illness_id }),
    }),
  startEncounter: (patient_id: string, mode = "allopathy", previous_illness_id?: string) =>
    request<Encounter>("/encounters", {
      method: "POST",
      body: JSON.stringify({ patient_id, mode, previous_illness_id }),
    }),
  recordConsent: (encounter_id: string, granted: boolean) =>
    request("/consents", { method: "POST", body: JSON.stringify({ encounter_id, granted }) }),

  // --- history / adaptive questionnaire ---
  startHistory: (encounter_id: string) =>
    request(`/history/start?encounter_id=${encounter_id}`, { method: "POST" }),
  submitAnswer: (payload: {
    encounter_id: string;
    question_concept: string;
    raw_answer: any;
    certainty?: string;
    source_language?: string;
  }) =>
    request<ClinicalFact>("/history/answer", { method: "POST", body: JSON.stringify(payload) }),
  getHistory: (encounter_id: string) => request<ClinicalFact[]>(`/history/${encounter_id}`),

  // --- speech / chief complaint ---
  extractFromSpeech: (encounter_id: string, language: string) =>
    request(`/clinical-facts/extract?encounter_id=${encounter_id}&language=${language}`, { method: "POST" }),

  // --- facts ---
  listFacts: (encounter_id: string) => request<ClinicalFact[]>(`/clinical-facts/${encounter_id}`),
  verifyFact: (fact_id: string, performed_by = "Physician") =>
    request<ClinicalFact>("/clinical-facts/verify", { method: "POST", body: JSON.stringify({ fact_id, performed_by }) }),
  correctFact: (fact_id: string, new_value: any, new_label?: string, performed_by = "Physician") =>
    request<ClinicalFact>("/clinical-facts/correct", {
      method: "POST",
      body: JSON.stringify({ fact_id, new_value, new_label, performed_by }),
    }),
  rejectFact: (fact_id: string, performed_by = "Physician") =>
    request<ClinicalFact>("/clinical-facts/reject", { method: "POST", body: JSON.stringify({ fact_id, performed_by }) }),

  // --- documents ---
  uploadDocument: (encounter_id: string, doc_type: string, filename: string) =>
    request(
      `/documents/upload?encounter_id=${encounter_id}&doc_type=${doc_type}&filename=${encodeURIComponent(filename)}`,
      { method: "POST" }
    ),
  processDocument: (document_id: string) => request(`/documents/${document_id}/process`, { method: "POST" }),
  listDocuments: (encounter_id: string) => request<DocumentOutDetailed[]>(`/documents/${encounter_id}/list`),
  getDocument: (document_id: string) => request<DocumentOutDetailed>(`/documents/${document_id}`),
  listPatientDocuments: (patient_id: string) => request<DocumentOutDetailed[]>(`/documents/patient/${patient_id}/list`),
  confirmDocument: (document_id: string, extracted_data: ClinicalDocumentExtraction, confirmed_by: string = "Patient") =>
    request<DocumentOutDetailed>(`/documents/${document_id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ extracted_data, confirmed_by }),
    }),
  uploadScanDocument: async (
    encounterId: string,
    files: File[],
    docType: string = "prescription",
    patientId?: string,
    clientOcrText?: string
  ): Promise<DocumentOutDetailed> => {
    const formData = new FormData();
    formData.append("encounter_id", encounterId);
    formData.append("doc_type", docType);
    if (patientId) {
      formData.append("patient_id", patientId);
    }
    if (clientOcrText) {
      formData.append("client_ocr_text", clientOcrText);
    }
    files.forEach((file) => {
      formData.append("files", file);
    });
    return request<DocumentOutDetailed>("/documents/scan-upload", {
      method: "POST",
      body: formData,
    });
  },

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
  createRule: (rule: Partial<RedFlagRule>) =>
    request<RedFlagRule>("/red-flags/rules", { method: "POST", body: JSON.stringify(rule) }),
  updateRule: (rule_id: string, rule: Partial<RedFlagRule>) =>
    request<RedFlagRule>(`/red-flags/rules/${rule_id}`, { method: "PUT", body: JSON.stringify(rule) }),
  testRule: (rule_id: string, inputs: Record<string, any>) =>
    request(`/red-flags/rules/${rule_id}/test`, { method: "POST", body: JSON.stringify({ rule_id, inputs }) }),
  disableRule: (rule_id: string) => request<RedFlagRule>(`/red-flags/rules/${rule_id}/disable`, { method: "POST" }),
  evaluateTriage: (encounter_id: string) => request(`/triage/evaluate?encounter_id=${encounter_id}`, { method: "POST" }),
  getTriageStatus: (encounter_id: string) => request(`/triage/${encounter_id}`),

  // --- summaries ---
  generateSummary: (encounter_id: string) =>
    request<Summary>(`/summaries/generate?encounter_id=${encounter_id}`, { method: "POST" }),
  getSummary: (encounter_id: string) => request<Summary>(`/summaries/${encounter_id}`),
  confirmSummary: (summary_id: string, confirmed_by?: string) =>
    request<Summary>(
      `/summaries/${summary_id}/confirm${confirmed_by ? `?confirmed_by=${encodeURIComponent(confirmed_by)}` : ""}`,
      { method: "POST" }
    ),
  rejectSummary: (summary_id: string, rejected_by?: string) =>
    request<Summary>(
      `/summaries/${summary_id}/reject${rejected_by ? `?rejected_by=${encodeURIComponent(rejected_by)}` : ""}`,
      { method: "POST" }
    ),
  editSummary: (summary_id: string, text: string, edited_by?: string) =>
    request<Summary>(`/summaries/${summary_id}/edit`, {
      method: "POST",
      body: JSON.stringify({ text, edited_by: edited_by || "Doctor" }),
    }),

  // --- FHIR / ABDM / HIS ---
  fhirStatus: () => request("/fhir/status"),
  fhirExport: (encounter_id: string) => request(`/fhir/export?encounter_id=${encounter_id}`, { method: "POST" }),

  // --- AYUSH ---
  getAyushFields: () => request("/ayush/fields"),
  submitAyushAnswer: (encounter_id: string, concept: string, value?: string) =>
    request(
      `/ayush/answer?encounter_id=${encounter_id}&concept=${concept}${value ? `&value=${encodeURIComponent(value)}` : ""}`,
      { method: "POST" }
    ),

  // --- auth ---
  login: (payload: { username: string; password: string }) =>
    request<{ access_token: string; token_type: string; role: string; username?: string; full_name?: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // --- admin doctor & patient management ---
  listDoctors: () => request<DoctorAccount[]>("/admin/doctors"),
  createDoctor: (data: { username: string; password: string; full_name: string }) =>
    request<DoctorAccount>("/admin/doctors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDoctor: (id: string, data: { username?: string; password?: string; full_name?: string }) =>
    request<DoctorAccount>(`/admin/doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDoctor: (id: string) =>
    request<{ ok: boolean; message: string }>(`/admin/doctors/${id}`, {
      method: "DELETE",
    }),
  listNurses: () => request<NurseAccount[]>("/admin/nurses"),
  createNurse: (data: { username: string; password: string; full_name: string }) =>
    request<NurseAccount>("/admin/nurses", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNurse: (id: string, data: { username?: string; password?: string; full_name?: string }) =>
    request<NurseAccount>(`/admin/nurses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteNurse: (id: string) =>
    request<{ ok: boolean; message: string }>(`/admin/nurses/${id}`, {
      method: "DELETE",
    }),
  listAllPatientsAdmin: () => request<AdminPatientRecord[]>("/admin/patients"),
  deletePatientAdmin: (id: string) =>
    request<{ ok: boolean; message: string }>(`/admin/patients/${id}`, {
      method: "DELETE",
    }),
  listRoomsAdmin: () => request<ConsultationRoomItem[]>("/admin/rooms"),
  createRoomAdmin: (data: { name: string; department?: string; default_doctor?: string }) =>
    request<ConsultationRoomItem>("/admin/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRoomAdmin: (
    id: string,
    data: { name?: string; department?: string; default_doctor?: string; is_active?: boolean }
  ) =>
    request<ConsultationRoomItem>(`/admin/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRoomAdmin: (id: string) =>
    request<{ ok: boolean; message: string }>(`/admin/rooms/${id}`, {
      method: "DELETE",
    }),
  resetTokenSystemAdmin: () =>
    request<{ ok: boolean; message: string; cleared_count: number }>("/admin/tokens/reset", {
      method: "POST",
    }),

  // --- admin ---
  getAuditLog: () => request("/admin/audit-log"),
  toggleAIStatus: (provider: string) => request(`/admin/ai-status/${provider}/toggle`, { method: "POST" }),
  getAIStatus: () => request("/admin/ai-status"),

  // --- tokens ---
  generateToken: (patient_id: string, encounter_id?: string, department?: string) =>
    request<TokenItem>("/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ patient_id, encounter_id, department }),
    }),
  getDisplayState: () => request<TokenDisplayState>("/tokens/display-state"),
  getActiveTokens: () => request<TokenItem[]>("/tokens/active"),
  getTokenQueue: (status?: string) =>
    request<TokenQueueItem[]>(`/tokens/queue${status ? `?status=${status}` : ""}`),
  callToken: (token_id: string, payload: { doctor_id?: string; doctor_name: string; room_number?: string }) =>
    request<TokenItem>(`/tokens/${token_id}/call`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  startConsultation: (token_id: string) =>
    request<TokenItem>(`/tokens/${token_id}/start-consultation`, { method: "POST" }),
  completeToken: (token_id: string) =>
    request<TokenItem>(`/tokens/${token_id}/complete`, { method: "POST" }),
  recallToken: (token_id: string) =>
    request<TokenItem>(`/tokens/${token_id}/recall`, { method: "POST" }),
  getPatientActiveToken: (patient_id: string) =>
    request<TokenItem | null>(`/tokens/patient/${patient_id}`),
  getRoomAvailability: () =>
    request<{ all_rooms: string[]; occupied: Record<string, string> }>("/tokens/rooms"),
  claimRoom: (doctor_name: string, room_number: string) =>
    request<{ ok: boolean; room_number: string; doctor_name: string }>("/tokens/rooms/claim", {
      method: "POST",
      body: JSON.stringify({ doctor_name, room_number }),
    }),
  releaseRoom: (doctor_name: string) =>
    request<{ ok: boolean }>("/tokens/rooms/release", {
      method: "POST",
      body: JSON.stringify({ doctor_name }),
    }),
  getSecurityStatus: () => request<any>("/admin/security/status"),
  getSecurityDbInspection: (limit: number = 4) => request<any>(`/admin/security/inspect-db?limit=${limit}`),
};
