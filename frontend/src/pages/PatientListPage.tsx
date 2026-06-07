import { useEffect, useState } from "react";
import { fetchPatients } from "../api";
import type { PatientSummary } from "../types";
import PatientCard from "../components/patients/PatientCard";

const PatientListPage = () => {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then((res) => setPatients(res.data.patients))
      .catch(() => setError("Unable to load synthetic patients"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading synthetic cohort…</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-slate-900">Synthetic Pediatric Cohort</h2>
        <p className="text-sm text-slate-500">Review bronchiolitis patients for pathway readiness and documentation support.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {patients.map((patient) => (
          <PatientCard key={patient.patient_id} patient={patient} />
        ))}
      </div>
    </section>
  );
};

export default PatientListPage;
