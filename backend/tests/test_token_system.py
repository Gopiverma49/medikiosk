from app.models import Patient


def test_token_sequential_generation(client, db_session):
    p1 = Patient(patient_id="8000000001", name="Patient One", phone="9000000001", age=25, gender="Female")
    p2 = Patient(patient_id="8000000002", name="Patient Two", phone="9000000002", age=30, gender="Male")
    db_session.add_all([p1, p2])
    db_session.commit()

    enc1 = client.post("/api/encounters", json={"patient_id": p1.patient_id}).json()
    enc2 = client.post("/api/encounters", json={"patient_id": p2.patient_id}).json()

    tok1_res = client.post("/api/tokens/generate", json={"patient_id": p1.patient_id, "encounter_id": enc1["id"]})
    assert tok1_res.status_code == 200
    tok1 = tok1_res.json()
    assert tok1["token_number"] == "1"

    tok2_res = client.post("/api/tokens/generate", json={"patient_id": p2.patient_id, "encounter_id": enc2["id"]})
    assert tok2_res.status_code == 200
    tok2 = tok2_res.json()
    assert tok2["token_number"] == "2"


def test_same_patient_returning_gets_new_token(client, db_session):
    patient = Patient(patient_id="8000000003", name="Returning Patient", phone="9000000003", age=28, gender="Female")
    db_session.add(patient)
    db_session.commit()

    # First visit
    enc1 = client.post("/api/encounters", json={"patient_id": patient.patient_id}).json()
    tok1 = client.post("/api/tokens/generate", json={"patient_id": patient.patient_id, "encounter_id": enc1["id"]}).json()
    assert tok1["token_number"] == "1"

    # Complete first token consultation
    client.post(f"/api/tokens/{tok1['id']}/complete")

    # Second visit (same patient comes again)
    enc2 = client.post("/api/encounters", json={"patient_id": patient.patient_id}).json()
    tok2 = client.post("/api/tokens/generate", json={"patient_id": patient.patient_id, "encounter_id": enc2["id"]}).json()
    assert tok2["token_number"] == "2"
    assert tok2["id"] != tok1["id"]

    # Third visit even without prior completion (e.g. fresh kiosk intake)
    enc3 = client.post("/api/encounters", json={"patient_id": patient.patient_id}).json()
    tok3 = client.post("/api/tokens/generate", json={"patient_id": patient.patient_id, "encounter_id": enc3["id"]}).json()
    assert tok3["token_number"] == "3"
    assert tok3["id"] != tok2["id"]


def test_login_invalid_credentials_detail(client):
    resp = client.post("/api/auth/login", json={"username": "wrong_user", "password": "wrong_password"})
    assert resp.status_code == 401
    data = resp.json()
    assert data["detail"] == "Invalid username or password"


def test_save_and_retrieve_prescription(client, db_session):
    p = Patient(patient_id="8000000004", name="Prescription Test Patient", phone="9000000004", age=35, gender="Male")
    db_session.add(p)
    db_session.commit()

    enc = client.post("/api/encounters", json={"patient_id": p.patient_id}).json()

    rx_payload = {
        "patient_id": p.id,
        "encounter_id": enc["id"],
        "diagnosis": "Acute Bronchitis",
        "doctor_notes": "Advised steam inhalation and rest.",
        "doctor_name": "Dr. Verma",
        "prescribed_medicines": [
            {
                "name": "Amoxicillin",
                "dosage": "500 mg",
                "frequency": "1-0-1 (Twice daily)",
                "duration": "5 days",
                "instructions": "After meals"
            },
            {
                "name": "Ascoril D Cough Syrup",
                "dosage": "10 ml",
                "frequency": "1-1-1 (Thrice daily)",
                "duration": "5 days",
                "instructions": "After food"
            }
        ]
    }

    rx_res = client.post(f"/api/patients/{p.id}/prescriptions", json=rx_payload)
    assert rx_res.status_code == 200
    saved_rx = rx_res.json()
    assert saved_rx["diagnosis"] == "Acute Bronchitis"
    assert saved_rx["doctor_name"] == "Dr. Verma"
    assert len(saved_rx["prescribed_medicines"]) == 2
    assert saved_rx["prescribed_medicines"][0]["name"] == "Amoxicillin"
    assert saved_rx["prescribed_medicines"][0]["dosage"] == "500 mg"
    assert saved_rx["prescribed_medicines"][0]["frequency"] == "1-0-1 (Twice daily)"

    # Retrieve patient treatments
    treatments_res = client.get(f"/api/patients/{p.patient_id}/treatments")
    assert treatments_res.status_code == 200
    treatments = treatments_res.json()
    assert len(treatments) >= 1
    found_tx = next((t for t in treatments if t["diagnosis"] == "Acute Bronchitis"), None)
    assert found_tx is not None
    assert len(found_tx["prescribed_medicines"]) == 2
    assert found_tx["doctor_notes"] == "Advised steam inhalation and rest."
    assert found_tx["doctor_name"] == "Dr. Verma"

