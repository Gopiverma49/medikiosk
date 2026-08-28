from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Encounter, Patient, ClinicalFact, Document
from ..services.audit import log_event
from integrations.fhir_abdm_his import MockFHIRProvider, MockABDMProvider, MockHISProvider, integration_status

router = APIRouter(prefix="/api/fhir", tags=["fhir"])
fhir_provider = MockFHIRProvider()
abdm_provider = MockABDMProvider()
his_provider = MockHISProvider()


@router.get("/status")
def status():
    return integration_status()


@router.post("/export")
def export(encounter_id: str, db: Session = Depends(get_db)):
    enc = db.query(Encounter).filter(Encounter.id == encounter_id).first()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    patient = db.query(Patient).filter(Patient.id == enc.patient_id).first()
    facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id == encounter_id).all()
    documents = db.query(Document).filter(Document.encounter_id == encounter_id).all()

    patient_dict = {"id": patient.id, "name": patient.name, "gender": patient.gender}
    encounter_dict = {"id": enc.id, "mode": enc.mode}
    facts_list = [
        {"concept": f.concept, "category": f.category, "value": f.value, "label": f.label,
         "unit": f.unit, "verification_status": f.verification_status}
        for f in facts
    ]
    docs_list = [{"filename": d.filename, "status": d.status} for d in documents]

    bundle = fhir_provider.build_bundle(patient_dict, encounter_dict, facts_list, docs_list)
    his_result = his_provider.push_encounter(encounter_dict)

    log_event(db, "Mock FHIR export performed", f"{len(bundle['entry'])} resources", encounter_id=encounter_id)
    db.commit()
    return {"bundle": bundle, "his": his_result, "integration_status": integration_status()}


@router.post("/abdm/link")
def link_abdm(patient_id: str, abha_id: str, db: Session = Depends(get_db)):
    result = abdm_provider.link_health_id(patient_id, abha_id)
    log_event(db, "ABDM link attempted (mock/sandbox)", f"patient={patient_id}")
    db.commit()
    return result
