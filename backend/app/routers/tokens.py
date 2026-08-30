"""
Token Management Router for MediKiosk.
Handles token generation, queue management, doctor calling/assignment,
and real-time WebSocket synchronization with hospital display boards.
"""
import json
import asyncio
from datetime import datetime, timezone, date, timedelta
from typing import Optional, List, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from ..database import get_db, SessionLocal
from ..models import TokenQueue, TokenStatus, Patient, Encounter, TriageEvent, ClinicalFact, ConsultationRoom, gen_uuid, utcnow
from ..schemas import (
    TokenGenerateIn, TokenCallIn, PatientTokenOut, TokenQueueItemOut,
    TokenDisplayStateOut, TokenColumnDisplay,
)
from ..services.audit import log_event

router = APIRouter(prefix="/api", tags=["tokens"])


# --- WebSocket Connection Manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        async with self._lock:
            dead_connections = set()
            msg_text = json.dumps(message, default=str)
            for connection in self.active_connections:
                try:
                    await connection.send_text(msg_text)
                except Exception:
                    dead_connections.add(connection)
            for dead in dead_connections:
                self.active_connections.discard(dead)


manager = ConnectionManager()


async def broadcast_token_event(event_type: str, payload: dict):
    """Broadcast real-time token state event to all connected clients."""
    try:
        await manager.broadcast({
            "type": event_type,
            "data": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print("WebSocket broadcast notice:", e)


def _get_current_cycle_start() -> datetime:
    """
    Returns the start datetime of the daily hospital token cycle (8:00 AM local time).
    If current time is before 8:00 AM, the cycle started yesterday at 8:00 AM.
    If current time is at or after 8:00 AM, the cycle started today at 8:00 AM.
    """
    now = datetime.now()
    today_8am = now.replace(hour=8, minute=0, second=0, microsecond=0)
    if now >= today_8am:
        return today_8am
    else:
        yesterday = now - timedelta(days=1)
        return yesterday.replace(hour=8, minute=0, second=0, microsecond=0)


def _generate_next_token_number(db: Session, department: str = "General Medicine") -> str:
    """
    Generate sequential daily token starting from 1 each day at 8:00 AM.
    Format is digits only: 1, 2, 3, 4, 5...
    """
    cycle_start = _get_current_cycle_start()
    last_token = db.query(TokenQueue).filter(
        TokenQueue.created_at >= cycle_start
    ).order_by(TokenQueue.created_at.desc()).first()

    if not last_token or not last_token.token_number:
        return "1"

    digits = "".join(filter(str.isdigit, last_token.token_number))
    if digits:
        try:
            next_seq = int(digits) + 1
            return str(next_seq)
        except ValueError:
            pass

    count = db.query(TokenQueue).filter(TokenQueue.created_at >= cycle_start).count()
    return str(count + 1)


def _get_symptoms_preview(db: Session, encounter_id: Optional[str]) -> Optional[str]:
    if not encounter_id:
        return None
    facts = db.query(ClinicalFact).filter(
        ClinicalFact.encounter_id == encounter_id,
        ClinicalFact.category.in_(["symptom", "chief_complaint"])
    ).limit(3).all()
    if facts:
        labels = [f.label or f.concept for f in facts if f.label or f.concept]
        if labels:
            return ", ".join(labels)
    return None


def _get_or_create_default_rooms(db: Session) -> List[ConsultationRoom]:
    """Retrieve all active consultation rooms, seeding Room A and Room B if empty."""
    rooms = db.query(ConsultationRoom).filter(ConsultationRoom.is_active == True).order_by(ConsultationRoom.name.asc()).all()
    if not rooms:
        r_a = ConsultationRoom(name="Room A", department="General Medicine", default_doctor="Dr. Rahul Kumar", is_active=True)
        r_b = ConsultationRoom(name="Room B", department="General Medicine", default_doctor="Dr. Priya Sharma", is_active=True)
        db.add(r_a)
        db.add(r_b)
        db.commit()
        rooms = db.query(ConsultationRoom).filter(ConsultationRoom.is_active == True).order_by(ConsultationRoom.name.asc()).all()
    return rooms


def _build_display_state(db: Session) -> TokenDisplayStateOut:
    """Build dynamic room display state for all configured consultation rooms."""
    db_rooms = _get_or_create_default_rooms(db)

    # Active tokens in CALLED or IN_CONSULTATION
    active_tokens = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).order_by(desc(TokenQueue.called_at), desc(TokenQueue.updated_at)).all()

    rooms_display: List[TokenColumnDisplay] = []
    used_token_ids = set()

    for room in db_rooms:
        matched_token = None
        for tok in active_tokens:
            if tok.id in used_token_ids:
                continue
            r_num = (tok.room_number or "").strip().lower()
            room_name_lower = room.name.strip().lower()
            if (
                r_num == room_name_lower
                or (room.name == "Room A" and r_num == "room 1")
                or (room.name == "Room B" and r_num == "room 2")
            ):
                matched_token = tok
                used_token_ids.add(tok.id)
                break

        if matched_token:
            p = db.query(Patient).filter(Patient.id == matched_token.patient_id).first()
            rooms_display.append(TokenColumnDisplay(
                token_number=matched_token.token_number,
                doctor_name=matched_token.doctor_name or room.default_doctor or "Consulting Physician",
                room_number=room.name,
                status=matched_token.status.value,
                patient_name=p.name if p else None,
                department=matched_token.department or room.department,
                called_at=matched_token.called_at,
            ))
        else:
            rooms_display.append(TokenColumnDisplay(
                token_number="",
                doctor_name=room.default_doctor or "Consulting Physician",
                room_number=room.name,
                status="WAITING",
                patient_name=None,
                department=room.department,
                called_at=None,
            ))

    col1_item = rooms_display[0] if len(rooms_display) > 0 and rooms_display[0].token_number else None
    col2_item = rooms_display[1] if len(rooms_display) > 1 and rooms_display[1].token_number else None

    # Waiting queue count and upcoming token numbers
    waiting_tokens = db.query(TokenQueue).filter(
        TokenQueue.status == TokenStatus.WAITING
    ).order_by(TokenQueue.created_at.asc()).all()

    waiting_count = len(waiting_tokens)
    upcoming_tokens = [w.token_number for w in waiting_tokens[:8]]

    # Recent called history (up to last 5 called / completed)
    recent_history = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION, TokenStatus.COMPLETED]),
        TokenQueue.called_at.isnot(None)
    ).order_by(desc(TokenQueue.called_at)).limit(5).all()

    recent_called_list = []
    for r in recent_history:
        p = db.query(Patient).filter(Patient.id == r.patient_id).first()
        r_name = r.room_number or "Room A"
        if r_name == "Room 1": r_name = "Room A"
        if r_name == "Room 2": r_name = "Room B"
        recent_called_list.append(TokenColumnDisplay(
            token_number=r.token_number,
            doctor_name=r.doctor_name or "Physician",
            room_number=r_name,
            status=r.status.value,
            patient_name=p.name if p else None,
            department=r.department,
            called_at=r.called_at,
        ))

    return TokenDisplayStateOut(
        column1=col1_item,
        column2=col2_item,
        rooms=rooms_display,
        waiting_count=waiting_count,
        upcoming_tokens=upcoming_tokens,
        recent_called=recent_called_list,
    )


