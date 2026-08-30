import asyncio
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Role, Patient, Encounter, AuditLog, ConsultationRoom, TokenQueue, TokenStatus, utcnow
from ..schemas import DoctorCreate, DoctorUpdate, DoctorOut, PatientOut, RoomCreateIn, RoomOut
from ..security import hash_password
from ..services.audit import log_event
from .tokens import _build_display_state, broadcast_token_event, ACTIVE_DOCTOR_ROOMS
from ai.providers.factory import set_force_fail, _FORCE_FAIL

router = APIRouter(prefix="/api/admin", tags=["admin"])


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
    db.delete(doc)
    log_event(db, "Doctor Deleted", f"Admin deleted doctor account '{doc.username}' ({doc_name})")
    db.commit()
    return {"ok": True, "message": f"Doctor '{doc_name}' deleted successfully"}


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
    """Delete a patient record and cascade associated encounters."""
    p = db.query(Patient).filter((Patient.id == patient_id) | (Patient.patient_id == patient_id)).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    name = p.name
    p_id = p.patient_id or p.id
    db.delete(p)
    log_event(db, "Patient Deleted", f"Admin deleted patient '{name}' (ID: {p_id})")
    db.commit()
    return {"ok": True, "message": f"Patient '{name}' deleted successfully"}


# --- Consultation Rooms Management (Admin Only) ---
@router.get("/rooms", response_model=List[RoomOut])
def list_rooms_admin(db: Session = Depends(get_db)):
    """List all consultation rooms."""
    rooms = db.query(ConsultationRoom).order_by(ConsultationRoom.name.asc()).all()
    # If empty, auto-seed default Room A and Room B
    if not rooms:
        r_a = ConsultationRoom(name="Room A", department="General Medicine", default_doctor="Dr. Rahul Kumar", is_active=True)
        r_b = ConsultationRoom(name="Room B", department="General Medicine", default_doctor="Dr. Priya Sharma", is_active=True)
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
    return room


@router.delete("/rooms/{room_id}")
def delete_room_admin(room_id: str, db: Session = Depends(get_db)):
    """Delete a consultation room."""
    room = db.query(ConsultationRoom).filter(ConsultationRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    name = room.name
    db.delete(room)
    log_event(db, "Room Deleted", f"Admin deleted consultation room '{name}'")
    db.commit()
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
    asyncio.create_task(broadcast_token_event("TOKEN_RESET", {
        "message": "Token system was reset by administrator. Sequence restarted from 1.",
        "display_state": display_state.model_dump(),
    }))

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
