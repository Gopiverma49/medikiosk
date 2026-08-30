from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, ClinicalFact, DocumentExtraction, VerificationStatus, FactSource
from ..schemas import DocumentUploadOut
from ..services.audit import log_event
from ..services.contradiction_engine import detect_contradictions
from ai.providers.factory import get_ocr_provider, raw_nlp_mock

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOC_TYPE_MAP = {"prescription": "prescription", "lab": "lab_report", "lab_report": "lab_report",
                "discharge": "discharge_summary", "discharge_summary": "discharge_summary"}


@router.post("/upload", response_model=DocumentUploadOut)
def upload_document(encounter_id: str, doc_type: str, filename: str, db: Session = Depends(get_db)):
    normalized_type = DOC_TYPE_MAP.get(doc_type, doc_type)
    doc = Document(encounter_id=encounter_id, doc_type=normalized_type, filename=filename, status="uploaded")
    db.add(doc)
    db.flush()
    log_event(db, "Document uploaded", filename, encounter_id=encounter_id)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/{document_id}/process")
def process_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ocr = get_ocr_provider()
    ocr_result = ocr.call("extract_text", doc.doc_type)
    if not ocr_result.ok:
        doc.status = "failed"
        db.commit()
        log_event(db, "OCR provider failed", doc.filename, encounter_id=doc.encounter_id)
        return {"ok": False, "fallback": ["retake_photo", "enter_manually", "continue_without_document"]}

    doc.ocr_text = ocr_result.data
    doc.ocr_confidence = ocr_result.confidence
    doc.status = "processed"

    nlp = raw_nlp_mock()
    field_result = nlp.extract_document_fields(doc.doc_type)
    created_fact_ids = []
    if field_result.ok:
        for item in field_result.data:
            concept = item["concept"]
            if concept == "medication":
                label = f'{item["label"]} {item.get("dose","")}'.strip()
                value = label
                category = "medication"
                unit = None
            elif concept == "allergy":
                label = item["label"]
                value = label
                category = "allergy"
                unit = None
            elif concept == "past_medical_history":
                label = item["label"]
                value = label
                category = "pmh"
                unit = None
            else:
                unit = item.get("unit")
                label = f'{item["label"]}: {item.get("value")} {unit or ""}'.strip()
                value = item.get("value")
                category = "investigation"

            fact = ClinicalFact(
                encounter_id=doc.encounter_id, concept=concept, category=category,
                value=value, unit=unit, label=label, certainty="confirmed",
                source=FactSource.UPLOADED_DOCUMENT, source_document_id=doc.id,
                confidence=item.get("confidence"), extraction_method="OCR + Medical NLP",
                verification_status=VerificationStatus.UNVERIFIED,
            )
            db.add(fact)
            db.flush()
            created_fact_ids.append(fact.id)
            db.add(DocumentExtraction(document_id=doc.id, fact_id=fact.id,
                                       field_name=concept, field_value=value, confidence=item.get("confidence")))

    log_event(db, "OCR + extraction completed", f"{doc.filename}: {len(created_fact_ids)} facts extracted", encounter_id=doc.encounter_id)
    db.commit()

    # Re-run contradiction detection now that document-sourced facts exist.
    detect_contradictions(db, doc.encounter_id)

    return {"ok": True, "document_id": doc.id, "facts_extracted": created_fact_ids, "ocr_text": doc.ocr_text}


@router.get("/{encounter_id}/list")
def list_documents(encounter_id: str, db: Session = Depends(get_db)):
    return db.query(Document).filter(Document.encounter_id == encounter_id).all()

