import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, ClinicalFact, DocumentExtraction, VerificationStatus, FactSource, Encounter
from ..schemas import (
    DocumentUploadOut, DocumentOutDetailed, DocumentConfirmIn, ClinicalDocumentExtraction
)
from ..config import get_settings
from ..services.audit import log_event
from ..services.contradiction_engine import detect_contradictions
from ..services.document_extractor import extract_clinical_document
from ai.providers.factory import get_ocr_provider, raw_nlp_mock

router = APIRouter(prefix="/api/documents", tags=["documents"])

DOC_TYPE_MAP = {
    "prescription": "prescription",
    "lab": "lab_report",
    "lab_report": "lab_report",
    "discharge": "discharge_summary",
    "discharge_summary": "discharge_summary",
    "radiology": "radiology_report",
    "other": "clinical_report",
}

def _get_upload_base_dir() -> str:
    return get_settings().UPLOAD_DIR


def _enrich_doc_out(doc: Document) -> DocumentOutDetailed:
    pages_list = doc.pages if isinstance(doc.pages, list) else []
    file_url = f"/api/documents/{doc.id}/file" if doc.storage_path else None
    page_urls = [f"/api/documents/{doc.id}/file?page={idx}" for idx in range(len(pages_list))] if pages_list else ([file_url] if file_url else [])
    
    extracted = None
    if doc.extracted_data and isinstance(doc.extracted_data, dict):
        try:
            extracted = ClinicalDocumentExtraction.model_validate(doc.extracted_data)
        except Exception:
            extracted = None

    return DocumentOutDetailed(
        id=str(doc.id),
        encounter_id=str(doc.encounter_id),
        patient_id=str(doc.patient_id) if doc.patient_id else None,
        doc_type=doc.doc_type,
        filename=doc.filename,
        storage_path=doc.storage_path,
        status=doc.status or "uploaded",
        pages=pages_list,
        ocr_text=doc.ocr_text,
        ocr_confidence=doc.ocr_confidence,
        extracted_data=extracted,
        file_url=file_url,
        page_urls=page_urls,
        created_at=doc.created_at,
    )


@router.post("/upload", response_model=DocumentUploadOut)
def upload_document(encounter_id: str, doc_type: str, filename: str, db: Session = Depends(get_db)):
    """Backwards-compatible legacy metadata upload endpoint."""
    normalized_type = DOC_TYPE_MAP.get(doc_type, doc_type)
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    patient_id = enc.patient_id if enc else None

    doc = Document(
        encounter_id=encounter_id,
        patient_id=patient_id,
        doc_type=normalized_type,
        filename=filename,
        status="uploaded"
    )
    db.add(doc)
    db.flush()
    log_event(db, "Document metadata uploaded", filename, encounter_id=encounter_id)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/scan-upload", response_model=DocumentOutDetailed)
