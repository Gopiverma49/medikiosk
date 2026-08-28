def test_ocr_failure_falls_back_gracefully(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=prescription&filename=x.png").json()

    client.post("/api/admin/ai-status/ocr/toggle")  # simulate OCR outage
    result = client.post(f"/api/documents/{doc['id']}/process").json()
    assert result["ok"] is False
    assert "retake_photo" in result["fallback"]
    client.post("/api/admin/ai-status/ocr/toggle")  # restore


def test_asr_failure_falls_back_to_text_input(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()

    client.post("/api/admin/ai-status/asr/toggle")
    result = client.post(f"/api/clinical-facts/extract?encounter_id={enc['id']}&language=kn").json()
    assert result["ok"] is False
    assert result["fallback"] == "type_or_select"
    client.post("/api/admin/ai-status/asr/toggle")


def test_llm_failure_still_produces_a_summary_via_rule_based_fallback(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "location", "raw_answer": "left chest", "certainty": "confirmed",
    })

    client.post("/api/admin/ai-status/llm/toggle")
    summary = client.post(f"/api/summaries/generate?encounter_id={enc['id']}").json()
    # The application must never crash because a provider is unavailable —
    # a rule-based template summary is produced regardless.
    assert summary["text"]
    assert "left chest" in summary["text"] or "location" in summary["text"].lower()
    client.post("/api/admin/ai-status/llm/toggle")


def test_document_processing_continues_without_document_option_exists(client):
    """Acceptance criteria: app must remain usable when OCR fails — verified via
    the fallback options returned, matching the kiosk's Retake/Enter/Continue UI."""
    patient = client.post("/api/patients", json={"name": "Ravi Kumar"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=lab&filename=x.png").json()
    client.post("/api/admin/ai-status/ocr/toggle")
    result = client.post(f"/api/documents/{doc['id']}/process").json()
    assert "continue_without_document" in result["fallback"]
    client.post("/api/admin/ai-status/ocr/toggle")
