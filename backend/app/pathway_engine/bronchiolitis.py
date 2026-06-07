from __future__ import annotations

from typing import Dict, List

from ..schemas import ClinicalFlag, DischargeAssessment, Patient, PathwayAssessment


class BronchiolitisEngine:
    def __init__(self, config: Dict):
        self.config = config
        self.age_min = config["age_range"]["min_months"]
        self.age_max = config["age_range"]["max_months"]

    def evaluate(self, patient: Patient) -> PathwayAssessment:
        eligible, status, inclusion, exclusions = self._evaluate_eligibility(patient)
        flags = self._generate_flags(patient)
        discharge = self._discharge_assessment(patient)
        workflow = self._suggested_workflow(patient, eligible)
        return PathwayAssessment(
            patient_id=patient.patient_id,
            eligible=eligible,
            status=status,
            inclusion_criteria=inclusion,
            exclusion_reasons=exclusions,
            uncertainty_notes=self.config.get("uncertainty_notes", []),
            clinical_flags=flags,
            suggested_workflow=workflow,
            discharge=discharge,
        )

    def _evaluate_eligibility(self, patient: Patient):
        inclusion = ["Age 1-23 months", "Bronchiolitis diagnosis documented"]
        exclusions: List[str] = []
        eligible = True

        if not (self.age_min <= patient.age_months <= self.age_max):
            eligible = False
            exclusions.append("Age outside pathway range")
        if "bronchiolitis" not in [d.lower() for d in patient.diagnoses]:
            eligible = False
            exclusions.append("Diagnosis not primary bronchiolitis")

        review_map = {
            "cardiac_history": patient.cardiac_history,
            "chronic_lung_disease": patient.chronic_lung_disease,
            "immunocompromised": patient.immunocompromised,
        }
        hfnc_active = patient.oxygen_support == "hfnc"
        wob_severe = patient.work_of_breathing.lower() == "severe"
        focal = patient.focal_lung_findings

        if hfnc_active:
            exclusions.append("High-flow nasal cannula — severe course")
            eligible = False
        if wob_severe:
            exclusions.append("Severe work of breathing — escalate per local policy")
            eligible = False
        if focal:
            exclusions.append("Focal lung findings — consider pneumonia pathway")
            eligible = False
        for key, active in review_map.items():
            if active:
                exclusions.append(self.config["review_triggers"].get(key, key))
                eligible = False

        status = "eligible" if eligible else "needs review"
        return eligible, status, inclusion, exclusions

    def _generate_flags(self, patient: Patient) -> List[ClinicalFlag]:
        flags: List[ClinicalFlag] = []
        orders_lower = [order.lower() for order in patient.current_orders]

        def add_flag(code: str):
            cfg = self.config["clinical_flags"].get(code, {})
            flags.append(
                ClinicalFlag(
                    code=code,
                    message=cfg.get("message", code.replace("_", " ")),
                )
            )

        if "albuterol" in orders_lower and not patient.asthma_history:
            add_flag("albuterol_without_asthma")
        if "systemic_steroid" in orders_lower and not patient.asthma_history:
            add_flag("steroid_routine_use")
        if "chest_xray" in orders_lower and not patient.focal_lung_findings and patient.work_of_breathing != "severe":
            add_flag("cxr_without_indication")
        if "antibiotic" in orders_lower and not patient.bacterial_indication:
            add_flag("antibiotic_without_bacterial")
        if not patient.pathway_order_set_used:
            add_flag("missing_pathway_use")
        if patient.work_of_breathing != "severe" and not patient.discharge_checklist_completed and patient.oxygen_support == "room_air":
            add_flag("missing_discharge_checklist")
        return flags

    def _discharge_assessment(self, patient: Patient) -> DischargeAssessment:
        ready_cfg = self.config["discharge_readiness"]
        reasons: List[str] = []
        status = "needs_review"

        if (
            patient.feeding_adequate
            and patient.oxygen_support in ready_cfg["likely_ready"]["oxygen_support"]
            and patient.work_of_breathing in ready_cfg["likely_ready"]["work_of_breathing_allow"]
        ):
            status = "likely_ready"
        if (
            not patient.feeding_adequate
            or patient.oxygen_support in ready_cfg["not_ready"]["oxygen_support"]
            or patient.work_of_breathing in ready_cfg["not_ready"]["work_of_breathing_block"]
        ):
            status = "not_ready"
            if not patient.feeding_adequate:
                reasons.append("Feeding not yet adequate")
            if patient.oxygen_support != "room_air":
                reasons.append("Oxygen support ongoing")
            if patient.work_of_breathing in {"moderate", "severe"}:
                reasons.append("Work of breathing above discharge goal")

        return DischargeAssessment(status=status, reasons=reasons)

    def _suggested_workflow(self, patient: Patient, eligible: bool) -> List[str]:
        steps = ["Confirm bronchiolitis pathway inclusion", "Discuss with respiratory therapy"]
        if eligible:
            steps.append("Reinforce supportive care bundle")
        else:
            steps.append("Escalate to higher-acuity workflow or consult pathway owner")
        if not patient.pathway_order_set_used:
            steps.append("Review local bronchiolitis order set usage")
        if patient.discharge_checklist_completed:
            steps.append("Document discharge education and follow-up")
        else:
            steps.append("Complete discharge readiness checklist")
        steps.append("Reiterate: prototype uses synthetic data; clinician review required")
        return steps
