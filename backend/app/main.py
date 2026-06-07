from __future__ import annotations

import os
import secrets
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import FastAPI, HTTPException, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from .adapters.fhir_adapter import FHIRAdapter
from .models import ConfigStore, DataStore
from .pathway_engine.bronchiolitis import BronchiolitisEngine
from .schemas import (
    DashboardEncounterResponse,
    DashboardMetrics,
    DashboardMetricCard,
    DashboardRunChartPoint,
    DashboardBarPoint,
    PatientListResponse,
    PathwayAssessment,
    Patient,
    SmartPhraseResponse,
    FHIRResourceBundle,
    SmartConfigurationResponse,
    SmartPatientContextResponse,
    DISCLAIMER,
)

app = FastAPI(
    title="PedsPath-CDS",
    description="Synthetic-data pediatric pathway support and QI analytics prototype",
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_store = DataStore()
config_store = ConfigStore()
bronch_engine = BronchiolitisEngine(config_store.bronchiolitis)
fhir_adapter = FHIRAdapter(config_store.demo_hospital.get("institution", "Demo Children's"))
smart_base_url = os.getenv("SMART_BASE_URL", "https://homelab.taild08007.ts.net/peds/api")
smart_issuer = os.getenv("SMART_ISSUER", smart_base_url.rstrip("/") + "/smart")
SMART_CLIENT_ID = os.getenv("SMART_CLIENT_ID", "peds-path-demo-client")
SMART_REDIRECT_URI = os.getenv("SMART_REDIRECT_URI", "https://example.org/smart-redirect")
DEFAULT_SMART_PATIENT_ID = data_store.patients[0].patient_id if data_store.patients else "SYN-001"
SMART_PATIENT_ID = os.getenv("SMART_PATIENT_ID", DEFAULT_SMART_PATIENT_ID)
SMART_ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("SMART_ACCESS_TOKEN_TTL_SECONDS", "300"))
SMART_REFRESH_TOKEN_TTL_SECONDS = int(os.getenv("SMART_REFRESH_TOKEN_TTL_SECONDS", "1800"))
_issued_auth_codes: dict[str, dict] = {}
_issued_access_tokens: dict[str, dict] = {}
_issued_refresh_tokens: dict[str, dict] = {}
SMART_CONFIGURATION = SmartConfigurationResponse(
    issuer=smart_issuer,
    authorization_endpoint=f"{smart_issuer}/authorize",
    token_endpoint=f"{smart_issuer}/token",
    registration_endpoint=f"{smart_issuer}/register",
    management_endpoint=f"{smart_issuer}/manage",
    response_types_supported=["code"],
    grant_types_supported=["authorization_code", "refresh_token"],
    scopes_supported=["launch", "patient/*.*", "openid", "profile", "offline_access"],
    capabilities=[
        "launch-standalone",
        "launch-ehr",
        "client-confidential-symmetric",
        "context-ehr-patient",
        "permission-patient",
        "permission-user",
    ],
    token_endpoint_auth_methods_supported=["client_secret_basic", "client_secret_post"],
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _future_timestamp(seconds: int) -> datetime:
    return _utcnow() + timedelta(seconds=seconds)


def _is_expired(expires_at: datetime | None) -> bool:
    return expires_at is not None and _utcnow() >= expires_at


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "PedsPath-CDS backend healthy"}


@app.get("/patients", response_model=PatientListResponse)
def list_patients():
    patients = [
        {
            "patient_id": p.patient_id,
            "name": p.name,
            "age_months": p.age_months,
            "location": p.location,
            "scenario_description": p.scenario_description,
            "oxygen_saturation": p.oxygen_saturation,
            "work_of_breathing": p.work_of_breathing,
            "pathway_order_set_used": p.pathway_order_set_used,
        }
        for p in data_store.patients
    ]
    return PatientListResponse(patients=patients)


