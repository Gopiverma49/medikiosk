def _encounter_with_no_meds_report(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "medication_reported_none",
        "raw_answer": True, "certainty": "confirmed",
    })
    return enc


def test_medication_contradiction_detected_against_uploaded_document(client, monkeypatch):
    enc = _encounter_with_no_meds_report(client)

    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=prescription&filename=sample_prescription.png").json()
    result = client.post(f"/api/documents/{doc['id']}/process").json()
    assert result["ok"] is True
    assert len(result["facts_extracted"]) >= 1

    contradictions = client.get(f"/api/contradictions/{enc['id']}").json()
    assert any(c["type"] == "MEDICATION_CONFLICT" for c in contradictions)
    assert all(c["status"] == "UNRESOLVED" for c in contradictions)  # never auto-resolved


def test_contradiction_resolution_requires_explicit_physician_decision(client):
    enc = _encounter_with_no_meds_report(client)
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=prescription&filename=sample_prescription.png").json()
    client.post(f"/api/documents/{doc['id']}/process")

    contradictions = client.get(f"/api/contradictions/{enc['id']}").json()
    conflict = next(c for c in contradictions if c["type"] == "MEDICATION_CONFLICT")

    resolved = client.post(f"/api/contradictions/{conflict['id']}/resolve", json={
        "decision": "Confirmed: patient is taking Metformin", "resolved_by": "Dr. (demo) Physician",
    })
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"


def test_temporal_contradiction_detected(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "symptom_onset",
        "raw_answer": "today", "certainty": "confirmed",
    })
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "symptom_onset",
        "raw_answer": "3_weeks_ago", "certainty": "confirmed",
    })
    contradictions = client.post(f"/api/contradictions/detect?encounter_id={enc['id']}").json()
    assert any(c["type"] == "TEMPORAL_CONFLICT" for c in contradictions)
