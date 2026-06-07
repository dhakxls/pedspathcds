from __future__ import annotations

from fastapi.testclient import TestClient

from app.adapters.fhir_adapter import FHIRAdapter
from app.main import app, data_store

client = TestClient(app)


def test_patient_fhir_endpoint_links_subjects():
    patient = data_store.patients[0]
    response = client.get(f"/patients/{patient.patient_id}/fhir")
    assert response.status_code == 200
    payload = response.json()

    assert payload["patient"]["resourceType"] == "Patient"
    assert payload["patient"]["id"] == patient.patient_id

    subject_reference = f"Patient/{patient.patient_id}"
    assert payload["encounter"]["subject"]["reference"] == subject_reference

    for section in ("conditions", "observations", "medication_requests", "service_requests"):
        for resource in payload[section]:
            assert resource["subject"]["reference"] == subject_reference

    documentation = payload["documentation"]
    assert documentation["resourceType"] == "DocumentReference"
    attachment = documentation["content"][0]["attachment"]
    assert attachment["contentType"] == "text/plain"
    assert attachment["data"].strip() != ""


def test_fhir_adapter_bundle_contains_required_entries():
    patient = data_store.patients[0]
    adapter = FHIRAdapter()
    bundle = adapter.bundle(patient, smartphrase="example note")

    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    assert "entry" in bundle and bundle["entry"], "bundle must contain resources"

    resource_types = {entry["resource"]["resourceType"] for entry in bundle["entry"]}
    assert {"Patient", "Encounter", "DocumentReference"}.issubset(resource_types)

    patient_entry = next(entry for entry in bundle["entry"] if entry["resource"]["resourceType"] == "Patient")
    assert patient_entry["resource"]["id"] == patient.patient_id

    encounter_entry = next(entry for entry in bundle["entry"] if entry["resource"]["resourceType"] == "Encounter")
    assert encounter_entry["resource"]["subject"]["reference"] == f"Patient/{patient.patient_id}"

    document_ref = next(entry for entry in bundle["entry"] if entry["resource"]["resourceType"] == "DocumentReference")
    doc_attachment = document_ref["resource"]["content"][0]["attachment"]
    assert doc_attachment["data"] == "example note"

    tags = bundle.get("meta", {}).get("tag", [])
    assert any(tag.get("code") == "synthetic" for tag in tags)
