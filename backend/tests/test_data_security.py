from app.services.crypto import (
    encrypt_field, decrypt_field, blind_index, mask_aadhaar_and_pii,
    compute_file_sha256, verify_file_sha256, mask_patient_id
)


def test_aes256_encryption_and_decryption_roundtrip():
    """Verify AES-256 authenticated field encryption properly recovers exact plaintext."""
    original_text = "Ramesh Kumar - Type 2 Diabetes & Hypertension"
    encrypted = encrypt_field(original_text)
    
    assert encrypted is not None
    assert encrypted != original_text
    assert encrypted.startswith("enc:aes256gcm:")
    
    # Decrypt and compare
    decrypted = decrypt_field(encrypted)
    assert decrypted == original_text
    
    # Plaintext fallback for legacy backwards compatibility
    assert decrypt_field("Legacy Unencrypted Name") == "Legacy Unencrypted Name"
    assert decrypt_field(None) is None


def test_blind_indexing_deterministic_search():
    """Verify HMAC-SHA256 blind indexing produces deterministic matches for phone numbers."""
    phone_variations = [
        "9876543210",
        "+91 98765-43210",
        "+919876543210",
        "98765-43210",
    ]
    hashes = [blind_index(p) for p in phone_variations]
    
    # All variations should produce identical normalized search hash
    assert all(h == hashes[0] for h in hashes)
    assert len(hashes[0]) == 64  # SHA-256 hex length
    
    # Different phone produces different hash
    assert blind_index("9123456780") != hashes[0]


def test_aadhaar_pii_redaction():
    """Verify 12-digit Indian Aadhaar numbers are automatically masked per UIDAI regulations."""
    sample_text = "Patient UID: 5432 1098 7654 presented with prescription"
    masked = mask_aadhaar_and_pii(sample_text)
    assert "XXXX XXXX 7654" in masked
    assert "5432 1098 7654" not in masked

    sample_hyphen = "Aadhaar: 2345-6789-0123"
    masked_hyphen = mask_aadhaar_and_pii(sample_hyphen)
    assert "XXXX-XXXX-0123" in masked_hyphen
    assert "2345-6789-0123" not in masked_hyphen


def test_document_sha256_seal_and_tamper_detection(tmp_path):
    """Verify SHA-256 cryptographic seal detects any single-byte tampering on disk."""
    test_file = tmp_path / "scanned_prescription.jpg"
    test_file.write_bytes(b"ORIGINAL_IMAGE_BYTES_FROM_KIOSK_SCANNER")
    
    # Compute original cryptographic seal
    original_seal = compute_file_sha256(str(test_file))
    assert len(original_seal) == 64
    
    # Verify valid file
    is_valid, _ = verify_file_sha256(str(test_file), original_seal)
    assert is_valid is True
    
    # Tamper with 1 byte in the file
    test_file.write_bytes(b"TAMPERED_IMAGE_BYTES_FROM_ATTACKER_HACK")
    
    # Verify tamper detection
    is_tampered, tampered_hash = verify_file_sha256(str(test_file), original_seal)
    assert is_tampered is False
    assert tampered_hash != original_seal


def test_security_status_api_endpoint(client):
    """Verify /api/admin/security/status reports active cryptographic telemetry & DPDP compliance."""
    response = client.get("/api/admin/security/status")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["standards"]["dpdp_act_2023"]["status"] == "COMPLIANT"
    assert data["standards"]["abdm"]["status"] == "READY"
    assert data["controls"]["field_level_encryption"]["active"] is True
    assert data["controls"]["blind_indexing"]["active"] is True
    assert data["controls"]["document_tamper_seal"]["active"] is True


