import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import type { DashboardMetrics } from "../../types";

const Charts = ({ data }: { data: DashboardMetrics }) => {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Pathway use over time</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data.run_chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" />
            <YAxis tickFormatter={(val) => `${Math.round(val * 100)}%`} domain={[0, 1]} />
            <Tooltip formatter={(value: number) => `${Math.round(value * 100)}%`} labelFormatter={(label) => `Week ${label}`} />
            <Line type="monotone" dataKey="pathway_use_rate" stroke="#0e9aa7" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Utilization snapshot</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.bar_chart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(val: number) => `${val.toFixed(0)}%`} />
            <Bar dataKey="value" fill="#3f88c5" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;
