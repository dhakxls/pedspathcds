from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


DISCLAIMER = (
    "This prototype uses synthetic data only. It is not connected to production Epic, "
    "does not contain real patient data, and is not intended for clinical use."
)


class Patient(BaseModel):
    patient_id: str
    name: str
    age_months: int
    location: str
    diagnoses: List[str]
    scenario_description: str
    oxygen_saturation: int
    oxygen_support: str
    feeding_adequate: bool
    work_of_breathing: str
    asthma_history: bool
    cardiac_history: bool
    chronic_lung_disease: bool
    immunocompromised: bool
    focal_lung_findings: bool
    fever: bool
    bacterial_indication: bool
    current_orders: List[str]
    pathway_order_set_used: bool
    discharge_checklist_completed: bool
    return_72h: bool
    icu_transfer: bool
    encounter_week: str


class PatientSummary(BaseModel):
    patient_id: str
    name: str
    age_months: int
    location: str
    scenario_description: str
    oxygen_saturation: int
    work_of_breathing: str
    pathway_order_set_used: bool


class Encounter(BaseModel):
    encounter_id: str
    patient_id: str
    age_months: int
    encounter_week: str
    eligible: bool
    pathway_order_set_used: bool
    albuterol_given: bool
    steroid_given: bool
    chest_xray: bool
    antibiotic_without_bacterial: bool
    bacterial_indication: bool
    discharge_checklist_completed: bool
    return_72h: bool
    icu_transfer: bool
    oxygen_support: str
    focal_lung_findings: bool
    orders: List[str]


class ClinicalFlag(BaseModel):
    code: str
    message: str
    severity: str = Field(default="review")


class DischargeAssessment(BaseModel):
    status: str
    reasons: List[str] = Field(default_factory=list)


class PathwayAssessment(BaseModel):
    patient_id: str
    eligible: bool
    status: str
    inclusion_criteria: List[str]
    exclusion_reasons: List[str]
    uncertainty_notes: List[str]
    clinical_flags: List[ClinicalFlag]
    suggested_workflow: List[str]
    discharge: DischargeAssessment
    disclaimer: str = Field(default=DISCLAIMER)


class SmartPhraseResponse(BaseModel):
    patient_id: str
    smartphrase: str
    disclaimer: str = Field(default=DISCLAIMER)


class FHIRResourceBundle(BaseModel):
    patient: dict
    encounter: dict
    conditions: List[dict]
    observations: List[dict]
    medication_requests: List[dict]
    service_requests: List[dict]
    documentation: Optional[dict]
    disclaimer: str = Field(default=DISCLAIMER)


class SmartConfigurationResponse(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    registration_endpoint: str
    management_endpoint: str
    response_types_supported: List[str]
    grant_types_supported: List[str]
    scopes_supported: List[str]
    capabilities: List[str]
    token_endpoint_auth_methods_supported: List[str]
    disclaimer: str = Field(default=DISCLAIMER)


class SmartPatientContextResponse(BaseModel):
    patient: Patient
    bundle: FHIRResourceBundle


class DashboardMetricCard(BaseModel):
    label: str
    value: str
    description: str


class DashboardRunChartPoint(BaseModel):
    week: str
    pathway_use_rate: float
    eligible_count: int


class DashboardBarPoint(BaseModel):
    label: str
    value: float


class DashboardMetrics(BaseModel):
    cards: List[DashboardMetricCard]
    run_chart: List[DashboardRunChartPoint]
    bar_chart: List[DashboardBarPoint]
    disclaimer: str = Field(default=DISCLAIMER)


class PatientListResponse(BaseModel):
    patients: List[PatientSummary]
    disclaimer: str = Field(default=DISCLAIMER)


class DashboardEncounterResponse(BaseModel):
    encounters: List[Encounter]
    disclaimer: str = Field(default=DISCLAIMER)
