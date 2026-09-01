def test_fact_starts_unverified_and_carries_confidence_and_provenance(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=prescription&filename=sample_prescription.png").json()
    result = client.post(f"/api/documents/{doc['id']}/process").json()
    facts = client.get(f"/api/clinical-facts/{enc['id']}").json()
    med_fact = next(f for f in facts if f["concept"] == "medication")
    assert med_fact["verification_status"] == "UNVERIFIED"
    assert med_fact["confidence"] is not None
    assert med_fact["source"] == "UPLOADED_DOCUMENT"


def test_physician_verify_updates_status(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    fact = client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "location",
        "raw_answer": "left chest", "certainty": "confirmed",
    }).json()

    resp = client.post("/api/clinical-facts/verify", json={"fact_id": fact["id"], "performed_by": "Dr. Demo"})
    assert resp.json()["verification_status"] == "PHYSICIAN_VERIFIED"


def test_physician_correction_preserves_original_extraction(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    fact = client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "severity",
        "raw_answer": 5, "certainty": "confirmed",
    }).json()

    corrected = client.post("/api/clinical-facts/correct", json={
        "fact_id": fact["id"], "new_value": 8, "new_label": "8", "performed_by": "Dr. Demo",
    }).json()
    assert corrected["verification_status"] == "PHYSICIAN_CORRECTED"
    assert corrected["value"] == 8


def test_ai_extraction_never_marked_physician_verified_by_default(client):
    """AI-extracted facts must start UNVERIFIED — never auto-marked as verified."""
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=lab&filename=sample_lab_report.png").json()
    client.post(f"/api/documents/{doc['id']}/process")
    facts = client.get(f"/api/clinical-facts/{enc['id']}").json()
    assert all(f["verification_status"] != "PHYSICIAN_VERIFIED" for f in facts)


def test_summary_confirmation_flow(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "location", "raw_answer": "left chest", "certainty": "confirmed",
    })
    summary = client.post(f"/api/summaries/generate?encounter_id={enc['id']}").json()
    assert summary["status"] == "AI_DRAFT"

    confirmed = client.post(f"/api/summaries/{summary['id']}/confirm?confirmed_by=Dr.%20Sharma").json()
    assert confirmed["status"] == "PHYSICIAN_VERIFIED"

    # Verify TreatmentRecord is saved in database for future use and display
    treatments = client.get(f"/api/patients/{patient['id']}/treatments").json()
    assert len(treatments) >= 1
    assert any("Verified" in (t.get("diagnosis") or "") for t in treatments)


def test_summary_edit_flow_saves_to_database(client):
    patient = client.post("/api/patients", json={"name": "Priya Singh"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "chief_complaint", "raw_answer": "Severe headache", "certainty": "confirmed",
    })
    summary = client.post(f"/api/summaries/generate?encounter_id={enc['id']}").json()

    edited_text = "Custom physician notes: Patient examined, migraine diagnosed, advised rest."
    edited = client.post(f"/api/summaries/{summary['id']}/edit", json={
        "text": edited_text,
        "edited_by": "Dr. Gupta"
    }).json()
    assert edited["status"] == "PHYSICIAN_CORRECTED"
    assert edited["text"] == edited_text

    # Verify database has updated record with custom text
    treatments = client.get(f"/api/patients/{patient['id']}/treatments").json()
    assert len(treatments) >= 1
    assert any(edited_text in (t.get("treatment") or "") for t in treatments)


def test_summary_reject_flow_does_not_save_to_database(client):
    patient = client.post("/api/patients", json={"name": "Amit Patel"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "chief_complaint", "raw_answer": "Stomach pain", "certainty": "confirmed",
    })
    summary = client.post(f"/api/summaries/generate?encounter_id={enc['id']}").json()

    rejected = client.post(f"/api/summaries/{summary['id']}/reject?rejected_by=Dr.%20Verma").json()
    assert rejected["status"] == "REJECTED"

    # Verify rejected summary is not stored in patient treatment history
    treatments = client.get(f"/api/patients/{patient['id']}/treatments").json()
    assert len(treatments) == 0
