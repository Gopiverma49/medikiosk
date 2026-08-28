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
}