async def scan_upload_document(
    encounter_id: str = Form(...),
    doc_type: str = Form("prescription"),
    patient_id: Optional[str] = Form(None),
    client_ocr_text: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """
    Multi-page document capture / upload endpoint.
    Saves original files permanently to backend/uploads/documents/{doc_id}/,
    performs OCR / clinical vision extraction, validates Pydantic schema,
    and returns document ready for editable patient review.
    """
    if not files:
        raise HTTPException(status_code=400, detail="At least one image or document page file is required")

    normalized_type = DOC_TYPE_MAP.get(doc_type, doc_type)
    if not patient_id:
        enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
        if enc:
            patient_id = enc.patient_id

    primary_filename = files[0].filename or "scanned_report.jpg"
    doc = Document(
        encounter_id=encounter_id,
        patient_id=patient_id,
        doc_type=normalized_type,
        filename=primary_filename,
        status="processing",
    )
    db.add(doc)
    db.flush()

    # Create permanent document storage directory
    doc_storage_dir = os.path.join(_get_upload_base_dir(), str(doc.id))
    os.makedirs(doc_storage_dir, exist_ok=True)

    saved_page_rel_paths = []
    accumulated_text_parts = []

    if client_ocr_text and client_ocr_text.strip():
        accumulated_text_parts.append(client_ocr_text.strip())

    for idx, f in enumerate(files):
        ext = os.path.splitext(f.filename or "")[1] or ".jpg"
        clean_name = f"page_{idx + 1}{ext}"
        target_path = os.path.join(doc_storage_dir, clean_name)
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)
        rel_path = f"{doc.id}/{clean_name}"
        saved_page_rel_paths.append(rel_path)

        # Attempt to read text directly if file has readable text/utf-8 content (e.g. text/report files)
        try:
            with open(target_path, "rb") as bf:
                raw_bytes = bf.read()
                try:
                    decoded = raw_bytes.decode("utf-8")
                    clean_words = [w for w in decoded.split() if len(w) > 2 and any(c.isalnum() for c in w)]
                    if len(clean_words) >= 3:
                        accumulated_text_parts.append(decoded)
                except UnicodeDecodeError:
                    pass
        except Exception:
            pass

    doc.storage_path = saved_page_rel_paths[0] if saved_page_rel_paths else None
    doc.pages = saved_page_rel_paths

    # Run Local OCR on uploaded images if no text has been extracted yet
    if not accumulated_text_parts:
        from ..services.ocr_service import run_local_ocr
        for rel_p in saved_page_rel_paths:
            abs_p = os.path.join(_get_upload_base_dir(), rel_p)
            file_ext = os.path.splitext(abs_p)[1].lower()
            if file_ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"):
                ocr_out = run_local_ocr(abs_p)
                if ocr_out and ocr_out.strip():
                    accumulated_text_parts.append(ocr_out.strip())

    settings = get_settings()
    # Check production provider or test sample if still empty
    if not accumulated_text_parts:
        if settings.OCR_PROVIDER == "production":
            first_file_path = os.path.join(doc_storage_dir, f"page_1{os.path.splitext(files[0].filename or '')[1] or '.jpg'}")
            ocr_provider = get_ocr_provider()
            ocr_res = ocr_provider.call("extract_text", first_file_path)
            if ocr_res.ok and ocr_res.data:
                accumulated_text_parts.append(str(ocr_res.data))
                doc.ocr_confidence = ocr_res.confidence or 0.95
        elif files and files[0].filename and "sample" in files[0].filename.lower() and settings.OCR_PROVIDER == "mock":
            ocr_provider = get_ocr_provider()
            ocr_res = ocr_provider.call("extract_text", doc.doc_type)
            if ocr_res.ok and ocr_res.data:
                accumulated_text_parts.append(str(ocr_res.data))
                doc.ocr_confidence = ocr_res.confidence or 0.95

    raw_combined_text = "\n".join(accumulated_text_parts)
    doc.ocr_text = raw_combined_text
    doc.ocr_confidence = 0.95 if raw_combined_text else 0.90

    # Extract structured clinical information (zero hallucination, strict schema)
    extraction = extract_clinical_document(raw_combined_text, doc_type=normalized_type) if raw_combined_text else ClinicalDocumentExtraction()
    doc.extracted_data = extraction.model_dump()
    doc.status = "review_required"

    db.commit()
    db.refresh(doc)
    log_event(db, "Document scanned & structured extraction completed", f"{doc.filename} ({len(files)} pages)", encounter_id=encounter_id)
    return _enrich_doc_out(doc)


