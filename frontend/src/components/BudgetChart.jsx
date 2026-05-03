import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { formatCents } from '../utils/formatCurrency.js';

export default function BudgetChart({ summary }) {
  const data = summary.map((s) => ({
    name: s.category.split(' ')[0],
    spent: (s.spent_cents || 0) / 100,
    limit: (s.monthly_limit_cents || 0) / 100,
    over: s.monthly_limit_cents && s.spent_cents > s.monthly_limit_cents,
  }));

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
          <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
          <Bar dataKey="spent" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.over ? '#ef4444' : '#0ea5e9'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
