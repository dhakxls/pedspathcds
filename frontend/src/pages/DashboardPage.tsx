import { useEffect, useState } from "react";
import { fetchDashboardEncounters, fetchDashboardMetrics } from "../api";
import type { DashboardMetrics, Encounter } from "../types";
import MetricCards from "../components/dashboard/MetricCards";
import Charts from "../components/dashboard/Charts";
import EncounterTable from "../components/dashboard/EncounterTable";

const DashboardPage = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDashboardMetrics(), fetchDashboardEncounters()])
      .then(([metricsRes, encounterRes]) => {
        setMetrics(metricsRes.data);
        setEncounters(encounterRes.data.encounters);
      })
      .catch(() => setError("Unable to load dashboard data"));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!metrics) return <p className="text-slate-600">Loading QI dashboard…</p>;

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold text-slate-900">Bronchiolitis QI dashboard</h2>
        <p className="text-sm text-slate-500">Synthetic data only — trends for demonstration.</p>
      </header>
      <MetricCards metrics={metrics.cards} />
      <Charts data={metrics} />
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Encounter details</h3>
        <EncounterTable encounters={encounters} />
      </div>
    </section>
  );
};

export default DashboardPage;
