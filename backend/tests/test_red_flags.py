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


def test_rule_configuration_via_admin_endpoints(client):
    payload = {
        "rule_id": "RF_TEST_999", "name": "Test rule", "enabled": True, "priority": "LOW",
        "action": "FLAG_FOR_REVIEW", "conditions": {"all": [{"concept": "fever", "operator": "equals", "value": True}], "any": []},
    }
    created = client.post("/api/red-flags/rules", json=payload)
    assert created.status_code == 200
    assert created.json()["version"] == "1.0"

    test_resp = client.post("/api/red-flags/rules/RF_TEST_999/test", json={"rule_id": "RF_TEST_999", "inputs": {"fever": True}})
    assert test_resp.json()["fires"] is True

    disable_resp = client.post("/api/red-flags/rules/RF_TEST_999/disable")
    assert disable_resp.json()["enabled"] is False
