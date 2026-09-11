import os
import pytest

from app.services.crypto import (
    encrypt_field, decrypt_field, blind_index, mask_aadhaar_and_pii,
    compute_file_sha256, verify_file_sha256
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
    # Authorized doctor sees plaintext
    assert sample["authorized_doctor_sees"]["is_readable"] is True
