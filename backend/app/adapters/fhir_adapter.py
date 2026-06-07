from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import List

from ..schemas import Encounter, Patient


class FHIRAdapter:
    def __init__(self, institution_name: str = "Demo Children's"):
        self.institution_name = institution_name

    def patient_resource(self, patient: Patient) -> dict:
        return {
            "resourceType": "Patient",
            "id": patient.patient_id,
            "name": [{"text": patient.name}],
            "birthDate": self._synthetic_birthdate(patient.age_months),
            "extension": [
                {
                    "url": "https://peds-path-cds/demo-disclaimer",
                    "valueString": "Synthetic patient for pathway prototype",
                }
            ],
        }

    def encounter_resource(self, patient: Patient) -> dict:
        return {
            "resourceType": "Encounter",
            "id": f"enc-{patient.patient_id.lower()}",
            "status": "in-progress",
            "class": {"code": "EMER", "display": patient.location},
            "subject": {"reference": f"Patient/{patient.patient_id}"},
            "period": {
                "start": datetime.now(UTC).isoformat(),
            },
        }

    def condition_resources(self, patient: Patient) -> List[dict]:
        resources = []
        for dx in patient.diagnoses:
            resources.append(
                {
                    "resourceType": "Condition",
                    "id": f"cond-{patient.patient_id}-{dx}",
                    "code": {"text": dx},
                    "subject": {"reference": f"Patient/{patient.patient_id}"},
                    "verificationStatus": {"text": "synthetic"},
                }
            )
        return resources

    def observation_resources(self, patient: Patient) -> List[dict]:
        return [
            {
                "resourceType": "Observation",
                "id": f"obs-{patient.patient_id}-spo2",
                "code": {"text": "SpO2"},
                "valueQuantity": {"value": patient.oxygen_saturation, "unit": "%"},
                "interpretation": {"text": patient.oxygen_support},
                "subject": {"reference": f"Patient/{patient.patient_id}"},
            }
        ]

    def medication_requests(self, patient: Patient) -> List[dict]:
        meds = []
        for order in patient.current_orders:
            if order.lower() in {"albuterol", "antibiotic", "systemic_steroid"}:
                meds.append(
                    {
                        "resourceType": "MedicationRequest",
                        "id": f"med-{patient.patient_id}-{order}",
                        "status": "active",
                        "intent": "order",
                        "medicationCodeableConcept": {"text": order},
                        "subject": {"reference": f"Patient/{patient.patient_id}"},
                    }
                )
        return meds

    def service_requests(self, patient: Patient) -> List[dict]:
        services = []
        for order in patient.current_orders:
            if order.lower() in {"chest_xray", "nasal_suction"}:
                services.append(
                    {
                        "resourceType": "ServiceRequest",
                        "id": f"srv-{patient.patient_id}-{order}",
                        "status": "active",
                        "intent": "order",
                        "code": {"text": order},
                        "subject": {"reference": f"Patient/{patient.patient_id}"},
                    }
                )
        return services

    def documentation_resource(self, patient: Patient, smartphrase: str) -> dict:
        return {
            "resourceType": "DocumentReference",
            "id": f"doc-{patient.patient_id}",
            "status": "current",
            "description": "SmartPhrase-style documentation",
            "author": [{"display": "PedsPath-CDS synthetic"}],
            "content": [
                {
                    "attachment": {
                        "contentType": "text/plain",
                        "data": smartphrase,
                    }
                }
            ],
        }

    def bundle(self, patient: Patient, smartphrase: str | None = None) -> dict:
        patient_res = self.patient_resource(patient)
        encounter_res = self.encounter_resource(patient)
        return {
            "resourceType": "Bundle",
            "type": "collection",
            "entry": [
                {"resource": patient_res},
                {"resource": encounter_res},
                *[{"resource": cond} for cond in self.condition_resources(patient)],
                *[{"resource": obs} for obs in self.observation_resources(patient)],
                *[{"resource": med} for med in self.medication_requests(patient)],
                *[{"resource": srv} for srv in self.service_requests(patient)],
                *(
                    [{"resource": self.documentation_resource(patient, smartphrase)}]
                    if smartphrase
                    else []
                ),
            ],
            "meta": {"tag": [
                {"system": "https://peds-path-cds", "code": "synthetic", "display": "Synthetic demo"}
            ]},
        }

    def _synthetic_birthdate(self, age_months: int) -> str:
        months = age_months
        days = months * 30
        birthdate = datetime.now(UTC) - timedelta(days=days)
        return birthdate.date().isoformat()
