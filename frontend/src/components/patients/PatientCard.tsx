import { Link } from "react-router-dom";
import type { PatientSummary } from "../../types";

const Pill = ({ label }: { label: string }) => (
  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">{label}</span>
);

const PatientCard = ({ patient }: { patient: PatientSummary }) => {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{patient.name}</p>
          <p className="text-xs text-slate-500">{patient.patient_id}</p>
        </div>
        <Pill label={`${patient.age_months} mo`} />
      </div>
      <p className="text-sm text-slate-600">{patient.scenario_description}</p>
      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
        <Pill label={`SpO2 ${patient.oxygen_saturation}%`} />
        <Pill label={`WOB ${patient.work_of_breathing}`} />
        <Pill label={patient.pathway_order_set_used ? "Pathway used" : "Pathway missing"} />
      </div>
      <Link to={`/patients/${patient.patient_id}`} className="inline-flex items-center text-sm font-semibold text-clinical-teal">
        Open pathway review
        <span className="ml-2">→</span>
      </Link>
    </div>
  );
};

export default PatientCard;