def test_security_inspect_db_api_endpoint(client):
    """Verify /api/admin/security/inspect-db returns simulated stolen DB dump vs decrypted physician view."""
    # Create test patient
    client.post("/api/patients", json={
        "name": "Arjun Sharma",
        "phone": "9988776655",
        "age": 38,
        "gender": "Male",
        "department": "General Medicine"
    })
    
    response = client.get("/api/admin/security/inspect-db?limit=3")
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert len(data["samples"]) > 0
    sample = data["samples"][0]
    # Hacker sees ciphertext
    assert sample["hacker_sees_raw_db"]["is_readable"] is False
    assert "enc:aes256gcm:" in sample["hacker_sees_raw_db"]["name"]
    assert "enc:aes256gcm:" in sample["hacker_sees_raw_db"]["patient_id"]
    assert "enc:aes256gcm:" in sample["hacker_sees_raw_db"]["age"]
    # Authorized doctor sees plaintext
    assert sample["authorized_doctor_sees"]["is_readable"] is True
    assert sample["authorized_doctor_sees"]["age"] == 38


def test_patient_id_and_age_raw_db_encryption(db_session):
    """Verify patient_id and age are stored as AES-256 ciphertext in the raw database."""
    from sqlalchemy import text
    from app.models import Patient

    p = Patient(
        patient_id="1099887766",
        name="Sunita Rao",
        phone="9876543219",
        age=55,
        gender="Female",
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)

    # In ORM: values are transparently decrypted
    assert p.patient_id == "1099887766"
    assert p.age == 55
    assert isinstance(p.age, int)

    # In raw database: values are AES-256 ciphertext strings
    raw_row = db_session.execute(
        text("SELECT patient_id, age, name, phone FROM patients WHERE id = :id"),
        {"id": p.id}
    ).fetchone()
    raw_pid, raw_age, raw_name, raw_phone = raw_row
    assert raw_pid.startswith("enc:aes256gcm:")
    assert raw_age.startswith("enc:aes256gcm:")
    assert raw_name.startswith("enc:aes256gcm:")
    assert raw_phone.startswith("enc:aes256gcm:")

    # Exact-match equality query works via deterministic searchable encryption
    found = db_session.query(Patient).filter(Patient.patient_id == "1099887766").first()
    assert found is not None
    assert found.id == p.id


def test_user_credentials_raw_db_encryption(db_session):
    """Verify user username and full_name are stored as AES-256 ciphertext in raw database."""
    from sqlalchemy import text
    from app.models import User, Role
    from app.security import hash_password

    u = User(
        username="sec_doc",
        hashed_password=hash_password("docpass123"),
        role=Role.DOCTOR,
        full_name="Dr. Security Test",
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)

    # In ORM: values are transparently decrypted
    assert u.username == "sec_doc"
    assert u.full_name == "Dr. Security Test"

    # In raw database: values are AES-256 ciphertext strings
    raw_row = db_session.execute(
        text("SELECT username, full_name, hashed_password FROM users WHERE id = :id"),
        {"id": u.id}
    ).fetchone()
    raw_uname, raw_fname, raw_pass = raw_row
    assert raw_uname.startswith("enc:aes256gcm:")
    assert raw_fname.startswith("enc:aes256gcm:")
    assert raw_pass.startswith("$2b$")  # bcrypt

    # Exact-match equality query works via deterministic searchable encryption
    found = db_session.query(User).filter(User.username == "sec_doc").first()
    assert found is not None
    assert found.id == u.id


def test_obsolete_tables_not_in_orm_metadata():
    """Verify obsolete tables are not in SQLAlchemy Base metadata."""
    from app.database import Base

    table_names = set(Base.metadata.tables.keys())
    obsolete = ["ai_evaluations", "ai_provenance", "allergies", "clinical_concepts", "lab_results", "medications"]
    for dead in obsolete:
        assert dead not in table_names


def test_patient_id_masking():
    """Verify patient ID masks all but the last 3 digits with asterisks."""
    assert mask_patient_id("1000000002") == "*******002"
    assert mask_patient_id("1000000001") == "*******001"
    assert mask_patient_id("12345") == "**345"
    assert mask_patient_id("444") == "444"
    assert mask_patient_id("22") == "22"
    assert mask_patient_id(None) is None

