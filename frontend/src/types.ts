export type PatientSummary = {
  patient_id: string;
  name: string;
  age_months: number;
  location: string;
  scenario_description: string;
  oxygen_saturation: number;
  work_of_breathing: string;
  pathway_order_set_used: boolean;
};

export type Patient = PatientSummary & {
  diagnoses: string[];
  oxygen_support: string;
  feeding_adequate: boolean;
  asthma_history: boolean;
  cardiac_history: boolean;
  chronic_lung_disease: boolean;
  immunocompromised: boolean;
  focal_lung_findings: boolean;
  fever: boolean;
  bacterial_indication: boolean;
  current_orders: string[];
  discharge_checklist_completed: boolean;
  return_72h: boolean;
  icu_transfer: boolean;
  encounter_week: string;
};

export type ClinicalFlag = {
  code: string;
  message: string;
  severity: string;
};

export type PathwayAssessment = {
  patient_id: string;
  eligible: boolean;
  status: string;
  inclusion_criteria: string[];
  exclusion_reasons: string[];
  uncertainty_notes: string[];
  clinical_flags: ClinicalFlag[];
  suggested_workflow: string[];
  discharge: {
    status: string;
    reasons: string[];
  };
  disclaimer: string;
};

export type SmartPhraseResponse = {
  patient_id: string;
  smartphrase: string;
  disclaimer: string;
};

export type DashboardMetrics = {
  cards: { label: string; value: string; description: string }[];
  run_chart: { week: string; pathway_use_rate: number; eligible_count: number }[];
  bar_chart: { label: string; value: number }[];
  disclaimer: string;
};

export type Encounter = {
  encounter_id: string;
  patient_id: string;
  age_months: number;
  encounter_week: string;
  eligible: boolean;
  pathway_order_set_used: boolean;
  albuterol_given: boolean;
  steroid_given: boolean;
  chest_xray: boolean;
  antibiotic_without_bacterial: boolean;
  discharge_checklist_completed: boolean;
  return_72h: boolean;
  icu_transfer: boolean;
  oxygen_support: string;
  focal_lung_findings: boolean;
  orders: string[];
};

export type FhirBundle = {
  patient: Record<string, unknown>;
  encounter: Record<string, unknown>;
  conditions: Record<string, unknown>[];
  observations: Record<string, unknown>[];
  medication_requests: Record<string, unknown>[];
  service_requests: Record<string, unknown>[];
  documentation?: Record<string, unknown>;
  disclaimer: string;
};

export type SmartConfiguration = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  capabilities: string[];
  token_endpoint_auth_methods_supported: string[];
};

export type SmartPatientContext = {
  patient: Patient;
  bundle: FhirBundle;
};

export type SmartTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  patient: string;
};
