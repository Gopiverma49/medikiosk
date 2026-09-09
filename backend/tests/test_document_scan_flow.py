import io
from app.services.document_extractor import extract_clinical_document


def test_clinical_document_extractor_indian_prescription():
    sample_text = """
    CITY CLINIC & DIAGNOSTICS
    Dr. Rajesh Sharma, MBBS, MD (General Medicine)
    Reg No: MCI-12345
    Date: 14/08/2026
    
    Patient: Ramesh Gupta, 48M
    C/O: Severe fever and body ache for 3 days
    O/E: BP: 130/85 mmHg, Pulse: 88 bpm, Temp: 101.4 F, SpO2: 98%
    Chest: Clear, P/A: Soft
    
    Diagnosis: Acute Viral Fever with Bronchitis
    Known PMH: Type 2 Diabetes Mellitus
    Allergies: Penicillin
    
    Rx:
    1. Tab. Dolo 650mg 1 tablet TDS x 3 days PC (SOS for fever > 100 F)
    2. Tab. Augmentin 625mg BD x 5 days after food
    3. Tab. Pantocid 40mg OD x 7 days AC empty stomach
    4. Syr. Ascoril 10ml TDS x 5 days
    
    Advice:
    - Drink plenty of warm fluids
    - Complete bed rest
    
    Follow-up: Review after 5 days or SOS if breathing difficulty occurs.
    """
    ext = extract_clinical_document(sample_text, doc_type="prescription")

    # Date
    assert ext.report_date == "14/08/2026"
    
    # Reason for visit
    assert ext.reason_for_visit is not None
    assert "fever" in ext.reason_for_visit.lower()

    # Vitals
    assert ext.vitals_and_examination is not None
    assert "130/85" in ext.vitals_and_examination.blood_pressure
    assert "88" in ext.vitals_and_examination.pulse_rate
    assert "101.4" in ext.vitals_and_examination.temperature
    assert "98%" in ext.vitals_and_examination.spo2

    # Diagnosis
    assert len(ext.diagnosis) > 0
    assert any("viral" in d.lower() or "bronchitis" in d.lower() or "diabetes" in d.lower() for d in ext.diagnosis)

    # Allergies & PMH
    assert "Penicillin" in ext.allergies
    assert any("Diabetes" in p for p in ext.past_medical_history)

    # Medicines with accurate Indian brand names & frequencies
    med_names = [m.name.lower() for m in ext.medicines]
    assert any("dolo" in n or "paracetamol" in n for n in med_names)
    assert any("augmentin" in n for n in med_names)
    assert any("pantocid" in n for n in med_names)

    dolo_med = next(m for m in ext.medicines if "dolo" in m.name.lower())
    assert dolo_med.strength == "650mg"
    assert "TDS" in dolo_med.frequency

    pantocid_med = next(m for m in ext.medicines if "pantocid" in m.name.lower())
    assert pantocid_med.strength == "40mg"
    assert "OD" in pantocid_med.frequency

    # Follow-up
    assert ext.follow_up is not None
    assert "5 days" in ext.follow_up.date_or_duration

    # Timeline events
    assert len(ext.timeline_events) > 0


def test_clinical_document_extractor_lab_report():
    lab_text = """
    APEX PATHOLOGY LABORATORY
    Date: 20/08/2026
    Test Report: Comprehensive Metabolic Profile
    
    HbA1c: 8.4 % (Ref: 4.0 - 5.6)
    Fasting Blood Sugar: 168 mg/dL (Ref: 70 - 99)
    Serum Creatinine: 1.1 mg/dL (Ref: 0.6 - 1.2)
    Total Cholesterol: 224 mg/dL (Ref: < 200)
    Hemoglobin: 13.8 g/dL (Ref: 12.0 - 16.0)
    Platelet Count: 240000 cells/cu mm (Ref: 150,000 - 450,000)
    
    Impression: Poor glycemic control with hypercholesterolemia.
    """
    ext = extract_clinical_document(lab_text, doc_type="lab_report")

    assert ext.report_date == "20/08/2026"
    assert len(ext.tests) >= 4

    hba1c_test = next(t for t in ext.tests if t.name == "HbA1c")
    assert hba1c_test.value == "8.4"
    assert hba1c_test.unit == "%"
    assert hba1c_test.flag == "High"

    fbs_test = next(t for t in ext.tests if "Fasting Blood Sugar" in t.name)
    assert fbs_test.value == "168"
    assert fbs_test.flag == "High"


