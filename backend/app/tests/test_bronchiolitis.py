from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import yaml

from app.adapters.fhir_adapter import FHIRAdapter
from app.pathway_engine.bronchiolitis import BronchiolitisEngine
from app.schemas import Patient

CONFIG = yaml.safe_load((Path(__file__).resolve().parents[1] / "config" / "bronchiolitis.yaml").read_text())
ENGINE = BronchiolitisEngine(CONFIG)

BASE_PATIENT = {
    "patient_id": "TEST-001",
    "name": "Test Patient",
    "age_months": 8,
    "location": "ED",
    "diagnoses": ["bronchiolitis"],
    "scenario_description": "Typical bronchiolitis",
    "oxygen_saturation": 92,
    "oxygen_support": "room_air",
    "feeding_adequate": True,
    "work_of_breathing": "mild",
    "asthma_history": False,
    "cardiac_history": False,
    "chronic_lung_disease": False,
    "immunocompromised": False,
    "focal_lung_findings": False,
    "fever": False,
    "bacterial_indication": False,
    "current_orders": ["nasal_suction"],
    "pathway_order_set_used": True,
    "discharge_checklist_completed": True,
    "return_72h": False,
    "icu_transfer": False,
    "encounter_week": "2026-W20",
}


def make_patient(**updates) -> Patient:
    data = deepcopy(BASE_PATIENT)
    data.update(updates)
    return Patient(**data)


def test_typical_patient_is_eligible():
    assessment = ENGINE.evaluate(make_patient())
    assert assessment.eligible is True
    assert assessment.status == "eligible"


def test_age_exclusion_marks_review():
    assessment = ENGINE.evaluate(make_patient(age_months=30))
    assert assessment.eligible is False
    assert "Age outside pathway range" in assessment.exclusion_reasons


def test_congenital_heart_disease_exclusion():
    assessment = ENGINE.evaluate(make_patient(cardiac_history=True))
    assert assessment.eligible is False
    assert any("heart" in reason.lower() for reason in assessment.exclusion_reasons)


def test_hfnc_case_requires_review():
    assessment = ENGINE.evaluate(make_patient(oxygen_support="hfnc"))
    assert assessment.eligible is False
    assert any("high-flow" in reason.lower() for reason in assessment.exclusion_reasons)


def test_albuterol_flag_without_asthma_history():
    patient = make_patient(current_orders=["albuterol"])
    assessment = ENGINE.evaluate(patient)
    assert any(flag.code == "albuterol_without_asthma" for flag in assessment.clinical_flags)


def test_albuterol_flag_with_asthma_history_absent():
    patient = make_patient(current_orders=["albuterol"], asthma_history=True)
    assessment = ENGINE.evaluate(patient)
    assert all(flag.code != "albuterol_without_asthma" for flag in assessment.clinical_flags)


def test_cxr_flag_without_focal_findings():
    patient = make_patient(current_orders=["chest_xray"], focal_lung_findings=False)
    assessment = ENGINE.evaluate(patient)
    assert any(flag.code == "cxr_without_indication" for flag in assessment.clinical_flags)


def test_cxr_exception_with_focal_findings():
    patient = make_patient(current_orders=["chest_xray"], focal_lung_findings=True)
    assessment = ENGINE.evaluate(patient)
    assert all(flag.code != "cxr_without_indication" for flag in assessment.clinical_flags)


def test_discharge_ready_status():
    assessment = ENGINE.evaluate(
        make_patient(
            feeding_adequate=True,
            oxygen_support="room_air",
            work_of_breathing="mild",
            discharge_checklist_completed=True,
        )
    )
    assert assessment.discharge.status == "likely_ready"


def test_discharge_not_ready_due_to_low_flow_and_feeding():
    assessment = ENGINE.evaluate(
        make_patient(
            feeding_adequate=False,
            oxygen_support="low_flow",
            work_of_breathing="moderate",
        )
    )
    assert assessment.discharge.status == "not_ready"
    assert any("oxygen" in reason.lower() for reason in assessment.discharge.reasons)


def test_fhir_patient_resource_generation():
    adapter = FHIRAdapter()
    patient_res = adapter.patient_resource(make_patient())
    assert patient_res["resourceType"] == "Patient"
    assert patient_res["id"] == "TEST-001"
    assert patient_res["name"][0]["text"] == "Test Patient"


def test_fhir_observation_resource_generation():
    adapter = FHIRAdapter()
    observation = adapter.observation_resources(make_patient(oxygen_saturation=94))[0]
    assert observation["resourceType"] == "Observation"
    assert observation["valueQuantity"]["value"] == 94
