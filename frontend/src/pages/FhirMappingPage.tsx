import { useEffect, useState } from "react";
import { fetchPatients, fetchFhirBundle } from "../api";
import type { PatientSummary, FhirBundle } from "../types";

const FhirMappingPage = () => {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [bundle, setBundle] = useState<FhirBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then((res) => {
        setPatients(res.data.patients);
        setSelected(res.data.patients[0]?.patient_id ?? "");
      })
      .catch(() => setError("Unable to load synthetic patients"));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetchFhirBundle(selected)
      .then((res) => setBundle(res.data))
      .catch(() => setError("Unable to load FHIR mapping"));
  }, [selected]);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-3xl font-semibold text-slate-900">FHIR-aware mapping</h2>
        <p className="text-sm text-slate-500">Synthetic resources only; future SMART-on-FHIR integration will require institutional review.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        {patients.map((patient) => (
          <button
            key={patient.patient_id}
            onClick={() => setSelected(patient.patient_id)}
            className={`rounded-full border px-4 py-1 text-sm ${
              selected === patient.patient_id
                ? "border-clinical-teal bg-clinical-teal/10 text-clinical-teal"
                : "border-slate-200 text-slate-600"
            }`}
          >
            {patient.name}
          </button>
        ))}
      </div>
      {bundle ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Selected resource mapping</h3>
          <div className="text-sm text-slate-600">
            <p>Patient → FHIR Patient</p>
            <p>Visit/admission → Encounter</p>
            <p>Diagnosis → Condition</p>
            <p>O2 saturation → Observation</p>
            <p>Medication orders → MedicationRequest</p>
            <p>Imaging orders → ServiceRequest</p>
            <p>Documentation output → DocumentReference conceptually</p>
          </div>
          <pre className="mt-4 max-h-[28rem] overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
            {JSON.stringify(bundle, null, 2)}
          </pre>
        </div>
      ) : (
        <p>Select a patient to view mapping.</p>
      )}
    </section>
  );
};

export default FhirMappingPage;
