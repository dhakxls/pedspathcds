import type { Patient } from "../../types";

const SnapshotRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-slate-500">{label}</span>
    <span className="font-medium text-slate-900">{value}</span>
  </div>
);

const PatientSnapshot = ({ patient }: { patient: Patient }) => {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Patient snapshot</h3>
      <SnapshotRow label="ID" value={patient.patient_id} />
      <SnapshotRow label="Scenario" value={patient.scenario_description} />
      <SnapshotRow label="Age" value={`${patient.age_months} months`} />
      <SnapshotRow label="Location" value={patient.location} />
      <SnapshotRow label="SpO2" value={`${patient.oxygen_saturation}%`} />
      <SnapshotRow label="Oxygen" value={patient.oxygen_support} />
      <SnapshotRow label="Work of breathing" value={patient.work_of_breathing} />
      <SnapshotRow label="Feeding" value={patient.feeding_adequate ? "adequate" : "poor"} />
    </div>
  );
};

export default PatientSnapshot;
