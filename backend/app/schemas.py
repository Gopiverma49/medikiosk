"""Pydantic v2 schemas. Kept close to the ORM models but decoupled for API stability."""
from __future__ import annotations
from typing import Optional, Any, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class PatientLookupIn(BaseModel):
    patient_id: str  # 10-digit Patient ID


class TreatmentRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    illness_id: str
    illness_name: str
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    visit_date: Optional[str] = None
    created_at: datetime


class PatientCreate(BaseModel):
    patient_id: Optional[str] = None  # 10-digit identifier e.g. "1000000001"
    name: str
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    preferred_language: Optional[str] = "en"
    department: Optional[str] = "General Medicine"
    is_synthetic: bool = True


class PatientOut(PatientCreate):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


class EncounterCreate(BaseModel):
    patient_id: str
    mode: str = "general"  # general | ayush
    department: Optional[str] = None
    previous_illness_id: Optional[str] = None


class EncounterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    patient_id: str
    mode: str
    status: str
    previous_illness_id: Optional[str] = None
    created_at: datetime


class ConsentCreate(BaseModel):
    encounter_id: str
    granted: bool


class HistoryAnswerIn(BaseModel):
    encounter_id: str
    question_concept: str
    raw_answer: Optional[Any] = None   # None == unknown, never coerced to "No"
    certainty: str = "confirmed"       # confirmed | unknown
    source_language: Optional[str] = "en"


class ClinicalFactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    encounter_id: str
    concept: str
    category: Optional[str]
    value: Optional[Any]
    unit: Optional[str]
    label: Optional[str]
    certainty: str
    source: str
    source_language: Optional[str]
    original_text: Optional[str]
    confidence: Optional[float]
    extraction_method: Optional[str]
    verification_status: str
    verified_by: Optional[str]
    timestamp: Optional[datetime] = Field(default=None, alias="created_at")


class FactVerifyAction(BaseModel):
    fact_id: str
    performed_by: str = "Dr. (demo) Physician"


class FactCorrectAction(BaseModel):
    fact_id: str
    new_value: Any
    new_label: Optional[str] = None
    performed_by: str = "Dr. (demo) Physician"


class DocumentUploadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    encounter_id: str
    doc_type: str
    filename: str
    status: str


class ContradictionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    encounter_id: str
    type: str
    description_a: Optional[str]
    description_b: Optional[str]
    status: str


class ContradictionResolveIn(BaseModel):
    decision: str
    resolved_by: str = "Dr. (demo) Physician"
    kept_fact_id: Optional[str] = None
    discarded_fact_id: Optional[str] = None


class RedFlagRuleIn(BaseModel):
    rule_id: str
    name: str
    enabled: bool = True
    priority: str = "MEDIUM"
    action: str = "FLAG_FOR_REVIEW"
    conditions: dict


class RedFlagRuleOut(RedFlagRuleIn):
    model_config = ConfigDict(from_attributes=True)
    id: str
    version: str


class RedFlagTestIn(BaseModel):
    rule_id: str
    inputs: dict  # {"chest_pain": true, "dyspnea": true, ...}


class SummaryGenerateIn(BaseModel):
    encounter_id: str


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    encounter_id: str
    text: str
    sources: Optional[list]
    facts_needing_verification: int
    contradictions_count: int
    status: str


class SummaryEditIn(BaseModel):
    text: str
    edited_by: str = "Dr. (demo) Physician"


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: Optional[str] = None
    full_name: Optional[str] = None


class LoginIn(BaseModel):
    username: str
    password: str


class DoctorCreate(BaseModel):
    username: str
    password: str
    full_name: str


class DoctorUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None


class DoctorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    full_name: Optional[str] = None
    role: str
    created_at: datetime
    updated_at: Optional[datetime] = None


# --- Token Management Schemas ---

class TokenGenerateIn(BaseModel):
    patient_id: str
    encounter_id: Optional[str] = None
    department: Optional[str] = "General Medicine"


class TokenCallIn(BaseModel):
    doctor_id: Optional[str] = None
    doctor_name: str = "Dr. Rahul"
    room_number: Optional[str] = "Room 1"


class PatientTokenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token_number: str
    patient_id: str
    encounter_id: Optional[str] = None
    status: str
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    room_number: Optional[str] = None
    department: Optional[str] = None
    triage_priority: Optional[str] = None
    called_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class TokenQueueItemOut(PatientTokenOut):
    patient_name: Optional[str] = None
    patient_identifier: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_phone: Optional[str] = None
    symptoms_preview: Optional[str] = None


class TokenColumnDisplay(BaseModel):
    token_number: str
    doctor_name: str
    room_number: str
    status: str  # CALLED | IN_CONSULTATION
    patient_name: Optional[str] = None
    department: Optional[str] = None
    called_at: Optional[datetime] = None


class RoomCreateIn(BaseModel):
    name: str  # e.g. "Room C"
    department: Optional[str] = "General Medicine"
    default_doctor: Optional[str] = None


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    department: str
    default_doctor: Optional[str] = None
    is_active: bool
    created_at: datetime


class TokenDisplayStateOut(BaseModel):
    column1: Optional[TokenColumnDisplay] = None  # Backwards compat
    column2: Optional[TokenColumnDisplay] = None  # Backwards compat
    rooms: List[TokenColumnDisplay] = []  # Dynamic rooms: Room A, Room B, Room C...
    waiting_count: int = 0
    upcoming_tokens: List[str] = []
    recent_called: List[TokenColumnDisplay] = []

