from app.models import Patient, Encounter, ClinicalFact, ConsultationRoom, FactSource, VerificationStatus


def test_room_creation_modification_and_deletion(client, db_session):
    # 1. List rooms (auto-seeds default Room A and Room B)
    res = client.get("/api/admin/rooms")
    assert res.status_code == 200
    initial_rooms = res.json()
    assert len(initial_rooms) >= 2

    # 2. Create room
    create_res = client.post("/api/admin/rooms", json={
        "name": "Room Test Alpha",
        "department": "Cardiology",
        "default_doctor": "Dr. Test Cardiologist"
    })
    assert create_res.status_code == 200
    created_data = create_res.json()
    room_id = created_data["id"]
    assert created_data["name"] == "Room Test Alpha"
    assert created_data["department"] == "Cardiology"

    # 3. Update room (PUT)
    update_res = client.put(f"/api/admin/rooms/{room_id}", json={
        "name": "Room Alpha Modified",
        "department": "Pediatrics",
        "default_doctor": "Dr. Child Specialist"
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Room Alpha Modified"
    assert updated_data["department"] == "Pediatrics"
    assert updated_data["default_doctor"] == "Dr. Child Specialist"

    # 4. Verify in DB
    db_room = db_session.query(ConsultationRoom).filter(ConsultationRoom.id == room_id).first()
    assert db_room is not None
    assert db_room.name == "Room Alpha Modified"
    assert db_room.department == "Pediatrics"

    # 5. Delete room
    del_res = client.delete(f"/api/admin/rooms/{room_id}")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True

    # 6. Verify deleted from DB
    db_session.expire_all()
    db_room_after = db_session.query(ConsultationRoom).filter(ConsultationRoom.id == room_id).first()
    assert db_room_after is None


def test_patient_deep_cascaded_database_deletion(client, db_session):
    # 1. Create Patient
    p_res = client.post("/api/patients", json={
        "name": "Cascade Delete Patient",
        "phone": "9876543210",
        "age": 45,
        "gender": "Male",
        "department": "General Medicine"
    })
    assert p_res.status_code == 200
    p_data = p_res.json()
    p_id = p_data["id"]

    # 2. Create Encounter
    enc_res = client.post("/api/encounters", json={
        "patient_id": p_id,
        "mode": "general",
        "department": "General Medicine"
    })
    assert enc_res.status_code == 200
    enc_id = enc_res.json()["id"]

    # 3. Create Fact
    fact = ClinicalFact(
        encounter_id=enc_id,
        concept="fever",
        category="symptom",
        source=FactSource.PATIENT_SPOKEN,
        verification_status=VerificationStatus.UNVERIFIED,
    )
    db_session.add(fact)
    db_session.commit()

    # 4. Delete patient via admin API
    del_res = client.delete(f"/api/admin/patients/{p_id}")
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True

    # 5. Verify patient, encounter, and clinical fact are all completely deleted from DB
    db_session.expire_all()
    assert db_session.query(Patient).filter(Patient.id == p_id).first() is None
    assert db_session.query(Encounter).filter(Encounter.id == enc_id).first() is None
    assert db_session.query(ClinicalFact).filter(ClinicalFact.encounter_id == enc_id).first() is None
