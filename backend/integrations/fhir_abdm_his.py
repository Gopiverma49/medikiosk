"""
Mock FHIR / ABDM / HIS integration layer.

IMPORTANT: These are sandbox/mock implementations only. Never claim production
ABDM connectivity unless actually configured and tested against the real
ABDM gateway with valid facility/HIP credentials — see docs/SECURITY.md.
"""
from abc import ABC, abstractmethod


class FHIRProvider(ABC):
    @abstractmethod
    def build_bundle(self, patient: dict, encounter: dict, facts: list, documents: list) -> dict:
        ...


class ABDMProvider(ABC):
    @abstractmethod
    def link_health_id(self, patient_id: str, abha_id: str) -> dict:
        ...


class HISProvider(ABC):
    @abstractmethod
    def push_encounter(self, encounter: dict) -> dict:
        ...


class MockFHIRProvider(FHIRProvider):
    """Maps internal records to FHIR R4-shaped resources (structure only; not validated
    against a real FHIR server in this prototype)."""

    def build_bundle(self, patient: dict, encounter: dict, facts: list, documents: list) -> dict:
        entries = []
        entries.append({"resource": {
            "resourceType": "Patient", "id": patient["id"],
            "name": [{"text": patient["name"]}],
            "gender": (patient.get("gender") or "unknown").lower(),
        }})
        entries.append({"resource": {
            "resourceType": "Encounter", "id": encounter["id"], "status": "finished",
            "subject": {"reference": f"Patient/{patient['id']}"},
            "class": "AYUSH" if encounter.get("mode") == "ayush" else "AMB",
        }})
        for f in facts:
            if f.get("category") in ("symptom", "chief_complaint"):
                entries.append({"resource": {
                    "resourceType": "Condition",
                    "code": {"text": f["concept"]},
                    "clinicalStatus": "active" if f.get("value") else "absent",
                    "subject": {"reference": f"Patient/{patient['id']}"},
                    "verificationStatus": f.get("verification_status"),
                }})
            elif f.get("concept") == "medication":
                entries.append({"resource": {
                    "resourceType": "MedicationStatement", "status": "active",
                    "medicationCodeableConcept": {"text": f.get("label")},
                    "subject": {"reference": f"Patient/{patient['id']}"},
                }})
            elif f.get("concept") == "allergy":
                entries.append({"resource": {
                    "resourceType": "AllergyIntolerance",
                    "code": {"text": f.get("label")},
                    "patient": {"reference": f"Patient/{patient['id']}"},
                }})
            elif f.get("category") == "investigation":
                entries.append({"resource": {
                    "resourceType": "Observation",
                    "code": {"text": f.get("label")},
                    "valueQuantity": {"value": f.get("value"), "unit": f.get("unit")},
                    "subject": {"reference": f"Patient/{patient['id']}"},
                }})
        for d in documents:
            entries.append({"resource": {
                "resourceType": "DocumentReference",
                "description": d.get("filename"), "status": d.get("status"),
            }})
        return {"resourceType": "Bundle", "type": "collection", "entry": entries}


class MockABDMProvider(ABDMProvider):
    def link_health_id(self, patient_id: str, abha_id: str) -> dict:
        return {"status": "MOCK_SANDBOX", "patient_id": patient_id, "abha_id": abha_id, "linked": True}


class MockHISProvider(HISProvider):
    def push_encounter(self, encounter: dict) -> dict:
        return {"status": "MOCK_CONNECTED", "encounter_id": encounter.get("id"), "accepted": True}


def integration_status() -> dict:
    return {"fhir": "READY", "abdm": "MOCK/SANDBOX", "his": "MOCK CONNECTED"}
