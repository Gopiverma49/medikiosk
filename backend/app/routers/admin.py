import asyncio
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    User, Role, Patient, Encounter, AuditLog, ConsultationRoom, TokenQueue, TokenStatus, utcnow,
    Consent, HistoryAnswer, ClinicalFact, Document, DocumentExtraction,
    ClinicalSummary, RedFlagEvent, TriageEvent, Contradiction, ContradictionResolution,
    HumanVerification, TreatmentRecord
)
from ..schemas import DoctorCreate, DoctorUpdate, DoctorOut, NurseCreate, NurseUpdate, NurseOut, PatientOut, RoomCreateIn, RoomUpdateIn, RoomOut
from ..security import hash_password
from ..services.audit import log_event
from .tokens import _build_display_state, broadcast_token_event, ACTIVE_DOCTOR_ROOMS
from ai.providers.factory import set_force_fail, _FORCE_FAIL

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _safe_broadcast(event_type: str, payload: dict):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(broadcast_token_event(event_type, payload))
    except RuntimeError:
        pass


# --- Doctor Management (Admin Only) ---
@router.get("/doctors", response_model=List[DoctorOut])
def list_doctors(db: Session = Depends(get_db)):
    """List all doctor accounts."""
    return db.query(User).filter(User.role == Role.DOCTOR).order_by(User.created_at.desc()).all()


@router.post("/doctors", response_model=DoctorOut)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)):
    """Create a new doctor credential account."""
    clean_username = payload.username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    existing = db.query(User).filter(User.username == clean_username).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this username already exists")
    
    doc = User(
        username=clean_username,
        hashed_password=hash_password(payload.password),
        role=Role.DOCTOR,
        full_name=payload.full_name.strip() if payload.full_name else f"Dr. {clean_username}",
    )
    db.add(doc)
    db.flush()
    log_event(db, "Doctor Created", f"Admin created doctor account '{doc.username}' ({doc.full_name})")
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/doctors/{doctor_id}", response_model=DoctorOut)
def update_doctor(doctor_id: str, payload: DoctorUpdate, db: Session = Depends(get_db)):
    """Modify a doctor account (name, username, or password)."""
    doc = db.query(User).filter(User.id == doctor_id, User.role == Role.DOCTOR).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    if payload.username and payload.username.strip() != doc.username:
        clean_user = payload.username.strip()
        existing = db.query(User).filter(User.username == clean_user).first()
        if existing and existing.id != doc.id:
            raise HTTPException(status_code=400, detail="Username already in use")
        doc.username = clean_user
    
    if payload.full_name:
        doc.full_name = payload.full_name.strip()
        
    if payload.password and payload.password.strip():
        doc.hashed_password = hash_password(payload.password.strip())
        
    doc.updated_at = datetime.now(timezone.utc)
    log_event(db, "Doctor Modified", f"Admin updated doctor '{doc.username}' ({doc.full_name})")
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/doctors/{doctor_id}")
def delete_doctor(doctor_id: str, db: Session = Depends(get_db)):
    """Delete a doctor credential account."""
    doc = db.query(User).filter(User.id == doctor_id, User.role == Role.DOCTOR).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    doc_name = doc.full_name or doc.username
    doc_username = doc.username

    # Remove active room assignment if logged in
    for d_key in list(ACTIVE_DOCTOR_ROOMS.keys()):
        if d_key == doc_username or d_key == doc_name or d_key == f"Dr. {doc_username}":
            del ACTIVE_DOCTOR_ROOMS[d_key]

    db.delete(doc)
    log_event(db, "Doctor Deleted", f"Admin deleted doctor account '{doc.username}' ({doc_name})")
    db.commit()

    try:
        display_state = _build_display_state(db)
        _safe_broadcast("ROOMS_UPDATED", {
            "message": f"Doctor '{doc_name}' account deleted.",
            "display_state": display_state.model_dump(),
        })
    except Exception:
        pass

    return {"ok": True, "message": f"Doctor '{doc_name}' deleted successfully"}


# --- Nurse Management (Admin Only) ---
@router.get("/nurses", response_model=List[NurseOut])
def list_nurses(db: Session = Depends(get_db)):
    """List all nurse accounts."""
    return db.query(User).filter(User.role == Role.NURSE).order_by(User.created_at.desc()).all()


