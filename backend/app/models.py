"""
Canonical clinical data model (see docs/ARCHITECTURE.md section "Clinical Information Model").

Design rules enforced throughout:
  - UUID primary keys everywhere.
  - Every clinically meaningful row carries: source, confidence, verification_status,
    created_at / updated_at, where applicable.
  - The clinical *meaning* of a fact is stored as a language-neutral `concept` string;
    `original_text` / `source_language` are kept separately, for provenance only.
  - Nothing is ever silently auto-verified: verification_status starts UNVERIFIED or
    UNKNOWN and only a human action can move it to *_VERIFIED / *_CONFIRMED.
"""
import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text, Enum
)
from .db_types import GUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class VerificationStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"
    PATIENT_CONFIRMED = "PATIENT_CONFIRMED"
    PHYSICIAN_VERIFIED = "PHYSICIAN_VERIFIED"
    PHYSICIAN_CORRECTED = "PHYSICIAN_CORRECTED"
    REJECTED = "REJECTED"
    CONFLICTED = "CONFLICTED"
    UNKNOWN = "UNKNOWN"


class FactSource(str, enum.Enum):
    PATIENT_SPOKEN = "PATIENT_SPOKEN"
    PATIENT_TOUCH = "PATIENT_TOUCH"
    UPLOADED_DOCUMENT = "UPLOADED_DOCUMENT"
    OCR = "OCR"
    AI_INFERENCE = "AI_INFERENCE"
    PHYSICIAN_ENTERED = "PHYSICIAN_ENTERED"
    PHYSICIAN_VERIFIED = "PHYSICIAN_VERIFIED"


class Role(str, enum.Enum):
    PATIENT = "PATIENT"
    DOCTOR = "DOCTOR"
    TRIAGE = "TRIAGE"
    ADMIN = "ADMIN"


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class User(Base, TimestampMixin):
    """Staff / patient login identity used for JWT auth + RBAC."""
    __tablename__ = "users"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(Role), nullable=False, default=Role.PATIENT)
    full_name = Column(String, nullable=True)


class Patient(Base, TimestampMixin):
    __tablename__ = "patients"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    patient_id = Column(String, unique=True, nullable=True, index=True)  # 10-digit ID e.g. 1000000001
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)
    preferred_language = Column(String, nullable=True)  # en | hi | kn
    department = Column(String, nullable=True)
    is_synthetic = Column(Boolean, default=True)  # always True in this prototype

    encounters = relationship("Encounter", back_populates="patient")
    treatment_records = relationship("TreatmentRecord", back_populates="patient", cascade="all, delete-orphan")


class TreatmentRecord(Base, TimestampMixin):
    """Past treatment and illness history record for a patient."""
    __tablename__ = "treatment_records"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False, index=True)
    illness_id = Column(String, nullable=False)
    illness_name = Column(String, nullable=False)
    symptoms = Column(Text, nullable=True)
    diagnosis = Column(String, nullable=True)
    treatment = Column(Text, nullable=True)
    visit_date = Column(String, nullable=True)  # Human readable e.g. "12 Aug 2026"

    patient = relationship("Patient", back_populates="treatment_records")


class Encounter(Base, TimestampMixin):
    __tablename__ = "encounters"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    patient_id = Column(GUID(), ForeignKey("patients.id"), nullable=False)
    mode = Column(String, default="general")  # general | ayush
    status = Column(String, default="in_progress")
    department = Column(String, nullable=True)
    previous_illness_id = Column(String, nullable=True)  # linked if continuing same illness

    patient = relationship("Patient", back_populates="encounters")
    consents = relationship("Consent", back_populates="encounter")
    facts = relationship("ClinicalFact", back_populates="encounter")
    documents = relationship("Document", back_populates="encounter")


class Consent(Base, TimestampMixin):
    __tablename__ = "consents"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    granted = Column(Boolean, nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow)

    encounter = relationship("Encounter", back_populates="consents")


class HistoryAnswer(Base, TimestampMixin):
    """Raw adaptive-questionnaire answer, prior to schema normalization."""
    __tablename__ = "history_answers"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    question_concept = Column(String, nullable=False)
    raw_answer = Column(JSON, nullable=True)  # null == unknown / not answered
    certainty = Column(String, default="confirmed")  # confirmed | unknown
    source_language = Column(String, nullable=True)


class ClinicalConcept(Base):
    """Controlled vocabulary of language-neutral clinical concepts."""
    __tablename__ = "clinical_concepts"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    concept_key = Column(String, unique=True, nullable=False)  # e.g. "chest_pain"
    display_name_en = Column(String, nullable=False)
    category = Column(String, nullable=True)  # symptom | pmh | medication | allergy | investigation | ayush ...


class ClinicalFact(Base, TimestampMixin):
    """
    The central unit of the system: one language-neutral clinical fact,
    always carrying confidence + provenance + verification_status.
    """
    __tablename__ = "clinical_facts"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)

    concept = Column(String, nullable=False, index=True)  # language-neutral concept key
    category = Column(String, nullable=True)
    value = Column(JSON, nullable=True)  # null when certainty == unknown
    unit = Column(String, nullable=True)
    label = Column(String, nullable=True)  # human-readable rendering, any language

    certainty = Column(String, default="confirmed")  # confirmed | unknown
    source = Column(Enum(FactSource), nullable=False)
    source_language = Column(String, nullable=True)
    original_text = Column(Text, nullable=True)
    source_document_id = Column(GUID(), ForeignKey("documents.id"), nullable=True)

    confidence = Column(Float, nullable=True)  # 0..1, extraction confidence only
    extraction_method = Column(String, nullable=True)

    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.UNVERIFIED)
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    original_extraction = Column(JSON, nullable=True)  # snapshot kept for audit if physician-corrected

    encounter = relationship("Encounter", back_populates="facts")


