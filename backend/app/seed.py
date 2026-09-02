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
from .models import User, Role, RedFlagRule, RedFlagRuleVersion, Patient, TreatmentRecord, TokenQueue, TokenStatus
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
        # 1. Seed demo users ONLY if the users table is completely empty
        if db.query(User).count() == 0:
            demo_users = [
                ("gopi", "gopi", Role.ADMIN, "Gopi (Administrator)"),
                ("admin", "admin123", Role.ADMIN, "System Admin (demo)"),
                ("doctor", "doctor123", Role.DOCTOR, "Dr. Rahul (Physician)"),
                ("doctor2", "doctor123", Role.DOCTOR, "Dr. Priya (Physician)"),
                ("nurse", "nurse123", Role.NURSE, "Sister Mary (Staff Nurse)"),
                ("triage", "triage123", Role.TRIAGE, "Triage Nurse (demo)"),
                ("patient", "patient123", Role.PATIENT, "Rahul Kumar (demo patient login)"),
            ]
            for username, password, role, full_name in demo_users:
                db.add(User(
                    username=username,
                    hashed_password=hash_password(password),
                    role=role,
                    full_name=full_name,
                ))
            db.commit()
        else:
            # Ensure demo nurse exists for testing
            existing_nurse = db.query(User).filter(User.username == "nurse").first()
            if not existing_nurse:
                db.add(User(
                    username="nurse",
                    hashed_password=hash_password("nurse123"),
                    role=Role.NURSE,
                    full_name="Sister Mary (Staff Nurse)",
                ))
                db.commit()

        # 2. Seed default red-flag triage rules ONLY if empty
        if db.query(RedFlagRule).count() == 0:
            for rule_data in DEFAULT_RULES:
                rule = RedFlagRule(**rule_data)
                db.add(rule)
                db.flush()
                db.add(RedFlagRuleVersion(rule_id=rule.rule_id, version=rule.version,
                                           conditions_snapshot=rule.conditions))
            db.commit()

        # 3. Seed demo patients ONLY if empty
        if db.query(Patient).count() == 0:
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
                prescribed_medicines=[
                    {
                        "name": "Paracetamol (Dolo 650)",
                        "dosage": "650 mg",
                        "frequency": "1-0-1 (Twice daily)",
                        "duration": "3 days",
                        "instructions": "After food with water"
                    },
                    {
                        "name": "ORS Hydration Sachet",
                        "dosage": "1 sachet in 1L water",
                        "frequency": "Throughout the day",
                        "duration": "2 days",
                        "instructions": "Drink sip by sip"
                    },
                    {
                        "name": "Vitamin C 500mg (Limcee)",
                        "dosage": "500 mg",
                        "frequency": "0-1-0 (Once daily)",
                        "duration": "5 days",
                        "instructions": "Chewable after lunch"
                    }
                ],
                doctor_notes="Patient presented with mild fever (100.4°F) and body ache for 2 days. Vitals stable. Advised rest, adequate hydration, and light diet. Review if fever exceeds 102°F or persists past 3 days.",
                doctor_name="Dr. Rahul Kumar",
                visit_date="12 Aug 2026",
            )
            db.add(t1)

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
            db.flush()

            # Seed initial token for demo queue if empty
            tok1 = TokenQueue(
                token_number="001",
                patient_id=p1.id,
                status=TokenStatus.WAITING,
                department="General Medicine",
                triage_priority="ROUTINE",
            )
            db.add(tok1)
            db.commit()

        print("Database verification complete: tables ready.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
