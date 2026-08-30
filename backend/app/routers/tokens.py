"""
Token Management Router for MediKiosk.
Handles token generation, queue management, doctor calling/assignment,
and real-time WebSocket synchronization with hospital display boards.
"""
import json
import asyncio
from datetime import datetime, timezone, date
from typing import Optional, List, Set

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from ..database import get_db, SessionLocal
from ..models import TokenQueue, TokenStatus, Patient, Encounter, TriageEvent, ClinicalFact, gen_uuid, utcnow
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


def _generate_next_token_number(db: Session, department: str = "General Medicine") -> str:
    """Generate sequential daily token format containing only digits, e.g. 001, 002, 023, 101."""
    today_start = datetime.combine(date.today(), datetime.min.time())
    count = db.query(TokenQueue).filter(
        TokenQueue.created_at >= today_start
    ).count()

    seq = count + 1
    return f"{seq:03d}"


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


def _build_display_state(db: Session) -> TokenDisplayStateOut:
    """Build the 2-column token display board state."""
    # Active tokens: CALLED or IN_CONSULTATION
    active_tokens = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION])
    ).order_by(desc(TokenQueue.called_at), desc(TokenQueue.updated_at)).all()

    col1_item = None
    col2_item = None

    # First pass: Check if assigned specifically by room or doctor
    used_ids = set()
    for tok in active_tokens:
        p = db.query(Patient).filter(Patient.id == tok.patient_id).first()
        p_name = p.name if p else None

        item = TokenColumnDisplay(
            token_number=tok.token_number,
            doctor_name=tok.doctor_name or "Consulting Physician",
            room_number=tok.room_number or "Room 1",
            status=tok.status.value,
            patient_name=p_name,
            department=tok.department,
            called_at=tok.called_at,
        )

        room_str = (tok.room_number or "").lower()
        doc_str = (tok.doctor_name or "").lower()

        if ("room 1" in room_str or "rahul" in doc_str or "station 1" in room_str) and col1_item is None:
            col1_item = item
            used_ids.add(tok.id)
        elif ("room 2" in room_str or "priya" in doc_str or "station 2" in room_str) and col2_item is None:
            col2_item = item
            used_ids.add(tok.id)

    # Second pass: Fill remaining columns from other active tokens
    remaining_active = [tok for tok in active_tokens if tok.id not in used_ids]
    for tok in remaining_active:
        p = db.query(Patient).filter(Patient.id == tok.patient_id).first()
        p_name = p.name if p else None
        item = TokenColumnDisplay(
            token_number=tok.token_number,
            doctor_name=tok.doctor_name or "Consulting Physician",
            room_number=tok.room_number or ("Room 1" if col1_item is None else "Room 2"),
            status=tok.status.value,
            patient_name=p_name,
            department=tok.department,
            called_at=tok.called_at,
        )
        if col1_item is None:
            col1_item = item
        elif col2_item is None:
            col2_item = item

    # Waiting queue count and upcoming token numbers
    waiting_tokens = db.query(TokenQueue).filter(
        TokenQueue.status == TokenStatus.WAITING
    ).order_by(TokenQueue.created_at.asc()).all()

    waiting_count = len(waiting_tokens)
    upcoming_tokens = [w.token_number for w in waiting_tokens[:6]]

    # Recent called history (up to last 5 called / completed)
    recent_history = db.query(TokenQueue).filter(
        TokenQueue.status.in_([TokenStatus.CALLED, TokenStatus.IN_CONSULTATION, TokenStatus.COMPLETED]),
        TokenQueue.called_at.isnot(None)
    ).order_by(desc(TokenQueue.called_at)).limit(5).all()

    recent_called_list = []
    for r in recent_history:
        p = db.query(Patient).filter(Patient.id == r.patient_id).first()
        recent_called_list.append(TokenColumnDisplay(
            token_number=r.token_number,
            doctor_name=r.doctor_name or "Physician",
            room_number=r.room_number or "Room 1",
            status=r.status.value,
            patient_name=p.name if p else None,
            department=r.department,
            called_at=r.called_at,
        ))

    return TokenDisplayStateOut(
        column1=col1_item,
        column2=col2_item,
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

    token.status = TokenStatus.CALLED
    token.doctor_id = payload.doctor_id
    token.doctor_name = payload.doctor_name
    token.room_number = payload.room_number or "Room 1"
    token.called_at = utcnow()

    db.flush()
    patient = db.query(Patient).filter(Patient.id == token.patient_id).first()
    p_name = patient.name if patient else "Patient"
    log_event(db, "Token called", f"Token {token.token_number} called by {token.doctor_name} ({token.room_number})", encounter_id=token.encounter_id)
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
