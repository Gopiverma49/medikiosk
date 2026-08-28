def test_create_patient(client):
    resp = client.post("/api/patients", json={
        "name": "Ravi Kumar", "age": 52, "gender": "Male",
        "preferred_language": "kn", "department": "General Medicine",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Ravi Kumar"
    assert data["is_synthetic"] is True


def test_create_encounter_and_consent(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar", "age": 52, "gender": "Male"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"], "mode": "general"}).json()
    assert enc["status"] == "in_progress"

    consent = client.post("/api/consents", json={"encounter_id": enc["id"], "granted": True})
    assert consent.status_code == 200
    assert consent.json()["granted"] is True


def test_history_answer_creates_fact(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar", "age": 52, "gender": "Male"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()

    resp = client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "location",
        "raw_answer": "left chest", "certainty": "confirmed", "source_language": "kn",
    })
    assert resp.status_code == 200
    fact = resp.json()
    assert fact["concept"] == "location"
    assert fact["value"] == "left chest"
    assert fact["verification_status"] == "PATIENT_CONFIRMED"
