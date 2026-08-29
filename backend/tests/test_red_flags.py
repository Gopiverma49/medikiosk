def _make_encounter(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    return client.post("/api/encounters", json={"patient_id": patient["id"]}).json()


def test_chest_pain_rule_fires_with_associated_symptoms(client):
    enc = _make_encounter(client)
    for concept, value in [("chest_pain", True), ("dyspnea", True), ("radiation_to_arm", True), ("sweating", True)]:
        client.post("/api/history/answer", json={
            "encounter_id": enc["id"], "question_concept": concept,
            "raw_answer": value, "certainty": "confirmed",
        })
    resp = client.post(f"/api/triage/evaluate?encounter_id={enc['id']}")
    events = resp.json()["events"]
    assert any(e["rule_id"] == "RF_CHEST_001" for e in events)


def test_chest_pain_rule_does_not_fire_without_associated_symptoms(client):
    enc = _make_encounter(client)
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "chest_pain",
        "raw_answer": True, "certainty": "confirmed",
    })
    resp = client.post(f"/api/triage/evaluate?encounter_id={enc['id']}")
    events = resp.json()["events"]
    assert not any(e["rule_id"] == "RF_CHEST_001" for e in events)


def test_animal_bite_rule_fires_with_broken_skin(client):
    enc = _make_encounter(client)
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "animal_exposure_broken_skin",
        "raw_answer": True, "certainty": "confirmed",
    })
    resp = client.post(f"/api/triage/evaluate?encounter_id={enc['id']}")
    events = resp.json()["events"]
    assert any(e["rule_id"] == "RF_ANIMAL_004" for e in events)


def test_active_bleeding_rule_fires(client):
    enc = _make_encounter(client)
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "active_bleeding",
        "raw_answer": True, "certainty": "confirmed",
    })
    resp = client.post(f"/api/triage/evaluate?encounter_id={enc['id']}")
    events = resp.json()["events"]
    assert any(e["rule_id"] == "RF_BLEED_005" for e in events)


def test_thunderclap_headache_rule_fires(client):
    enc = _make_encounter(client)
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "headache_thunderclap",
        "raw_answer": True, "certainty": "confirmed",
    })
    resp = client.post(f"/api/triage/evaluate?encounter_id={enc['id']}")
    events = resp.json()["events"]
    assert any(e["rule_id"] == "RF_HEADACHE_006" for e in events)

