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


def test_medicine_extraction_indian_numeric_frequencies_and_compound_names():
    """
    Test extraction of:
    - Indian numeric split dosages: 1-0-1, 1-0-0, 0-0-1, 1-1-1, 1/2-0-1/2
    - OCR typos in numeric frequencies: 1-O-1 (letter O), 1 - 0 - 1 (spaces), 1/0/1 (slashes)
    - Compound multi-word brand names: Montair LC, Pan D, Telma AM, Chymoral Forte, Shelcal 500
    - Strengths without explicit 'mg' unit: Dolo 650, Pantocid 40
    - OCR prefix typos: Tah., 1ab., Cpa., Syp.
    - Clinical duration fractions: x 5/7 (5 days), x 2/52 (2 weeks)
    """
    sample_prescription = """
    SHREE KRISHNA CLINIC
    Date: 05/09/2026
    Patient: Meena Devi, 52F
    C/O: Joint pain and acid reflux for 1 week
    
    Rx:
    1. Tah. Montair LC 1-0-1 x 10 days After Food
    2. 1ab. Pan-D 40 1-0-0 AC x 14/7
    3. Tab. Telma AM 40/5 1 - 0 - 0 Before Food x 2/52
    4. Cpa. Becosules Z 0-0-1 At Bedtime x 30 days
    5. Tab. Dolo 650 1-O-1 x 3/7 (SOS for pain)
    6. Syp. Ascoril LS 5ml TDS x 5 days
    7. 1ab. Chymoral Forte 1-0-1 PC x 5 days
    8. Tab. Shelcal 500 1-0-0 after meals x 1 month
    9. Tab. Nebivolol 5mg 1-0-0 x 30 days
    """
    ext = extract_clinical_document(sample_prescription, doc_type="prescription")

    assert len(ext.medicines) >= 8
    med_by_name = {m.name.lower(): m for m in ext.medicines}

    # 1. Montair LC with Tah. prefix and 1-0-1
    assert any("montair" in k for k in med_by_name)
    montair = next(m for k, m in med_by_name.items() if "montair" in k)
    assert "1-0-1" in montair.frequency
    assert "Twice daily" in montair.frequency
    assert montair.duration == "10 days"
    assert "PC" in (montair.timing or "") or "after" in (montair.timing or "").lower()

    # 2. Pan-D with 1ab. prefix, 1-0-0 frequency, and x 14/7 clinical duration
    assert any("pan" in k for k in med_by_name)
    pan = next(m for k, m in med_by_name.items() if "pan" in k)
    assert "1-0-0" in pan.frequency
    assert "Once daily" in pan.frequency
    assert pan.duration == "14 days"
    assert "AC" in (pan.timing or "")

    # 3. Telma AM with combination strength 40/5, spaced dashes 1 - 0 - 0, and x 2/52
    assert any("telma" in k for k in med_by_name)
    telma = next(m for k, m in med_by_name.items() if "telma" in k)
    assert "40/5" in (telma.strength or "")
    assert "1-0-0" in telma.frequency
    assert telma.duration == "2 weeks"

    # 4. Becosules Z with Cpa. prefix, 0-0-1 frequency (Night)
    assert any("becosules" in k for k in med_by_name)
    bec = next(m for k, m in med_by_name.items() if "becosules" in k)
    assert "0-0-1" in bec.frequency
    assert "Night" in bec.frequency or "Bedtime" in bec.frequency

    # 5. Dolo 650 with OCR letter O in 1-O-1 and x 3/7
    assert any("dolo" in k for k in med_by_name)
    dolo = next(m for k, m in med_by_name.items() if "dolo" in k)
    assert "650" in (dolo.strength or "")
    assert "1-0-1" in dolo.frequency
    assert dolo.duration == "3 days"

    # 6. Ascoril LS syrup with 5ml dosage
    assert any("ascoril" in k for k in med_by_name)
    ascoril = next(m for k, m in med_by_name.items() if "ascoril" in k)
    assert "5ml" in (ascoril.dosage or "")
    assert "TDS" in ascoril.frequency

    # 7. Chymoral Forte with 1-0-1
    assert any("chymoral" in k for k in med_by_name)
    chym = next(m for k, m in med_by_name.items() if "chymoral" in k)
    assert "1-0-1" in chym.frequency

    # 8. Shelcal 500 with 1-0-0
    assert any("shelcal" in k for k in med_by_name)
    shel = next(m for k, m in med_by_name.items() if "shelcal" in k)
    assert "1-0-0" in shel.frequency

    # 9. Unlisted drug Nebivolol detected via Tab. prefix and 1-0-0
    assert any("nebivolol" in k for k in med_by_name)
    nebi = next(m for k, m in med_by_name.items() if "nebivolol" in k)
    assert "5mg" in (nebi.strength or "")
    assert "1-0-0" in nebi.frequency


