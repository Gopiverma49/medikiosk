def test_fhir_export_produces_expected_resource_types(client):
    patient = client.post("/api/patients", json={"name": "Ravi Kumar", "gender": "Male"}).json()
    enc = client.post("/api/encounters", json={"patient_id": patient["id"]}).json()
    client.post("/api/history/answer", json={
        "encounter_id": enc["id"], "question_concept": "chest_pain", "raw_answer": True, "certainty": "confirmed",
    })
    doc = client.post(f"/api/documents/upload?encounter_id={enc['id']}&doc_type=prescription&filename=x.png").json()
    client.post(f"/api/documents/{doc['id']}/process")

    resp = client.post(f"/api/fhir/export?encounter_id={enc['id']}").json()
    resource_types = {e["resource"]["resourceType"] for e in resp["bundle"]["entry"]}
    assert "Patient" in resource_types
    assert "Encounter" in resource_types
    assert "MedicationStatement" in resource_types
    assert resp["integration_status"]["abdm"] == "MOCK/SANDBOX"
    assert resp["integration_status"]["his"] == "MOCK CONNECTED"


def test_fhir_status_never_claims_production_abdm(client):
    status = client.get("/api/fhir/status").json()
    assert status["abdm"] != "PRODUCTION"
    assert "MOCK" in status["abdm"] or "SANDBOX" in status["abdm"]


def test_login_returns_role_scoped_token(client):
    from app.database import get_db
    from app.main import app
    from app.seed import seed
    # Seed demo users into the overridden test session.
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    from app.models import User, Role
    from app.security import hash_password
    if not db.query(User).filter(User.username == "doctor").first():
        db.add(User(username="doctor", hashed_password=hash_password("doctor123"), role=Role.DOCTOR, full_name="Dr. Demo"))
        db.commit()

    resp = client.post("/api/auth/login", json={"username": "doctor", "password": "doctor123"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "DOCTOR"


def test_login_rejects_wrong_password(client):
    from app.database import get_db
    from app.main import app
    db_gen = app.dependency_overrides[get_db]()
    db = next(db_gen)
    from app.models import User, Role
    from app.security import hash_password
    if not db.query(User).filter(User.username == "doctor2").first():
        db.add(User(username="doctor2", hashed_password=hash_password("correct-password"), role=Role.DOCTOR))
        db.commit()

    resp = client.post("/api/auth/login", json={"username": "doctor2", "password": "wrong-password"})
    assert resp.status_code == 401
