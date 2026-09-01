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


def test_patient_treatment_records_with_medicines_and_followup(client):
    patient = client.post("/api/patients", json={"name": "Kavita Devi", "age": 35, "gender": "Female"}).json()
    
    # 1. First visit for stomach problem
    enc1 = client.post("/api/encounters", json={"patient_id": patient["id"], "mode": "general"}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc1["id"], "question_concept": "chief_complaint", "raw_answer": "Stomach Problem", "certainty": "confirmed"
    })
    client.post("/api/history/answer", json={
        "encounter_id": enc1["id"], "question_concept": "medication", "raw_answer": "Pantoprazole 40mg", "certainty": "confirmed"
    })
    client.post(f"/api/summaries/generate?encounter_id={enc1['id']}")
    client.post(f"/api/patients/{patient['id']}/prescriptions", json={
        "encounter_id": enc1["id"],
        "diagnosis": "Stomach Problem",
        "doctor_name": "Dr. Verma",
        "prescribed_medicines": [
            {"name": "Pantoprazole (Pan 40)", "dosage": "40 mg", "frequency": "1-0-0", "duration": "7 days", "instructions": "Before food"}
        ]
    })

    # 2. Second visit for same illness (Follow-up)
    enc2 = client.post("/api/encounters", json={"patient_id": patient["id"], "mode": "general", "previous_illness_id": f"VISIT_{enc1['id'][:8].upper()}"}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc2["id"], "question_concept": "chief_complaint", "raw_answer": "Stomach Problem", "certainty": "confirmed"
    })
    client.post(f"/api/summaries/generate?encounter_id={enc2['id']}")

    # 3. Check combined treatments
    treatments = client.get(f"/api/patients/{patient['id']}/treatments").json()
    assert len(treatments) >= 2
    
    # Check that medicines are returned
    med_rec = next(t for t in treatments if t.get("prescribed_medicines"))
    assert len(med_rec["prescribed_medicines"]) >= 1
    assert med_rec["prescribed_medicines"][0]["name"] == "Pantoprazole (Pan 40)"
    
    # Check that follow-up is detected and primary reason is set
    fu_rec = next(t for t in treatments if t.get("is_followup"))
    assert fu_rec["is_followup"] is True
    assert fu_rec.get("primary_reason") is not None