def test_medicine_extraction_multiline_and_abbreviations():
    """Test multi-line prescription format and dotted abbreviations (O.D., B.D., T.D.S., H.S., S.O.S.)."""
    multiline_text = """
    Date: 01/09/2026
    Rx:
    1. Tab. Pantocid 40
       1 tab O.D. before food x 14 days
    2. Tab. Augmentin 625 Duo
       1 tab B.D. after meals x 5 days
    3. Tab. Calpol 500
       1 tab S.O.S. for fever
    4. Cap. Omeprazole 20mg
       1 cap H.S. at bedtime x 7 days
    """
    ext = extract_clinical_document(multiline_text, doc_type="prescription")
    assert len(ext.medicines) == 4

    panto = next(m for m in ext.medicines if "pantocid" in m.name.lower())
    assert "40" in (panto.strength or "")
    assert "OD" in panto.frequency
    assert "AC" in (panto.timing or "")
    assert panto.duration == "14 days"

    aug = next(m for m in ext.medicines if "augmentin" in m.name.lower())
    assert "BD" in aug.frequency
    assert aug.duration == "5 days"

    cal = next(m for m in ext.medicines if "calpol" in m.name.lower())
    assert "SOS" in cal.frequency

    omep = next(m for m in ext.medicines if "omeprazole" in m.name.lower())
    assert "HS" in omep.frequency
    assert omep.duration == "7 days"


def test_medicine_extraction_routes_and_fractional_doses():
    """Test inhalation, topical, drops, fractional doses (1/2-0-1/2), and hourly frequency."""
    text = """
    Date: 08/09/2026
    Rx:
    1. Tab. Zapiz 0.5 0-0-1/2 at bedtime x 15 days
    2. Foracort 200 Inhaler 2 puffs BD x 1 month
    3. Eye Drops Ciplox 2 drops TDS x 5 days
    4. Tab. Paracetamol 650mg Every 6 hours x 3 days
    5. Tab. Thyronorm 50mcg 1-0-0 BBF x 30 days
    """
    ext = extract_clinical_document(text, doc_type="prescription")
    assert len(ext.medicines) == 5

    zapiz = next(m for m in ext.medicines if "zapiz" in m.name.lower())
    assert "0-0-1/2" in zapiz.frequency
    assert "Half tablet" in zapiz.frequency

    fora = next(m for m in ext.medicines if "foracort" in m.name.lower())
    assert fora.route == "Inhalation"
    assert "2 puffs" in (fora.dosage or "")

    ciplox = next(m for m in ext.medicines if "ciplox" in m.name.lower())
    assert "Drops" in ciplox.route
    assert "2 drops" in (ciplox.dosage or "")

    pcm = next(m for m in ext.medicines if "paracetamol" in m.name.lower())
    assert "Every 6 hours" in pcm.frequency
    assert pcm.duration == "3 days"

    thyro = next(m for m in ext.medicines if "thyronorm" in m.name.lower())
    assert "50mcg" in (thyro.strength or "")
    assert "1-0-0" in thyro.frequency
    assert "AC" in (thyro.timing or "") or "breakfast" in (thyro.timing or "").lower()


def test_user_scanned_candid_prescription_with_date_line():
    """
    Test user's exact scanned document:
    File Edit View H1
    2th december
    candid 20 MG
    after each meal

    Verifies:
    1. Report date is extracted as '02 Dec 2026' (from '2th december').
    2. '2th december' is NEVER extracted as a false medicine ('Th December').
    3. 'Candid' is extracted with strength '20 MG', timing 'After food / meals (PC)',
       and frequency 'After each meal'.
    """
    user_scan_text = """
    File Edit View H1
    2th december
    candid 20 MG
    after each meal
    """
    ext = extract_clinical_document(user_scan_text, doc_type="prescription")

    # Date check
    assert ext.report_date is not None
    assert "Dec" in ext.report_date or "12" in ext.report_date

    # Medicines check
    assert len(ext.medicines) == 1
    med = ext.medicines[0]

    # Name must be Candid, NEVER Th December
    assert med.name.lower() == "candid"
    assert "december" not in med.name.lower()
    assert "th" not in med.name.lower().split()

    # Strength check
    assert "20" in (med.strength or "")

    # Timing & frequency check
    assert "after" in (med.timing or "").lower() or "pc" in (med.timing or "").lower()
    assert "after each meal" in (med.frequency or "").lower()


def test_master_med_names_recognition():
    """Verify that multi-word brands, oncology/critical-care, and strength-variants from MASTER_MED_NAMES are accurately extracted."""
    from app.services.document_extractor import MASTER_MED_NAMES, COMMON_MED_NAMES

    assert len(MASTER_MED_NAMES) >= 500
    assert COMMON_MED_NAMES == MASTER_MED_NAMES

    rx_text = """
    Rx:
    1. Piperacillin Tazobactam 4.5g IV TDS
    2. Meropenem 1g IV BD
    3. Ecosprin Gold 10 1-0-0
    4. Foracort 200 1 puff BD
    5. Shelcal 500 1 tab OD PC
    6. Montair-LC 1 tab HS
    """
    ext = extract_clinical_document(rx_text, doc_type="prescription")
    names = [m.name.lower() for m in ext.medicines]

    assert any("piperacillin tazobactam" in n for n in names)
    assert any("meropenem" in n for n in names)
    assert any("ecosprin gold" in n for n in names)
    assert any("foracort" in n for n in names)
    assert any("shelcal" in n for n in names)
    assert any("montair-lc" in n or "montair lc" in n for n in names)