@router.post("/nurses", response_model=NurseOut)
def create_nurse(payload: NurseCreate, db: Session = Depends(get_db)):
    """Create a new nurse credential account."""
    clean_username = payload.username.strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    existing = db.query(User).filter(User.username == clean_username).first()
    if existing:
        raise HTTPException(status_code=400, detail="A user with this username already exists")
    
    nurse = User(
        username=clean_username,
        hashed_password=hash_password(payload.password),
        role=Role.NURSE,
        full_name=payload.full_name.strip() if payload.full_name else f"Nurse {clean_username}",
    )
    db.add(nurse)
    db.flush()
    log_event(db, "Nurse Created", f"Admin created nurse account '{nurse.username}' ({nurse.full_name})")
    db.commit()
    db.refresh(nurse)
    return nurse


@router.put("/nurses/{nurse_id}", response_model=NurseOut)
def update_nurse(nurse_id: str, payload: NurseUpdate, db: Session = Depends(get_db)):
    """Modify a nurse account (name, username, or password)."""
    nurse = db.query(User).filter(User.id == nurse_id, User.role == Role.NURSE).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
    
    if payload.username and payload.username.strip() != nurse.username:
        clean_user = payload.username.strip()
        existing = db.query(User).filter(User.username == clean_user).first()
        if existing and existing.id != nurse.id:
            raise HTTPException(status_code=400, detail="Username already in use")
        nurse.username = clean_user
    
    if payload.full_name:
        nurse.full_name = payload.full_name.strip()
        
    if payload.password and payload.password.strip():
        nurse.hashed_password = hash_password(payload.password.strip())
        
    nurse.updated_at = datetime.now(timezone.utc)
    log_event(db, "Nurse Modified", f"Admin updated nurse '{nurse.username}' ({nurse.full_name})")
    db.commit()
    db.refresh(nurse)
    return nurse


@router.delete("/nurses/{nurse_id}")
def delete_nurse(nurse_id: str, db: Session = Depends(get_db)):
    """Delete a nurse credential account."""
    nurse = db.query(User).filter(User.id == nurse_id, User.role == Role.NURSE).first()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse not found")
    
    nurse_name = nurse.full_name or nurse.username
    db.delete(nurse)
    log_event(db, "Nurse Deleted", f"Admin deleted nurse account '{nurse.username}' ({nurse_name})")
    db.commit()
    return {"ok": True, "message": f"Nurse '{nurse_name}' deleted successfully"}