@app.get("/patients/{patient_id}", response_model=Patient)
def patient_detail(patient_id: str):
    try:
        return data_store.get_patient(patient_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Patient not found")


@app.get("/patients/{patient_id}/pathway-assessment", response_model=PathwayAssessment)
def patient_assessment(patient_id: str):
    patient = _get_patient_or_404(patient_id)
    return bronch_engine.evaluate(patient)


@app.get("/patients/{patient_id}/smartphrase", response_model=SmartPhraseResponse)
def smartphrase(patient_id: str):
    patient = _get_patient_or_404(patient_id)
    assessment = bronch_engine.evaluate(patient)
    phrase = _build_smartphrase(patient, assessment)
    return SmartPhraseResponse(patient_id=patient.patient_id, smartphrase=phrase)


@app.get("/patients/{patient_id}/fhir", response_model=FHIRResourceBundle)
def patient_fhir_bundle(patient_id: str):
    patient = _get_patient_or_404(patient_id)
    assessment = bronch_engine.evaluate(patient)
    smartphrase_text = _build_smartphrase(patient, assessment)

    patient_res = fhir_adapter.patient_resource(patient)
    encounter_res = fhir_adapter.encounter_resource(patient)
    conditions = fhir_adapter.condition_resources(patient)
    observations = fhir_adapter.observation_resources(patient)
    meds = fhir_adapter.medication_requests(patient)
    services = fhir_adapter.service_requests(patient)
    documentation = fhir_adapter.documentation_resource(patient, smartphrase_text)

    return FHIRResourceBundle(
        patient=patient_res,
        encounter=encounter_res,
        conditions=conditions,
        observations=observations,
        medication_requests=meds,
        service_requests=services,
        documentation=documentation,
    )


@app.get("/smart/.well-known/smart-configuration", response_model=SmartConfigurationResponse)
def smart_configuration():
    return SMART_CONFIGURATION


@app.get("/smart/authorize")
def smart_authorize(
    response_type: str,
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str | None = None,
    aud: str | None = None,
    launch: str | None = None,
    smart_patient_id: str | None = None,
):
    if response_type != "code":
        raise HTTPException(status_code=400, detail="Only authorization_code flow is supported in demo")
    if client_id != SMART_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Unknown SMART client")
    if redirect_uri != SMART_REDIRECT_URI:
        raise HTTPException(status_code=400, detail="Redirect URI mismatch")

    code = secrets.token_urlsafe(16)
    selected_patient = smart_patient_id or SMART_PATIENT_ID
    try:
        _get_patient_or_404(selected_patient)
    except HTTPException as exc:
        raise HTTPException(status_code=400, detail=f"Unknown synthetic patient {selected_patient}") from exc

    _issued_auth_codes[code] = {
        "scope": scope,
        "aud": aud,
        "launch": launch,
        "patient_id": selected_patient,
    }
    params = {"code": code}
    if state:
        params["state"] = state
    redirect_target = f"{redirect_uri}?{urlencode(params)}"
    return RedirectResponse(url=redirect_target, status_code=302)


@app.post("/smart/token")
def smart_token(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    code: str | None = Form(default=None),
    redirect_uri: str | None = Form(default=None),
    refresh_token: str | None = Form(default=None),
):
    if client_id != SMART_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Unknown SMART client")

    if grant_type == "authorization_code":
        if redirect_uri != SMART_REDIRECT_URI:
            raise HTTPException(status_code=400, detail="Redirect URI mismatch")
        if not code or code not in _issued_auth_codes:
            raise HTTPException(status_code=400, detail="Invalid or expired authorization code")

        payload = _issued_auth_codes.pop(code)
        selected_patient = payload.get("patient_id", SMART_PATIENT_ID)
        access_token = secrets.token_urlsafe(24)
        refresh_token_value = secrets.token_urlsafe(24)

        context = {
            "scope": payload.get("scope", ""),
            "patient_id": selected_patient,
            "expires_at": _future_timestamp(SMART_ACCESS_TOKEN_TTL_SECONDS),
        }
        _issued_access_tokens[access_token] = context.copy()
        _issued_refresh_tokens[refresh_token_value] = {
            "scope": context["scope"],
            "patient_id": selected_patient,
            "expires_at": _future_timestamp(SMART_REFRESH_TOKEN_TTL_SECONDS),
        }

        return {
            "token_type": "Bearer",
            "access_token": access_token,
            "refresh_token": refresh_token_value,
            "expires_in": SMART_ACCESS_TOKEN_TTL_SECONDS,
            "scope": context["scope"],
            "patient": selected_patient,
        }

    if grant_type == "refresh_token":
        if not refresh_token or refresh_token not in _issued_refresh_tokens:
            raise HTTPException(status_code=400, detail="Invalid or expired refresh token")

        payload = _issued_refresh_tokens.get(refresh_token)
        if _is_expired(payload.get("expires_at")):
            _issued_refresh_tokens.pop(refresh_token, None)
            raise HTTPException(status_code=400, detail="Invalid or expired refresh token")

        payload = _issued_refresh_tokens.pop(refresh_token)
        access_token = secrets.token_urlsafe(24)
        new_refresh_token = secrets.token_urlsafe(24)

        access_context = payload.copy()
        access_context["expires_at"] = _future_timestamp(SMART_ACCESS_TOKEN_TTL_SECONDS)
        refresh_context = payload.copy()
        refresh_context["expires_at"] = _future_timestamp(SMART_REFRESH_TOKEN_TTL_SECONDS)

        _issued_access_tokens[access_token] = access_context
        _issued_refresh_tokens[new_refresh_token] = refresh_context

        return {
            "token_type": "Bearer",
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "expires_in": SMART_ACCESS_TOKEN_TTL_SECONDS,
            "scope": payload.get("scope", ""),
            "patient": payload.get("patient_id", SMART_PATIENT_ID),
        }

    raise HTTPException(status_code=400, detail="Unsupported grant type in demo")


@app.get("/smart/context", response_model=SmartPatientContextResponse)
def smart_patient_context(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1]
    context = _issued_access_tokens.get(token)
    if not context or _is_expired(context.get("expires_at")):
        _issued_access_tokens.pop(token, None)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    patient = _get_patient_or_404(context.get("patient_id", SMART_PATIENT_ID))
    assessment = bronch_engine.evaluate(patient)
    smartphrase_text = _build_smartphrase(patient, assessment)
    bundle = FHIRResourceBundle(
        patient=fhir_adapter.patient_resource(patient),
        encounter=fhir_adapter.encounter_resource(patient),
        conditions=fhir_adapter.condition_resources(patient),
        observations=fhir_adapter.observation_resources(patient),
        medication_requests=fhir_adapter.medication_requests(patient),
        service_requests=fhir_adapter.service_requests(patient),
        documentation=fhir_adapter.documentation_resource(patient, smartphrase_text),
    )
    return SmartPatientContextResponse(patient=patient, bundle=bundle)


@app.get("/dashboard/metrics", response_model=DashboardMetrics)
def dashboard_metrics():
    encounters = data_store.encounters
    total = len(encounters)
    eligible = [e for e in encounters if e.eligible]
    bronchiolitis_total = len(eligible)
    pathway_use_rate = _rate(sum(1 for e in eligible if e.pathway_order_set_used), bronchiolitis_total)
    albuterol_typical = _rate(
        sum(1 for e in eligible if e.albuterol_given and e.age_months < 12),
        bronchiolitis_total or 1,
    )
    cxr_rate = _rate(sum(1 for e in eligible if e.chest_xray), bronchiolitis_total or 1)
    steroid_rate = _rate(sum(1 for e in eligible if e.steroid_given), bronchiolitis_total or 1)
    antibiotic_rate = _rate(
        sum(1 for e in eligible if e.antibiotic_without_bacterial),
        bronchiolitis_total or 1,
    )
    discharge_completion = _rate(
        sum(1 for e in eligible if e.discharge_checklist_completed),
        bronchiolitis_total or 1,
    )
    returns_rate = _rate(sum(1 for e in eligible if e.return_72h), bronchiolitis_total or 1)
    icu_rate = _rate(sum(1 for e in eligible if e.icu_transfer), bronchiolitis_total or 1)

    cards = [
        DashboardMetricCard(label="Eligible encounters", value=str(bronchiolitis_total), description="Bronchiolitis ages 1-23 mo"),
        DashboardMetricCard(label="Pathway use", value=f"{pathway_use_rate:.0%}", description="Documented order set usage"),
        DashboardMetricCard(label="Albuterol in typical cases", value=f"{albuterol_typical:.0%}", description="Flag for low-value therapy"),
        DashboardMetricCard(label="Chest X-ray rate", value=f"{cxr_rate:.0%}", description="Imaging utilization"),
        DashboardMetricCard(label="Steroid rate", value=f"{steroid_rate:.0%}", description="Systemic steroid exposure"),
        DashboardMetricCard(label="Antibiotic without indication", value=f"{antibiotic_rate:.0%}", description="Potential overuse"),
        DashboardMetricCard(label="Discharge checklist", value=f"{discharge_completion:.0%}", description="Readiness documentation"),
        DashboardMetricCard(label="72h returns", value=f"{returns_rate:.0%}", description="ED/IP revisits"),
        DashboardMetricCard(label="ICU transfers", value=f"{icu_rate:.0%}", description="Escalations"),
    ]

    weekly_group = defaultdict(list)
    for enc in eligible:
        weekly_group[enc.encounter_week].append(enc)
    run_chart = [
        DashboardRunChartPoint(
            week=week,
            pathway_use_rate=_rate(sum(1 for e in entries if e.pathway_order_set_used), len(entries)),
            eligible_count=len(entries),
        )
        for week, entries in sorted(weekly_group.items())
    ]

    bar_chart = [
        DashboardBarPoint(label="Pathway", value=pathway_use_rate * 100),
        DashboardBarPoint(label="CXR", value=cxr_rate * 100),
        DashboardBarPoint(label="Steroid", value=steroid_rate * 100),
        DashboardBarPoint(label="Albuterol", value=albuterol_typical * 100),
        DashboardBarPoint(label="Checklist", value=discharge_completion * 100),
    ]

    return DashboardMetrics(cards=cards, run_chart=run_chart, bar_chart=bar_chart)


@app.get("/dashboard/encounters", response_model=DashboardEncounterResponse)
def dashboard_encounters():
    return DashboardEncounterResponse(encounters=data_store.encounters)


def _get_patient_or_404(patient_id: str) -> Patient:
    try:
        return data_store.get_patient(patient_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Patient not found")


def _build_smartphrase(patient: Patient, assessment: PathwayAssessment) -> str:
    exclusion_text = ", ".join(assessment.exclusion_reasons) or "none"
    flag_text = "; ".join(flag.message for flag in assessment.clinical_flags) or "No active review flags"
    return (
        f".BRONCHIPATHWAY\n"
        f"Assessment:\n"
        f"- {patient.age_months}-month-old with {patient.scenario_description}.\n"
        f"- Work of breathing: {patient.work_of_breathing}. Oxygen support: {patient.oxygen_support}.\n\n"
        f"Pathway review:\n"
        f"- Eligibility status: {assessment.status}.\n"
        f"- Inclusion criteria reviewed.\n"
        f"- Exclusion criteria: {exclusion_text}.\n"
        f"- Order review: {flag_text}.\n\n"
        f"Plan / pathway support:\n"
        f"- Supportive care, nasal suction PRN, monitor hydration and work of breathing.\n"
        f"- Oxygen per local threshold ({config_store.bronchiolitis['oxygen_threshold_spo2']}% goal).\n"
        f"- Avoid routine bronchodilators/steroids/antibiotics/CXR unless atypical course documented.\n"
        f"- Discharge readiness: {assessment.discharge.status} ({', '.join(assessment.discharge.reasons) or 'no active blockers'}).\n"
        f"- Family education, return precautions, clinician review required.\n\n"
        f"Synthetic-data prototype. Not for clinical use."
    )


def _rate(numerator: int, denominator: int) -> float:
    if denominator == 0:
        return 0.0
    return numerator / denominator
