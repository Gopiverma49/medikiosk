def test_unknown_answer_stays_unknown_not_no(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()

    resp = client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "symptom_onset",
        "raw_answer": None, "certainty": "unknown", "source_language": "en",
    })
    fact = resp.json()
    assert fact["certainty"] == "unknown"
    assert fact["value"] is None
    assert fact["verification_status"] == "UNKNOWN"
    # Critical assertion: unknown must never silently become a negative "No" answer.
    assert fact["value"] is not False


def test_known_no_answer_is_preserved_as_false_not_unknown(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()

    resp = client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "dyspnea",
        "raw_answer": False, "certainty": "confirmed", "source_language": "en",
    })
    fact = resp.json()
    assert fact["certainty"] == "confirmed"
    assert fact["value"] is False
    assert fact["verification_status"] == "PATIENT_CONFIRMED"
