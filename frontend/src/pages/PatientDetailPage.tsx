import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  fetchAssessment,
  fetchFhirBundle,
  fetchPatient,
  fetchSmartphrase,
} from "../api";
import type { Patient, PathwayAssessment, SmartPhraseResponse, FhirBundle } from "../types";
import PatientSnapshot from "../components/patients/PatientSnapshot";
import AssessmentPanel from "../components/patients/AssessmentPanel";
import SmartPhrasePanel from "../components/patients/SmartPhrasePanel";

const PatientDetailPage = () => {
  const { patientId } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [assessment, setAssessment] = useState<PathwayAssessment | null>(null);
  const [smartphrase, setSmartphrase] = useState<SmartPhraseResponse | null>(null);
  const [fhirBundle, setFhirBundle] = useState<FhirBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) return;
    Promise.all([
      fetchPatient(patientId),
      fetchAssessment(patientId),
      fetchSmartphrase(patientId),
      fetchFhirBundle(patientId),
    ])
      .then(([patientRes, assessRes, phraseRes, fhirRes]) => {
        setPatient(patientRes.data);
        setAssessment(assessRes.data);
        setSmartphrase(phraseRes.data);
        setFhirBundle(fhirRes.data);
      })
      .catch(() => setError("Unable to load patient details"));
  }, [patientId]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!patient || !assessment)
    return <p className="text-slate-600">Loading patient pathway assessment…</p>;

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900">Pathway support for {patient.name}</h2>
          <p className="text-sm text-slate-500">Bronchiolitis module — clinician review required.</p>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <PatientSnapshot patient={patient} />
        <AssessmentPanel assessment={assessment} />
      </div>
      <SmartPhrasePanel smartphrase={smartphrase} />
      {fhirBundle && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">FHIR mapping preview</h3>
          <p className="text-sm text-slate-500">Synthetic example only — not standards-certified.</p>
          <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
            {JSON.stringify(fhirBundle, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
};

export default PatientDetailPage;
