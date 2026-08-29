"""
Seeds demo users (one per role) and the default red-flag rule set.
Run inside the backend container:

    python -m app.seed

Demo credentials (synthetic, prototype-only — see docs/SECURITY.md):
    patient  / patient123   (role: PATIENT)
    doctor   / doctor123    (role: DOCTOR)
    triage   / triage123    (role: TRIAGE)
    admin    / admin123     (role: ADMIN)
"""
from .database import SessionLocal, Base, engine
from .models import User, Role, RedFlagRule, RedFlagRuleVersion, Patient, TreatmentRecord
from .security import hash_password

DEFAULT_RULES = [
    {
        "rule_id": "RF_CHEST_001",
        "name": "Chest pain with associated high-risk symptoms",
        "enabled": True, "priority": "HIGH", "version": "1.2", "action": "URGENT_TRIAGE",
        "conditions": {
            "all": [{"concept": "chest_pain", "operator": "equals", "value": True}],
            "any": [
                {"concept": "dyspnea", "operator": "equals", "value": True},
                {"concept": "radiation_to_arm", "operator": "equals", "value": True},
                {"concept": "sweating", "operator": "equals", "value": True},
            ],
        },
    },
    {
        "rule_id": "RF_DIAB_002",
        "name": "Poor glycemic control (HbA1c >= 8.0)",
        "enabled": True, "priority": "MEDIUM", "version": "1.0", "action": "FLAG_FOR_REVIEW",
        "conditions": {"all": [{"concept": "hba1c", "operator": "gte", "value": 8.0}], "any": []},
    },
    {
        "rule_id": "RF_ALLERGY_003",
        "name": "Known drug allergy on active medication list",
        "enabled": False, "priority": "HIGH", "version": "1.0", "action": "FLAG_FOR_REVIEW",
        "conditions": {"all": [{"concept": "allergy_medication_conflict", "operator": "equals", "value": True}], "any": []},
    },
    {
        "rule_id": "RF_ANIMAL_004",
        "name": "Animal bite or scratch with broken skin (Immediate Rabies PEP Evaluation)",
        "enabled": True, "priority": "HIGH", "version": "1.0", "action": "URGENT_TRIAGE",
        "conditions": {"all": [{"concept": "animal_exposure_broken_skin", "operator": "equals", "value": True}], "any": []},
    },
    {
        "rule_id": "RF_BLEED_005",
        "name": "Active continuous bleeding following injury",
        "enabled": True, "priority": "HIGH", "version": "1.0", "action": "URGENT_TRIAGE",
        "conditions": {"all": [{"concept": "active_bleeding", "operator": "equals", "value": True}], "any": []},
    },
    {
        "rule_id": "RF_HEADACHE_006",
        "name": "Sudden onset severe thunderclap headache",
        "enabled": True, "priority": "HIGH", "version": "1.0", "action": "URGENT_TRIAGE",
        "conditions": {"all": [{"concept": "headache_thunderclap", "operator": "equals", "value": True}], "any": []},
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        demo_users = [
            ("gopi", "gopi", Role.ADMIN, "Gopi (Administrator)"),
            ("admin", "admin123", Role.ADMIN, "System Admin (demo)"),
            ("doctor", "doctor123", Role.DOCTOR, "Dr. (demo) Physician"),
            ("triage", "triage123", Role.TRIAGE, "Triage Nurse (demo)"),
            ("patient", "patient123", Role.PATIENT, "Rahul Kumar (demo patient login)"),
        ]
        for username, password, role, full_name in demo_users:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                db.add(User(username=username, hashed_password=hash_password(password),
                             role=role, full_name=full_name))
            else:
                # Update password to ensure it matches
                existing.hashed_password = hash_password(password)
                existing.role = role
                if not existing.full_name:
                    existing.full_name = full_name
        db.commit()

        for rule_data in DEFAULT_RULES:
            if not db.query(RedFlagRule).filter(RedFlagRule.rule_id == rule_data["rule_id"]).first():
                rule = RedFlagRule(**rule_data)
                db.add(rule)
                db.flush()
                db.add(RedFlagRuleVersion(rule_id=rule.rule_id, version=rule.version,
                                           conditions_snapshot=rule.conditions))

        # Seed Patient 1: 1000000001 (Rahul Kumar) with previous treatment history
        p1 = db.query(Patient).filter(Patient.patient_id == "1000000001").first()
        if not p1:
            p1 = Patient(
                patient_id="1000000001",
                name="Rahul Kumar",
                phone="9876543210",
                age=42,
                gender="Male",
                preferred_language="en",
                department="General Medicine",
                is_synthetic=True,
            )
            db.add(p1)
            db.flush()
            
            # Add past treatment record
            t1 = TreatmentRecord(
                patient_id=p1.id,
                illness_id="ILL_FEVER_001",
                illness_name="Fever & Viral Infection",
                symptoms="Fever, Body pain, Weakness",
                diagnosis="Acute Viral Syndrome",
                treatment="Paracetamol 650mg, ORS, Bed rest for 3 days",
                visit_date="12 Aug 2026",
            )
            db.add(t1)

        # Seed Patient 2: 1000000002 (Priya Sharma) without previous treatment history
        p2 = db.query(Patient).filter(Patient.patient_id == "1000000002").first()
        if not p2:
            p2 = Patient(
                patient_id="1000000002",
                name="Priya Sharma",
                phone="9876501234",
                age=30,
                gender="Female",
                preferred_language="hi",
                department="General Medicine",
                is_synthetic=True,
            )
            db.add(p2)

        db.commit()
        print("Seed complete: 4 demo users, 2 demo patients (with/without history) + default red-flag rules.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
