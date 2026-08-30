export type VerificationStatus =
  | "UNVERIFIED"
  | "PATIENT_CONFIRMED"
  | "PHYSICIAN_VERIFIED"
  | "PHYSICIAN_CORRECTED"
  | "REJECTED"
  | "CONFLICTED"
  | "UNKNOWN";

export interface ClinicalFact {
  id: string;
  encounter_id: string;
  concept: string;
  category?: string | null;
  value: any;
  unit?: string | null;
  label?: string | null;
  certainty: "confirmed" | "unknown";
  source: string;
  source_language?: string | null;
  original_text?: string | null;
  confidence?: number | null;
  extraction_method?: string | null;
  verification_status: VerificationStatus;
  verified_by?: string | null;
  timestamp?: string | null;
}

export interface TreatmentRecord {
  id: string;
  patient_id: string;
  illness_id: string;
  illness_name: string;
  symptoms?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  visit_date?: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  patient_id?: string | null;
  name: string;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  preferred_language?: string | null;
  department?: string | null;
}

export interface Encounter {
  id: string;
  patient_id: string;
  mode: string;
  status: string;
  previous_illness_id?: string | null;
  created_at: string;
}

export interface Contradiction {
  id: string;
  encounter_id: string;
  type: string;
  description_a?: string | null;
  description_b?: string | null;
  status: "UNRESOLVED" | "RESOLVED";
}

export interface DoctorAccount {
  id: string;
  username: string;
  full_name?: string | null;
  role: string;
  created_at: string;
  updated_at?: string | null;
}

export interface AdminPatientRecord {
  id: string;
  patient_id: string;
  name: string;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  preferred_language?: string | null;
  department?: string | null;
  encounter_count: number;
  created_at?: string | null;
}

export interface RedFlagRule {
  id: string;
  rule_id: string;
  name: string;
  enabled: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
  version: string;
  action: string;
  conditions: { all: any[]; any: any[] };
}

export interface Summary {
  id: string;
  encounter_id: string;
  text: string;
  sources: string[];
  facts_needing_verification: number;
  contradictions_count: number;
  status: string;
  version?: number;
  draft_text?: string;
  verification_status?: string;
  facts?: ClinicalFact[];
}

export type TokenStatus = "WAITING" | "CALLED" | "IN_CONSULTATION" | "COMPLETED" | "CANCELLED";

export interface TokenItem {
  id: string;
  token_number: string;
  patient_id: string;
  encounter_id?: string | null;
  status: TokenStatus;
  doctor_id?: string | null;
  doctor_name?: string | null;
  room_number?: string | null;
  department?: string | null;
  triage_priority?: string | null;
  called_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface TokenQueueItem extends TokenItem {
  patient_name?: string | null;
  patient_identifier?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_phone?: string | null;
  symptoms_preview?: string | null;
}

export interface TokenColumnDisplay {
  token_number: string;
  doctor_name: string;
  room_number: string;
  status: string;
  patient_name?: string | null;
  department?: string | null;
  called_at?: string | null;
}

export interface ConsultationRoomItem {
  id: string;
  name: string;
  department: string;
  default_doctor?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TokenDisplayState {
  column1: TokenColumnDisplay | null;
  column2: TokenColumnDisplay | null;
  rooms?: TokenColumnDisplay[];
  waiting_count: number;
  upcoming_tokens: string[];
  recent_called: TokenColumnDisplay[];
}