def test_scan_upload_confirm_and_file_stream_flow(client):
    # 1. Create Patient & Encounter
    p_res = client.post("/api/patients", json={"name": "Suresh Kumar", "patient_id": "1000000099"}).json()
    enc_res = client.post("/api/encounters", json={"patient_id": p_res["id"]}).json()
    encounter_id = enc_res["id"]

    # 2. Upload Multi-Page Scanned Report
    fake_img1 = io.BytesIO(b"fake image page 1 content")
    fake_img2 = io.BytesIO(b"fake image page 2 content")
    files = [
        ("files", ("page1.jpg", fake_img1, "image/jpeg")),
        ("files", ("page2.jpg", fake_img2, "image/jpeg")),
    ]
    data = {
        "encounter_id": encounter_id,
        "doc_type": "prescription",
        "patient_id": p_res["id"],
    }
    scan_res = client.post("/api/documents/scan-upload", data=data, files=files)
    assert scan_res.status_code == 200
    doc_out = scan_res.json()
    doc_id = doc_out["id"]

    assert doc_out["status"] == "review_required"
    assert len(doc_out["pages"]) == 2
    assert doc_out["file_url"] is not None
    assert len(doc_out["page_urls"]) == 2

    # 3. Stream File Page
    file_res = client.get(f"/api/documents/{doc_id}/file?page=0")
    assert file_res.status_code == 200
    assert file_res.content == b"fake image page 1 content"

    file_page2_res = client.get(f"/api/documents/{doc_id}/file?page=1")
    assert file_page2_res.status_code == 200
    assert file_page2_res.content == b"fake image page 2 content"

    # 4. Review & Confirm Document
    confirmed_data = doc_out["extracted_data"]
    # Simulate user adding or modifying a medicine during review
    confirmed_data["medicines"] = [
        {
            "name": "Metformin",
            "strength": "500 mg",
            "dosage": "1 tab",
            "route": "Oral",
            "frequency": "BD (Twice daily)",
            "timing": "After meals",
            "duration": "30 days",
            "instructions": "Take with water",
        }
    ]
    confirmed_data["diagnosis"] = ["Type 2 Diabetes Mellitus"]

    confirm_res = client.post(f"/api/documents/{doc_id}/confirm", json={
        "extracted_data": confirmed_data,
        "confirmed_by": "Patient (Self)",
    })
    assert confirm_res.status_code == 200
    confirmed_doc = confirm_res.json()
    assert confirmed_doc["status"] == "confirmed"

    # 5. Verify Clinical Facts were Created
    facts_res = client.get(f"/api/clinical-facts/{encounter_id}")
    assert facts_res.status_code == 200
    facts = facts_res.json()
    med_fact = next((f for f in facts if f["concept"] == "medication"), None)
    assert med_fact is not None
    assert med_fact["source"] == "UPLOADED_DOCUMENT"
    assert "Metformin" in str(med_fact["value"])

    # 6. Verify Document Listing for Encounter and Patient
    enc_docs_res = client.get(f"/api/documents/{encounter_id}/list")
    assert enc_docs_res.status_code == 200
    assert len(enc_docs_res.json()) >= 1

    patient_docs_res = client.get(f"/api/documents/patient/{p_res['id']}/list")
    assert patient_docs_res.status_code == 200
    assert len(patient_docs_res.json()) >= 1
