from app.models import Patient, TreatmentRecord


def test_kiosk_lookup_existing_patient_with_history(client, db_session):
    # Seed patient with history
    p1 = Patient(
        patient_id="1000000001",
        name="Rahul Kumar",
        phone="9876543210",
        age=42,
        gender="Male",
        preferred_language="en",
    )
    db_session.add(p1)
    db_session.flush()

    t1 = TreatmentRecord(
        patient_id=p1.id,
        illness_id="ILL_FEVER_001",
        illness_name="Fever & Viral Infection",
        symptoms="Fever, Body pain, Weakness",
        diagnosis="Acute Viral Syndrome",
        treatment="Paracetamol 650mg, ORS, Bed rest",
        visit_date="12 Aug 2026",
    )
    db_session.add(t1)
    db_session.commit()

    # Perform lookup
    res = client.post("/api/patients/lookup", json={"patient_id": "1000000001"})
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["patient"]["name"] == "Rahul Kumar"
    assert data["patient"]["age"] == 42
    assert data["treatment_records_count"] == 1

    # Fetch treatment history
    treatments_res = client.get(f"/api/patients/{p1.patient_id}/treatments")
    assert treatments_res.status_code == 200
    treatments = treatments_res.json()
    assert len(treatments) == 1
    assert treatments[0]["illness_name"] == "Fever & Viral Infection"
    assert treatments[0]["symptoms"] == "Fever, Body pain, Weakness"


def test_kiosk_lookup_existing_patient_without_history(client, db_session):
    p2 = Patient(
        patient_id="1000000002",
        name="Priya Sharma",
        phone="9876501234",
        age=30,
        gender="Female",
        preferred_language="hi",
    )
    db_session.add(p2)
    db_session.commit()

    res = client.post("/api/patients/lookup", json={"patient_id": "1000000002"})
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is True
    assert data["patient"]["name"] == "Priya Sharma"
    assert data["treatment_records_count"] == 0

    treatments_res = client.get(f"/api/patients/{p2.patient_id}/treatments")
    assert treatments_res.status_code == 200
    assert len(treatments_res.json()) == 0


def test_kiosk_lookup_unknown_patient_triggers_new_registration(client, db_session):
    res = client.post("/api/patients/lookup", json={"patient_id": "9999999999"})
    assert res.status_code == 200
    data = res.json()
    assert data["found"] is False
    assert data["patient"] is None

    # Register new patient
    new_patient_res = client.post("/api/patients", json={
        "patient_id": "9999999999",
        "name": "Amit Patel",
        "phone": "9811223344",
        "age": 28,
        "gender": "Male",
        "preferred_language": "hi",
    })
    assert new_patient_res.status_code == 200
    new_patient = new_patient_res.json()
    assert new_patient["patient_id"] == "9999999999"
    assert new_patient["name"] == "Amit Patel"

    # Verify lookup now finds the newly registered patient
    lookup_again = client.post("/api/patients/lookup", json={"patient_id": "9999999999"})
    assert lookup_again.json()["found"] is True
    assert lookup_again.json()["treatment_records_count"] == 0


def test_kiosk_start_encounter_with_same_illness(client, db_session):
    p = Patient(
        patient_id="1000000001",
        name="Rahul Kumar",
        phone="9876543210",
        age=42,
        gender="Male",
    )
    db_session.add(p)
    db_session.commit()

    # Create encounter linking previous illness
    enc_res = client.post("/api/encounters", json={
        "patient_id": p.id,
        "mode": "general",
        "previous_illness_id": "ILL_FEVER_001",
    })
    assert enc_res.status_code == 200
    enc = enc_res.json()
    assert enc["previous_illness_id"] == "ILL_FEVER_001"
    assert enc["status"] == "in_progress"
