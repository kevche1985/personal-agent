import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, DollarSign, FileText, AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { tasks as tasksApi, budget as budgetApi, statements as statementsApi } from '../api/client.js';
import { formatCents } from '../utils/formatCurrency.js';
import { statusBadge } from '../utils/formatCurrency.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState([]);
  const [recentStatements, setRecentStatements] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [taskStats, taskList, budgetSummary, stmts] = await Promise.all([
          tasksApi.stats(),
          tasksApi.list({ status: 'pending' }),
          budgetApi.summary(),
          statementsApi.list(),
        ]);
        setStats(taskStats);
        setUpcomingTasks(taskList.slice(0, 5));
        setSummary(budgetSummary);
        setRecentStatements(stmts.slice(0, 3));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-center py-16 text-gray-400">Loading dashboard…</p>;

  const overBudgetCategories = summary.filter(
    (s) => s.monthly_limit_cents && s.spent_cents > s.monthly_limit_cents
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Task stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending', value: stats?.pending || 0, color: 'yellow', icon: CheckSquare },
          { label: 'In Progress', value: stats?.in_progress || 0, color: 'blue', icon: CheckSquare },
          { label: 'Completed', value: stats?.completed || 0, color: 'green', icon: CheckSquare },
          { label: 'Overdue', value: stats?.overdue || 0, color: 'red', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <Icon size={16} className={`text-${color}-500`} />
            </div>
            <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
          </div>
        ))}
      </div>

      {overBudgetCategories.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 mb-2">
            <AlertTriangle size={15} />
            Budget Alerts
          </div>
          <div className="space-y-1">
            {overBudgetCategories.map((s) => (
              <p key={s.category} className="text-sm text-red-600">
                {s.category}: {formatCents(s.spent_cents)} spent / {formatCents(s.monthly_limit_cents)} limit
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upcoming tasks */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Upcoming Tasks</h2>
            <Link to="/tasks" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No pending tasks.</p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-900">{t.title}</p>
                    {t.due_date && <p className="text-xs text-gray-400">{new Date(t.due_date).toLocaleDateString()}</p>}
                  </div>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${statusBadge(t.status)}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Budget summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Budget This Month</h2>
            <Link to="/budget" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {summary.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No expenses this month.</p>
          ) : (
            <div className="space-y-2">
              {summary.slice(0, 6).map((s) => {
                const pct = s.monthly_limit_cents ? Math.min(100, Math.round((s.spent_cents / s.monthly_limit_cents) * 100)) : null;
                const over = s.monthly_limit_cents && s.spent_cents > s.monthly_limit_cents;
                return (
                  <div key={s.category} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 text-gray-700 truncate">{s.category}</span>
                    {pct !== null && (
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    <span className={`text-xs font-medium ${over ? 'text-red-600' : 'text-gray-700'}`}>{formatCents(s.spent_cents)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent statements */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent Statements</h2>
            <Link to="/statements" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {recentStatements.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No statements uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentStatements.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <p className="text-gray-900 truncate flex-1">{s.original_name}</p>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    s.status === 'complete' ? 'bg-green-100 text-green-700' :
                    s.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
