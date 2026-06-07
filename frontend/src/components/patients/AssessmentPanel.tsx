import type { PathwayAssessment } from "../../types";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {children}
  </div>
);

const AssessmentPanel = ({ assessment }: { assessment: PathwayAssessment }) => {
  const flagColor = assessment.eligible ? "text-clinical-teal" : "text-amber-500";
  return (
    <div className="space-y-4">
      <Section title="Bronchiolitis eligibility">
        <p className={`text-sm font-semibold ${flagColor}`}>Status: {assessment.status}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
          {assessment.inclusion_criteria.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {assessment.exclusion_reasons.length > 0 && (
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
            <p className="font-semibold">Exclusion / review reasons:</p>
            <ul className="list-disc pl-5">
              {assessment.exclusion_reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>
      <Section title="Clinical flags and order review">
        {assessment.clinical_flags.length === 0 ? (
          <p className="text-sm text-slate-600">No active review flags. Continue supportive care and review local policy.</p>
        ) : (
          <ul className="space-y-2 text-sm text-slate-700">
            {assessment.clinical_flags.map((flag) => (
              <li key={flag.code} className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-clinical-teal">{flag.message}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{flag.severity}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Suggested workflow">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
          {assessment.suggested_workflow.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>
      <Section title="Discharge readiness">
        <p className="text-sm font-semibold text-slate-900">Status: {assessment.discharge.status}</p>
        {assessment.discharge.reasons.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            {assessment.discharge.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">No active blockers documented.</p>
        )}
      </Section>
      <Section title="Uncertainty notes">
        <ul className="list-disc pl-5 text-sm text-slate-600">
          {assessment.uncertainty_notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
};

export default AssessmentPanel;