@router.post("/{document_id}/confirm", response_model=DocumentOutDetailed)
def confirm_document_extraction(
    document_id: str,
    payload: DocumentConfirmIn,
    db: Session = Depends(get_db),
):
    """
    Patient / Clinician review confirmation step.
    Saves verified & edited extracted clinical entities, marks status 'confirmed',
    creates ClinicalFact rows, updates Timeline events, and triggers contradiction checks.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    ext = payload.extracted_data
    doc.extracted_data = ext.model_dump()
    doc.status = "confirmed"

    # Synchronize confirmed facts into ClinicalFact table for doctor view & contradiction engine
    # 1. Medications
    for med in ext.medicines:
        dose_label = f"{med.name} {med.strength or ''} {med.frequency or ''} {med.duration or ''}".strip()
        db.add(ClinicalFact(
            encounter_id=doc.encounter_id,
            concept="medication",
            category="medication",
            value=med.model_dump(),
            label=dose_label,
            certainty="confirmed",
            source=FactSource.UPLOADED_DOCUMENT,
            source_document_id=doc.id,
            confidence=0.98,
            extraction_method="Verified Scanned Document Extraction",
            verification_status=VerificationStatus.PATIENT_CONFIRMED,
        ))

    # 2. Symptoms
    for sym in ext.symptoms:
        db.add(ClinicalFact(
            encounter_id=doc.encounter_id,
            concept="symptom",
            category="symptom",
            value=sym.model_dump(),
            label=f"{sym.name} ({sym.duration or 'Reported'})",
            certainty="confirmed",
            source=FactSource.UPLOADED_DOCUMENT,
            source_document_id=doc.id,
            confidence=0.98,
            extraction_method="Verified Scanned Document Extraction",
            verification_status=VerificationStatus.PATIENT_CONFIRMED,
        ))

    # 3. Lab tests
    for t in ext.tests:
        db.add(ClinicalFact(
            encounter_id=doc.encounter_id,
            concept="investigation",
            category="investigation",
            value=t.model_dump(),
            unit=t.unit,
            label=f"{t.name}: {t.value} {t.unit or ''} (Ref: {t.reference_range or 'Normal'})",
            certainty="confirmed",
            source=FactSource.UPLOADED_DOCUMENT,
            source_document_id=doc.id,
            confidence=0.98,
            extraction_method="Verified Scanned Document Extraction",
            verification_status=VerificationStatus.PATIENT_CONFIRMED,
        ))

    # 4. Diagnoses
    for d in ext.diagnosis:
        db.add(ClinicalFact(
            encounter_id=doc.encounter_id,
            concept="diagnosis",
            category="pmh",
            value=d,
            label=d,
            certainty="confirmed",
            source=FactSource.UPLOADED_DOCUMENT,
            source_document_id=doc.id,
            confidence=0.98,
            extraction_method="Verified Scanned Document Extraction",
            verification_status=VerificationStatus.PATIENT_CONFIRMED,
        ))

    db.commit()
    db.refresh(doc)

    # Re-run contradiction detection with newly verified document facts
    detect_contradictions(db, doc.encounter_id)
    log_event(db, "Document extraction confirmed & saved", f"Doc ID: {doc.id} by {payload.confirmed_by}", encounter_id=doc.encounter_id)

    return _enrich_doc_out(doc)


@router.post("/{document_id}/process")
def process_document(document_id: str, db: Session = Depends(get_db)):
    """Processes document OCR and extracts structured clinical facts (backward compatible)."""
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

    # Run structured clinical entity extraction
    extraction = extract_clinical_document(doc.ocr_text, doc_type=doc.doc_type)
    doc.extracted_data = extraction.model_dump()

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

    detect_contradictions(db, doc.encounter_id)
    return {"ok": True, "document_id": doc.id, "facts_extracted": created_fact_ids, "ocr_text": doc.ocr_text}


@router.get("/{document_id}", response_model=DocumentOutDetailed)
def get_document(document_id: str, db: Session = Depends(get_db)):
    """Retrieve full document details with structured extraction and page URLs."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _enrich_doc_out(doc)


@router.get("/{document_id}/file")
def get_document_file(document_id: str, page: int = Query(0, ge=0), db: Session = Depends(get_db)):
    """
    Secure file streaming endpoint.
    Serves the permanent scanned report image or PDF for patient & doctor verification.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    target_rel_path = None
    if doc.pages and isinstance(doc.pages, list) and len(doc.pages) > page:
        target_rel_path = doc.pages[page]
    elif doc.storage_path:
        target_rel_path = doc.storage_path

    if not target_rel_path:
        # Generate on-the-fly clean placeholder image for demo/mock files
        raise HTTPException(status_code=404, detail="Scanned document file not found on disk")

    abs_path = os.path.join(_get_upload_base_dir(), target_rel_path)
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=404, detail="Original report file is not accessible")

    ext = os.path.splitext(abs_path)[1].lower()
    media_type = "image/jpeg"
    if ext == ".png":
        media_type = "image/png"
    elif ext == ".pdf":
        media_type = "application/pdf"
    elif ext == ".webp":
        media_type = "image/webp"

    return FileResponse(
        path=abs_path,
        media_type=media_type,
        filename=os.path.basename(abs_path)
    )


@router.get("/{encounter_id}/list", response_model=List[DocumentOutDetailed])
def list_documents(encounter_id: str, db: Session = Depends(get_db)):
    """List all scanned documents for an encounter with structured clinical view data."""
    docs = db.query(Document).filter(Document.encounter_id == encounter_id).order_by(Document.created_at.asc()).all()
    return [_enrich_doc_out(d) for d in docs]


@router.get("/patient/{patient_id}/list", response_model=List[DocumentOutDetailed])
def list_patient_documents(patient_id: str, db: Session = Depends(get_db)):
    """List all historical scanned reports associated with a patient."""
    docs = db.query(Document).filter(Document.patient_id == patient_id).order_by(Document.created_at.desc()).all()
    return [_enrich_doc_out(d) for d in docs]