# --- Endpoints ---

@router.post("/tokens/generate", response_model=PatientTokenOut)
async def generate_patient_token(payload: TokenGenerateIn, db: Session = Depends(get_db)):
    """Generate or retrieve unique token for a patient/encounter intake."""
    # Find patient
    clean_id = payload.patient_id.strip()
    patient = db.query(Patient).filter((Patient.id == clean_id) | (Patient.patient_id == clean_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Check for existing active token for this patient / encounter
    query = db.query(TokenQueue).filter(
        TokenQueue.patient_id == patient.id,
        TokenQueue.status.in_([TokenStatus.WAITING, TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    )
    if payload.encounter_id:
        existing_enc_token = query.filter(TokenQueue.encounter_id == payload.encounter_id).first()
        if existing_enc_token:
            return existing_enc_token

    existing_token = query.order_by(TokenQueue.created_at.desc()).first()
    if existing_token:
        # Link encounter if missing
        if payload.encounter_id and not existing_token.encounter_id:
            existing_token.encounter_id = payload.encounter_id
            db.commit()
            db.refresh(existing_token)
        return existing_token

    # Check triage priority if encounter provided
    priority = "ROUTINE"
    if payload.encounter_id:
        triage = db.query(TriageEvent).filter(TriageEvent.encounter_id == payload.encounter_id).first()
        if triage and triage.priority:
            priority = triage.priority

    token_number = _generate_next_token_number(db, payload.department or patient.department or "General Medicine")

    token = TokenQueue(
        token_number=token_number,
        patient_id=patient.id,
        encounter_id=payload.encounter_id,
        status=TokenStatus.WAITING,
        department=payload.department or patient.department or "General Medicine",
        triage_priority=priority,
    )
    db.add(token)
    db.flush()
    log_event(db, "Token generated", f"Token {token.token_number} generated for {patient.name}", encounter_id=payload.encounter_id)
    db.commit()
    db.refresh(token)

    # Broadcast event
    asyncio.create_task(broadcast_token_event("TOKEN_GENERATED", {
        "token_id": token.id,
        "token_number": token.token_number,
        "patient_name": patient.name,
        "status": token.status.value,
        "display_state": _build_display_state(db).model_dump(),
    }))

    return token


@router.get("/tokens/display-state", response_model=TokenDisplayStateOut)
def get_display_state(db: Session = Depends(get_db)):
    """Retrieve full formatted 2-column display state for the waiting-area TV."""
    return _build_display_state(db)


@router.get("/tokens/active", response_model=List[PatientTokenOut])
def get_active_tokens(db: Session = Depends(get_db)):
    """Retrieve active called or in-consultation tokens."""
    return db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).order_by(desc(TokenQueue.called_at)).all()


# Active room claim tracking in-memory for active doctor sessions
ACTIVE_DOCTOR_ROOMS: dict[str, str] = {}  # doctor_name -> room_number


class RoomClaimIn(BaseModel):
    doctor_name: str
    room_number: str


class RoomReleaseIn(BaseModel):
    doctor_name: str


@router.get("/tokens/rooms")
def get_room_availability(db: Session = Depends(get_db)):
    """Return all consultation rooms and their current occupancy."""
    db_rooms = _get_or_create_default_rooms(db)
    all_rooms = [r.name for r in db_rooms]

    active_tokens = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).all()
    
    occupied: dict[str, str] = {}
    for tok in active_tokens:
        if tok.room_number and tok.doctor_name:
            r_name = tok.room_number
            if r_name == "Room 1": r_name = "Room A"
            if r_name == "Room 2": r_name = "Room B"
            occupied[r_name] = tok.doctor_name

    # Merge with active doctor room claims
    for doc, room in ACTIVE_DOCTOR_ROOMS.items():
        if room:
            r_name = room
            if r_name == "Room 1": r_name = "Room A"
            if r_name == "Room 2": r_name = "Room B"
            occupied[r_name] = doc

    return {
        "all_rooms": all_rooms,
        "occupied": occupied,
    }


@router.post("/tokens/rooms/claim")
async def claim_room(payload: RoomClaimIn, db: Session = Depends(get_db)):
    """Doctor claims an available consultation room upon login or room switch."""
    db_rooms = _get_or_create_default_rooms(db)
    valid_names = [r.name for r in db_rooms] + ["Room 1", "Room 2"]
    if payload.room_number not in valid_names:
        raise HTTPException(status_code=400, detail="Invalid room number")

    norm_room = payload.room_number
    if norm_room == "Room 1": norm_room = "Room A"
    if norm_room == "Room 2": norm_room = "Room B"

    ACTIVE_DOCTOR_ROOMS[payload.doctor_name] = norm_room

    # Broadcast room update to all doctor stations and TV displays
    asyncio.create_task(broadcast_token_event("ROOMS_UPDATED", {
        "claimed_by": payload.doctor_name,
        "room_number": norm_room,
        "occupied": {r: d for d, r in ACTIVE_DOCTOR_ROOMS.items()}
    }))

    return {"ok": True, "room_number": norm_room, "doctor_name": payload.doctor_name}


@router.post("/tokens/rooms/release")
async def release_room(payload: RoomReleaseIn, db: Session = Depends(get_db)):
    """Doctor logs out or leaves, freeing their assigned room for other doctors."""
    if payload.doctor_name in ACTIVE_DOCTOR_ROOMS:
        released_room = ACTIVE_DOCTOR_ROOMS.pop(payload.doctor_name)
        asyncio.create_task(broadcast_token_event("ROOMS_UPDATED", {
            "released_by": payload.doctor_name,
            "room_number": released_room,
            "occupied": {r: d for d, r in ACTIVE_DOCTOR_ROOMS.items()}
        }))
    return {"ok": True}


@router.get("/tokens/queue", response_model=List[TokenQueueItemOut])
def get_token_queue(
    status: Optional[str] = Query(None, description="Filter by status: WAITING, CALLED, IN_CONSULTATION, COMPLETED, ALL"),
    db: Session = Depends(get_db)
):
    """Retrieve queue list for doctor station with enriched patient info."""
    query = db.query(TokenQueue)
    if status and status.upper() != "ALL":
        try:
            status_enum = TokenStatus(status.upper())
            query = query.filter(TokenQueue.status == status_enum)
        except ValueError:
            pass
    else:
        # Default show waiting, called, and in_consultation first
        query = query.filter(TokenQueue.status.in_([TokenStatus.WAITING, TokenStatus.CALLED, TokenStatus.IN_CONSULTATION]))

    tokens = query.order_by(
        # High priority first, then FIFO by created_at
        desc(TokenQueue.triage_priority == "HIGH"),
        desc(TokenQueue.triage_priority == "MEDIUM"),
        TokenQueue.created_at.asc()
    ).all()

    results = []
    for tok in tokens:
        p = db.query(Patient).filter(Patient.id == tok.patient_id).first()
        symptoms_preview = _get_symptoms_preview(db, tok.encounter_id)
        
        item = TokenQueueItemOut(
            id=tok.id,
            token_number=tok.token_number,
            patient_id=tok.patient_id,
            encounter_id=tok.encounter_id,
            status=tok.status.value,
            doctor_id=tok.doctor_id,
            doctor_name=tok.doctor_name,
            room_number=tok.room_number,
            department=tok.department,
            triage_priority=tok.triage_priority,
            called_at=tok.called_at,
            started_at=tok.started_at,
            completed_at=tok.completed_at,
            created_at=tok.created_at,
            patient_name=p.name if p else "Patient",
            patient_identifier=p.patient_id if p else None,
            patient_age=p.age if p else None,
            patient_gender=p.gender if p else None,
            patient_phone=p.phone if p else None,
            symptoms_preview=symptoms_preview,
        )
        results.append(item)
    return results


@router.post("/tokens/{token_id}/call", response_model=PatientTokenOut)
async def call_patient_token(token_id: str, payload: TokenCallIn, db: Session = Depends(get_db)):
    """
    Doctor calls a patient token. Updates state to CALLED,
    assigns doctor/room, and broadcasts update to display in real-time.
    Prevents race conditions if called concurrently.
    """
    token = db.query(TokenQueue).filter(TokenQueue.id == token_id).with_for_update(nowait=False).first() if db.bind.dialect.name != "sqlite" else db.query(TokenQueue).filter(TokenQueue.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    # Race condition check: If already called by ANOTHER doctor
    if token.status in [TokenStatus.CALLED, TokenStatus.IN_CONSULTATION]:
        if token.doctor_name and token.doctor_name != payload.doctor_name:
            raise HTTPException(
                status_code=409,
                detail=f"Patient {token.token_number} was already called by {token.doctor_name}."
            )

    token.status = TokenStatus.IN_CONSULTATION
    token.doctor_id = payload.doctor_id
    token.doctor_name = payload.doctor_name
    token.room_number = payload.room_number or "Room 1"
    token.called_at = utcnow()
    token.started_at = utcnow()

    db.flush()
    patient = db.query(Patient).filter(Patient.id == token.patient_id).first()
    p_name = patient.name if patient else "Patient"
    log_event(db, "Token consultation started", f"Token {token.token_number} consultation started with {token.doctor_name} ({token.room_number})", encounter_id=token.encounter_id)
    db.commit()
    db.refresh(token)

    display_state = _build_display_state(db)
    asyncio.create_task(broadcast_token_event("TOKEN_CALLED", {
        "token_id": token.id,
        "token_number": token.token_number,
        "patient_name": p_name,
        "doctor_name": token.doctor_name,
        "room_number": token.room_number,
        "status": token.status.value,
        "display_state": display_state.model_dump(),
    }))

    return token


@router.post("/tokens/{token_id}/start-consultation", response_model=PatientTokenOut)
async def start_token_consultation(token_id: str, db: Session = Depends(get_db)):
    """Move token to IN_CONSULTATION status."""
    token = db.query(TokenQueue).filter(TokenQueue.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    token.status = TokenStatus.IN_CONSULTATION
    token.started_at = utcnow()
    db.flush()
    log_event(db, "Consultation started", f"Consultation started for Token {token.token_number}", encounter_id=token.encounter_id)
    db.commit()
    db.refresh(token)

    display_state = _build_display_state(db)
    asyncio.create_task(broadcast_token_event("TOKEN_IN_CONSULTATION", {
        "token_id": token.id,
        "token_number": token.token_number,
        "status": token.status.value,
        "display_state": display_state.model_dump(),
    }))

    return token


@router.post("/tokens/{token_id}/complete", response_model=PatientTokenOut)
async def complete_token(token_id: str, db: Session = Depends(get_db)):
    """Complete consultation. Removes token from active display board."""
    token = db.query(TokenQueue).filter(TokenQueue.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    token.status = TokenStatus.COMPLETED
    token.completed_at = utcnow()
    db.flush()
    log_event(db, "Token completed", f"Consultation completed for Token {token.token_number}", encounter_id=token.encounter_id)
    db.commit()
    db.refresh(token)

    display_state = _build_display_state(db)
    asyncio.create_task(broadcast_token_event("TOKEN_COMPLETED", {
        "token_id": token.id,
        "token_number": token.token_number,
        "status": token.status.value,
        "display_state": display_state.model_dump(),
    }))

    return token


@router.post("/tokens/{token_id}/recall", response_model=PatientTokenOut)
async def recall_patient_token(token_id: str, db: Session = Depends(get_db)):
    """Re-announce/chime token on waiting area TV display."""
    token = db.query(TokenQueue).filter(TokenQueue.id == token_id).first()
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    token.called_at = utcnow()
    db.commit()
    db.refresh(token)

    patient = db.query(Patient).filter(Patient.id == token.patient_id).first()
    p_name = patient.name if patient else "Patient"
    display_state = _build_display_state(db)
    asyncio.create_task(broadcast_token_event("TOKEN_RECALLED", {
        "token_id": token.id,
        "token_number": token.token_number,
        "patient_name": p_name,
        "doctor_name": token.doctor_name,
        "room_number": token.room_number,
        "status": token.status.value,
        "display_state": display_state.model_dump(),
    }))

    return token


@router.get("/tokens/patient/{patient_id}", response_model=Optional[PatientTokenOut])
def get_patient_active_token(patient_id: str, db: Session = Depends(get_db)):
    """Get most recent token for a patient."""
    clean_id = patient_id.strip()
    patient = db.query(Patient).filter((Patient.id == clean_id) | (Patient.patient_id == clean_id)).first()
    if not patient:
        return None
    return db.query(TokenQueue).filter(
        TokenQueue.patient_id == patient.id
    ).order_by(TokenQueue.created_at.desc()).first()


# --- WebSocket Endpoint ---
@router.websocket("/ws/tokens")
async def websocket_token_endpoint(websocket: WebSocket):
    """
    Real-time WebSocket endpoint for Token Display screens and Doctor Stations.
    Pushes instantaneous updates whenever a token is generated, called, or completed.
    """
    await manager.connect(websocket)
    # Send initial display state on connect
    db = SessionLocal()
    try:
        initial_state = _build_display_state(db)
        await websocket.send_text(json.dumps({
            "type": "INITIAL_STATE",
            "data": {"display_state": initial_state.model_dump()},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, default=str))
    except Exception as e:
        print("Error sending initial WS state:", e)
    finally:
        db.close()

    try:
        while True:
            # Keep connection open, handle client heartbeats/pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
