import type { DashboardMetrics } from "../../types";

const MetricCards = ({ metrics }: { metrics: DashboardMetrics["cards"] }) => {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {metrics.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{card.description}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</p>
          <p className="text-sm text-slate-600">{card.label}</p>
        </div>
      ))}
    </div>
  );
};

export default MetricCards;
