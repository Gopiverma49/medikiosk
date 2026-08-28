"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def _uuid_pk():
    return sa.Column("id", postgresql.UUID(as_uuid=False), primary_key=True)


def _timestamps():
    return [
        sa.Column("created_at", sa.DateTime, nullable=True),
        sa.Column("updated_at", sa.DateTime, nullable=True),
    ]


def upgrade():
    op.create_table(
        "users", _uuid_pk(),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("role", sa.String, nullable=False),
        sa.Column("full_name", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "patients", _uuid_pk(),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("age", sa.Integer, nullable=True),
        sa.Column("gender", sa.String, nullable=True),
        sa.Column("preferred_language", sa.String, nullable=True),
        sa.Column("department", sa.String, nullable=True),
        sa.Column("is_synthetic", sa.Boolean, default=True),
        *_timestamps(),
    )

    op.create_table(
        "encounters", _uuid_pk(),
        sa.Column("patient_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("mode", sa.String, default="general"),
        sa.Column("status", sa.String, default="in_progress"),
        sa.Column("department", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "consents", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("granted", sa.Boolean, nullable=False),
        sa.Column("granted_at", sa.DateTime, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "history_answers", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("question_concept", sa.String, nullable=False),
        sa.Column("raw_answer", postgresql.JSON, nullable=True),
        sa.Column("certainty", sa.String, default="confirmed"),
        sa.Column("source_language", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "clinical_concepts", _uuid_pk(),
        sa.Column("concept_key", sa.String, nullable=False, unique=True),
        sa.Column("display_name_en", sa.String, nullable=False),
        sa.Column("category", sa.String, nullable=True),
    )

    op.create_table(
        "documents", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("doc_type", sa.String, nullable=False),
        sa.Column("filename", sa.String, nullable=False),
        sa.Column("storage_path", sa.String, nullable=True),
        sa.Column("status", sa.String, default="uploaded"),
        sa.Column("ocr_text", sa.Text, nullable=True),
        sa.Column("ocr_confidence", sa.Float, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "clinical_facts", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("concept", sa.String, nullable=False, index=True),
        sa.Column("category", sa.String, nullable=True),
        sa.Column("value", postgresql.JSON, nullable=True),
        sa.Column("unit", sa.String, nullable=True),
        sa.Column("label", sa.String, nullable=True),
        sa.Column("certainty", sa.String, default="confirmed"),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("source_language", sa.String, nullable=True),
        sa.Column("original_text", sa.Text, nullable=True),
        sa.Column("source_document_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("extraction_method", sa.String, nullable=True),
        sa.Column("verification_status", sa.String, default="UNVERIFIED"),
        sa.Column("verified_by", sa.String, nullable=True),
        sa.Column("verified_at", sa.DateTime, nullable=True),
        sa.Column("original_extraction", postgresql.JSON, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "medications", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("fact_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("dose", sa.String, nullable=True),
        sa.Column("frequency", sa.String, nullable=True),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("verification_status", sa.String, default="UNVERIFIED"),
        *_timestamps(),
    )

    op.create_table(
        "allergies", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("fact_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("substance", sa.String, nullable=False),
        sa.Column("reaction", sa.String, nullable=True),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("verification_status", sa.String, default="UNVERIFIED"),
        *_timestamps(),
    )

    op.create_table(
        "document_extractions", _uuid_pk(),
        sa.Column("document_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("fact_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("field_name", sa.String, nullable=False),
        sa.Column("field_value", postgresql.JSON, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "lab_results", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("fact_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("test_name", sa.String, nullable=False),
        sa.Column("value", sa.Float, nullable=True),
        sa.Column("unit", sa.String, nullable=True),
        sa.Column("source", sa.String, nullable=False),
        sa.Column("confidence", sa.Float, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "clinical_summaries", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("sources", postgresql.JSON, nullable=True),
        sa.Column("facts_needing_verification", sa.Integer, default=0),
        sa.Column("contradictions_count", sa.Integer, default=0),
        sa.Column("status", sa.String, default="AI_DRAFT"),
        sa.Column("generated_by_provider", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "red_flag_rules", _uuid_pk(),
        sa.Column("rule_id", sa.String, nullable=False, unique=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("enabled", sa.Boolean, default=True),
        sa.Column("priority", sa.String, default="MEDIUM"),
        sa.Column("version", sa.String, default="1.0"),
        sa.Column("action", sa.String, default="FLAG_FOR_REVIEW"),
        sa.Column("conditions", postgresql.JSON, nullable=False),
        *_timestamps(),
    )

    op.create_table(
        "red_flag_rule_versions", _uuid_pk(),
        sa.Column("rule_id", sa.String, nullable=False, index=True),
        sa.Column("version", sa.String, nullable=False),
        sa.Column("conditions_snapshot", postgresql.JSON, nullable=False),
        sa.Column("changed_by", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "red_flag_events", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("rule_id", sa.String, nullable=False),
        sa.Column("rule_name", sa.String, nullable=False),
        sa.Column("priority", sa.String, nullable=False),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("triggered_at", sa.DateTime, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "triage_events", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("priority", sa.String, nullable=False),
        sa.Column("reason", sa.String, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "contradictions", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("encounters.id"), nullable=False),
        sa.Column("type", sa.String, nullable=False),
        sa.Column("fact_a_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("fact_b_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=True),
        sa.Column("description_a", sa.String, nullable=True),
        sa.Column("description_b", sa.String, nullable=True),
        sa.Column("status", sa.String, default="UNRESOLVED"),
        *_timestamps(),
    )

    op.create_table(
        "contradiction_resolutions", _uuid_pk(),
        sa.Column("contradiction_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("contradictions.id"), nullable=False),
        sa.Column("decision", sa.String, nullable=False),
        sa.Column("resolved_by", sa.String, nullable=False),
        sa.Column("kept_fact_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("discarded_fact_id", postgresql.UUID(as_uuid=False), nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "ai_provenance", _uuid_pk(),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("operation", sa.String, nullable=False),
        sa.Column("provider", sa.String, nullable=False),
        sa.Column("model", sa.String, nullable=True),
        sa.Column("input_reference", sa.String, nullable=True),
        sa.Column("output_reference", sa.String, nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("status", sa.String, default="success"),
        *_timestamps(),
    )

    op.create_table(
        "ai_evaluations", _uuid_pk(),
        sa.Column("metric_name", sa.String, nullable=False),
        sa.Column("precision", sa.Float, nullable=True),
        sa.Column("recall", sa.Float, nullable=True),
        sa.Column("f1", sa.Float, nullable=True),
        sa.Column("extra", postgresql.JSON, nullable=True),
        sa.Column("computed_at", sa.DateTime, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "human_verifications", _uuid_pk(),
        sa.Column("fact_id", postgresql.UUID(as_uuid=False), sa.ForeignKey("clinical_facts.id"), nullable=False),
        sa.Column("action", sa.String, nullable=False),
        sa.Column("performed_by", sa.String, nullable=False),
        sa.Column("previous_value", postgresql.JSON, nullable=True),
        sa.Column("new_value", postgresql.JSON, nullable=True),
        *_timestamps(),
    )

    op.create_table(
        "audit_logs", _uuid_pk(),
        sa.Column("timestamp", sa.DateTime, nullable=True),
        sa.Column("event", sa.String, nullable=False),
        sa.Column("detail", sa.String, nullable=True),
        sa.Column("actor", sa.String, nullable=True),
        sa.Column("encounter_id", postgresql.UUID(as_uuid=False), nullable=True),
    )


def downgrade():
    for table in [
        "audit_logs", "human_verifications", "ai_evaluations", "ai_provenance",
        "contradiction_resolutions", "contradictions", "triage_events", "red_flag_events",
        "red_flag_rule_versions", "red_flag_rules", "clinical_summaries", "lab_results",
        "document_extractions", "allergies", "medications", "clinical_facts", "documents",
        "clinical_concepts", "history_answers", "consents", "encounters", "patients", "users",
    ]:
        op.drop_table(table)
