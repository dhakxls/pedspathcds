import type { Encounter } from "../../types";

const headers = [
  "Encounter",
  "Patient",
  "Week",
  "Pathway",
  "Albuterol",
  "CXR",
  "Steroid",
  "Antibiotic",
  "Return 72h",
];

const EncounterTable = ({ encounters }: { encounters: Encounter[] }) => {
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 text-left">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {encounters.slice(0, 25).map((encounter) => (
            <tr key={encounter.encounter_id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-semibold text-slate-900">{encounter.encounter_id}</td>
              <td className="px-4 py-3 text-slate-600">{encounter.patient_id}</td>
              <td className="px-4 py-3 text-slate-600">{encounter.encounter_week}</td>
              <td className="px-4 py-3">{encounter.pathway_order_set_used ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{encounter.albuterol_given ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{encounter.chest_xray ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{encounter.steroid_given ? "Yes" : "No"}</td>
              <td className="px-4 py-3">{encounter.antibiotic_without_bacterial ? "Flag" : "-"}</td>
              <td className="px-4 py-3">{encounter.return_72h ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default EncounterTable;
