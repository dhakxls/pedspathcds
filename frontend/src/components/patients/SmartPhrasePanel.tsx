import { useState } from "react";
import type { SmartPhraseResponse } from "../../types";

const SmartPhrasePanel = ({ smartphrase }: { smartphrase: SmartPhraseResponse | null }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!smartphrase) return;
    navigator.clipboard.writeText(smartphrase.smartphrase).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">SmartPhrase-style documentation</h3>
        <button onClick={handleCopy} className="rounded-full border border-clinical-teal px-4 py-1 text-sm font-semibold text-clinical-teal transition hover:bg-clinical-teal/10">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        {smartphrase?.smartphrase ?? "Select a patient to generate SmartPhrase."}
      </pre>
    </div>
  );
};

export default SmartPhrasePanel;