# --- Patient Management for Admin ---
@router.get("/patients")
def list_all_patients_admin(db: Session = Depends(get_db)):
    """Retrieve full list of registered patients with encounter counts."""
    patients = db.query(Patient).order_by(Patient.created_at.desc()).all()
    results = []
    for p in patients:
        enc_count = db.query(Encounter).filter(Encounter.patient_id == p.id).count()
        results.append({
            "id": p.id,
            "patient_id": p.patient_id or p.id[:8],
            "name": p.name,
            "phone": p.phone,
            "age": p.age,
            "gender": p.gender,
            "preferred_language": p.preferred_language,
            "department": p.department,
            "encounter_count": enc_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return results


@router.delete("/patients/{patient_id}")
def delete_patient_admin(patient_id: str, db: Session = Depends(get_db)):
    """Delete a patient record and completely cascade all associated encounters and clinical data from database."""
    p = db.query(Patient).filter((Patient.id == patient_id) | (Patient.patient_id == patient_id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    name = p.name
    p_id = p.patient_id or p.id
    patient_uuid = p.id

    # 1. Find all encounters for this patient
    encounters = db.query(Encounter).filter(Encounter.patient_id == patient_uuid).all()
    enc_ids = [e.id for e in encounters]

    if enc_ids:
        # Find facts in encounters
        facts = db.query(ClinicalFact).filter(ClinicalFact.encounter_id.in_(enc_ids)).all()
        fact_ids = [f.id for f in facts]
        if fact_ids:
            db.query(HumanVerification).filter(HumanVerification.fact_id.in_(fact_ids)).delete(synchronize_session=False)

        # Find contradictions in encounters
        contradictions = db.query(Contradiction).filter(Contradiction.encounter_id.in_(enc_ids)).all()
        contra_ids = [c.id for c in contradictions]
        if contra_ids:
            db.query(ContradictionResolution).filter(ContradictionResolution.contradiction_id.in_(contra_ids)).delete(synchronize_session=False)
        db.query(Contradiction).filter(Contradiction.encounter_id.in_(enc_ids)).delete(synchronize_session=False)

        # Find documents in encounters
        docs = db.query(Document).filter(Document.encounter_id.in_(enc_ids)).all()
        doc_ids = [d.id for d in docs]
        if doc_ids:
            db.query(DocumentExtraction).filter(DocumentExtraction.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.encounter_id.in_(enc_ids)).delete(synchronize_session=False)

        # Delete facts and remaining clinical items
        db.query(ClinicalFact).filter(ClinicalFact.encounter_id.in_(enc_ids)).delete(synchronize_session=False)
        db.query(HistoryAnswer).filter(HistoryAnswer.encounter_id.in_(enc_ids)).delete(synchronize_session=False)
        db.query(Consent).filter(Consent.encounter_id.in_(enc_ids)).delete(synchronize_session=False)
        db.query(ClinicalSummary).filter(ClinicalSummary.encounter_id.in_(enc_ids)).delete(synchronize_session=False)
        db.query(RedFlagEvent).filter(RedFlagEvent.encounter_id.in_(enc_ids)).delete(synchronize_session=False)
        db.query(TriageEvent).filter(TriageEvent.encounter_id.in_(enc_ids)).delete(synchronize_session=False)

    # Delete tokens and treatment records
    db.query(TokenQueue).filter(TokenQueue.patient_id == patient_uuid).delete(synchronize_session=False)
    db.query(TreatmentRecord).filter(TreatmentRecord.patient_id == patient_uuid).delete(synchronize_session=False)
    
    # Delete encounters
    if enc_ids:
        db.query(Encounter).filter(Encounter.id.in_(enc_ids)).delete(synchronize_session=False)

    # Finally delete patient
    db.delete(p)
    log_event(db, "Patient Deleted", f"Admin deleted patient '{name}' (ID: {p_id}) from database")
    db.commit()

    try:
        display_state = _build_display_state(db)
        _safe_broadcast("TOKEN_COMPLETED", {
            "message": f"Patient '{name}' record deleted.",
            "display_state": display_state.model_dump(),
        })
    except Exception:
        pass

    return {"ok": True, "message": f"Patient '{name}' permanently deleted from database"}


# --- Consultation Rooms Management (Admin Only) ---
@router.get("/rooms", response_model=List[RoomOut])
def list_rooms_admin(db: Session = Depends(get_db)):
    """List all consultation rooms."""
    rooms = db.query(ConsultationRoom).order_by(ConsultationRoom.name.asc()).all()
    # If empty, auto-seed default Room A and Room B
    if not rooms:
        r_a = ConsultationRoom(name="Room A", department="General Medicine", default_doctor=None, is_active=True)
        r_b = ConsultationRoom(name="Room B", department="General Medicine", default_doctor=None, is_active=True)
        db.add(r_a)
        db.add(r_b)
        db.commit()
        rooms = db.query(ConsultationRoom).order_by(ConsultationRoom.name.asc()).all()
    return rooms


@router.post("/rooms", response_model=RoomOut)
def create_room_admin(payload: RoomCreateIn, db: Session = Depends(get_db)):
    """Create a new consultation room (e.g. Room C, Room D)."""
    clean_name = payload.name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Room name is required")

    existing = db.query(ConsultationRoom).filter(ConsultationRoom.name.ilike(clean_name)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Room '{clean_name}' already exists")

    room = ConsultationRoom(
        name=clean_name,
        department=payload.department.strip() if payload.department else "General Medicine",
        default_doctor=payload.default_doctor.strip() if payload.default_doctor else None,
        is_active=True,
    )
    db.add(room)
    db.flush()
    log_event(db, "Room Created", f"Admin created consultation room '{room.name}' ({room.department})")
    db.commit()
    db.refresh(room)

    try:
        display_state = _build_display_state(db)
        _safe_broadcast("ROOMS_UPDATED", {
            "message": f"Room '{room.name}' was created.",
            "display_state": display_state.model_dump(),
        })
    except Exception:
        pass

    return room


@router.put("/rooms/{room_id}", response_model=RoomOut)
def update_room_admin(room_id: str, payload: RoomUpdateIn, db: Session = Depends(get_db)):
    """Modify an existing consultation room (e.g. room name, department, default doctor, active status)."""
    room = db.query(ConsultationRoom).filter(ConsultationRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Consultation room not found")

    old_name = room.name
    if payload.name and payload.name.strip():
        clean_name = payload.name.strip()
        if clean_name.lower() != room.name.lower():
            existing = db.query(ConsultationRoom).filter(
                ConsultationRoom.name.ilike(clean_name),
                ConsultationRoom.id != room.id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"A room named '{clean_name}' already exists")
            room.name = clean_name
            # If active doctor rooms had old name, update it
            for doc, r_name in list(ACTIVE_DOCTOR_ROOMS.items()):
                if r_name == old_name:
                    ACTIVE_DOCTOR_ROOMS[doc] = clean_name

    if payload.department is not None:
        room.department = payload.department.strip() or "General Medicine"

    if payload.default_doctor is not None:
        room.default_doctor = payload.default_doctor.strip() or None

    if payload.is_active is not None:
        room.is_active = payload.is_active

    room.updated_at = datetime.now(timezone.utc)
    log_event(db, "Room Modified", f"Admin updated room '{old_name}' -> '{room.name}' ({room.department})")
    db.commit()
    db.refresh(room)

    # Broadcast updated room state to WebSocket clients
    try:
        display_state = _build_display_state(db)
        _safe_broadcast("ROOMS_UPDATED", {
            "message": f"Room '{room.name}' was updated by administrator.",
            "display_state": display_state.model_dump(),
        })
    except Exception as e:
        print("Room update broadcast error:", e)

    return room


@router.delete("/rooms/{room_id}")
def delete_room_admin(room_id: str, db: Session = Depends(get_db)):
    """Delete a consultation room."""
    room = db.query(ConsultationRoom).filter(ConsultationRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    name = room.name

    # Remove active room assignment if any doctor was assigned
    for doc, r_name in list(ACTIVE_DOCTOR_ROOMS.items()):
        if r_name == name:
            del ACTIVE_DOCTOR_ROOMS[doc]

    db.delete(room)
    log_event(db, "Room Deleted", f"Admin deleted consultation room '{name}'")
    db.commit()

    try:
        display_state = _build_display_state(db)
        _safe_broadcast("ROOMS_UPDATED", {
            "message": f"Room '{name}' was deleted by administrator.",
            "display_state": display_state.model_dump(),
        })
    except Exception as e:
        print("Room delete broadcast error:", e)

    return {"ok": True, "message": f"Room '{name}' deleted successfully"}


# --- Token System Reset (Admin Only) ---
@router.post("/tokens/reset")
async def reset_token_system_admin(db: Session = Depends(get_db)):
    """
    Admin manually resets the token queue and daily sequence counter.
    Marks all active/waiting tokens as COMPLETED, clears doctor room presence,
    and restarts token numbering from 1.
    """
    active_tokens = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.WAITING, TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).all()

    for tok in active_tokens:
        tok.status = TokenStatus.COMPLETED
        tok.completed_at = utcnow()

    ACTIVE_DOCTOR_ROOMS.clear()
    log_event(db, "Token System Reset", "Admin manually reset token queue and sequence counter to 1.")
    db.commit()

    display_state = _build_display_state(db)
    _safe_broadcast("TOKEN_RESET", {
        "message": "Token system was reset by administrator. Sequence restarted from 1.",
        "display_state": display_state.model_dump(),
    })

    return {
        "ok": True,
        "message": "Token system successfully reset. Next token will start from 1.",
        "cleared_count": len(active_tokens),
    }


# --- Audit & System status ---
@router.get("/audit-log")
def get_audit_log(limit: int = 200, db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    return rows


@router.get("/ai-status")
def get_ai_status():
    return _FORCE_FAIL


@router.post("/ai-status/{provider}/toggle")
def toggle_ai_status(provider: str):
    current = _FORCE_FAIL.get(provider, False)
    set_force_fail(provider, not current)
    return {"provider": provider, "force_fail": not current}