class Medication(Base, TimestampMixin):
    __tablename__ = "medications"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    fact_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    name = Column(String, nullable=False)
    dose = Column(String, nullable=True)
    frequency = Column(String, nullable=True)
    source = Column(Enum(FactSource), nullable=False)
    confidence = Column(Float, nullable=True)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.UNVERIFIED)


class Allergy(Base, TimestampMixin):
    __tablename__ = "allergies"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    fact_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    substance = Column(String, nullable=False)
    reaction = Column(String, nullable=True)
    source = Column(Enum(FactSource), nullable=False)
    confidence = Column(Float, nullable=True)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.UNVERIFIED)


class Document(Base, TimestampMixin):
    __tablename__ = "documents"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    doc_type = Column(String, nullable=False)  # prescription | lab_report | discharge_summary
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=True)
    status = Column(String, default="uploaded")  # uploaded | processing | processed | failed
    ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)

    encounter = relationship("Encounter", back_populates="documents")
    extractions = relationship("DocumentExtraction", back_populates="document")


class DocumentExtraction(Base, TimestampMixin):
    __tablename__ = "document_extractions"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    document_id = Column(GUID(), ForeignKey("documents.id"), nullable=False)
    fact_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    field_name = Column(String, nullable=False)
    field_value = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)

    document = relationship("Document", back_populates="extractions")


class LabResult(Base, TimestampMixin):
    __tablename__ = "lab_results"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    fact_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    test_name = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    unit = Column(String, nullable=True)
    source = Column(Enum(FactSource), nullable=False)
    confidence = Column(Float, nullable=True)


class ClinicalSummary(Base, TimestampMixin):
    __tablename__ = "clinical_summaries"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    text = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    facts_needing_verification = Column(Integer, default=0)
    contradictions_count = Column(Integer, default=0)
    status = Column(String, default="AI_DRAFT")  # AI_DRAFT | PHYSICIAN_VERIFIED | PHYSICIAN_CORRECTED | REJECTED
    generated_by_provider = Column(String, nullable=True)


class RedFlagRule(Base, TimestampMixin):
    __tablename__ = "red_flag_rules"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    rule_id = Column(String, unique=True, nullable=False)  # e.g. RF_CHEST_001
    name = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    priority = Column(String, default="MEDIUM")  # HIGH | MEDIUM | LOW
    version = Column(String, default="1.0")
    action = Column(String, default="FLAG_FOR_REVIEW")
    conditions = Column(JSON, nullable=False)  # {"all": [...], "any": [...]}


class RedFlagRuleVersion(Base, TimestampMixin):
    __tablename__ = "red_flag_rule_versions"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    rule_id = Column(String, nullable=False, index=True)
    version = Column(String, nullable=False)
    conditions_snapshot = Column(JSON, nullable=False)
    changed_by = Column(String, nullable=True)


class RedFlagEvent(Base, TimestampMixin):
    __tablename__ = "red_flag_events"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    rule_id = Column(String, nullable=False)
    rule_name = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    action = Column(String, nullable=False)
    triggered_at = Column(DateTime, default=datetime.utcnow)


class TriageEvent(Base, TimestampMixin):
    __tablename__ = "triage_events"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    priority = Column(String, nullable=False)
    reason = Column(String, nullable=True)


class Contradiction(Base, TimestampMixin):
    __tablename__ = "contradictions"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=False)
    type = Column(String, nullable=False)  # VALUE_CONFLICT | TEMPORAL_CONFLICT | MEDICATION_CONFLICT | ...
    fact_a_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    fact_b_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=True)
    description_a = Column(String, nullable=True)
    description_b = Column(String, nullable=True)
    status = Column(String, default="UNRESOLVED")  # UNRESOLVED | RESOLVED


class ContradictionResolution(Base, TimestampMixin):
    __tablename__ = "contradiction_resolutions"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    contradiction_id = Column(GUID(), ForeignKey("contradictions.id"), nullable=False)
    decision = Column(String, nullable=False)
    resolved_by = Column(String, nullable=False)
    kept_fact_id = Column(GUID(), nullable=True)
    discarded_fact_id = Column(GUID(), nullable=True)


class AIProvenance(Base, TimestampMixin):
    """Every AI operation should ideally record provider/model/confidence/status."""
    __tablename__ = "ai_provenance"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    encounter_id = Column(GUID(), ForeignKey("encounters.id"), nullable=True)
    operation = Column(String, nullable=False)  # asr | ocr | nlp_extraction | summary | translation
    provider = Column(String, nullable=False)
    model = Column(String, nullable=True)
    input_reference = Column(String, nullable=True)
    output_reference = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String, default="success")  # success | failed | fallback


class AIEvaluation(Base, TimestampMixin):
    __tablename__ = "ai_evaluations"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    metric_name = Column(String, nullable=False)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1 = Column(Float, nullable=True)
    extra = Column(JSON, nullable=True)
    computed_at = Column(DateTime, default=datetime.utcnow)


class HumanVerification(Base, TimestampMixin):
    __tablename__ = "human_verifications"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    fact_id = Column(GUID(), ForeignKey("clinical_facts.id"), nullable=False)
    action = Column(String, nullable=False)  # verify | correct | reject
    performed_by = Column(String, nullable=False)
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(GUID(), primary_key=True, default=gen_uuid)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    actor = Column(String, nullable=True)
    encounter_id = Column(GUID(), nullable=True)
