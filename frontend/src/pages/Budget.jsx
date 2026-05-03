import { useState, useEffect } from 'react';
import { PlusCircle, Trash2, DollarSign } from 'lucide-react';
import BudgetChart from '../components/BudgetChart.jsx';
import { budget as budgetApi, expenses as expensesApi } from '../api/client.js';
import { formatCents } from '../utils/formatCurrency.js';

export default function Budget() {
  const [summary, setSummary] = useState([]);
  const [limits, setLimits] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [newLimit, setNewLimit] = useState({ category: '', amount: '' });
  const [newExpense, setNewExpense] = useState({ category: '', amount: '', merchant: '', date: new Date().toISOString().slice(0, 10) });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l, e, c] = await Promise.all([
        budgetApi.summary(),
        budgetApi.limits(),
        expensesApi.list({ limit: 20 }),
        budgetApi.categories(),
      ]);
      setSummary(s);
      setLimits(l);
      setRecentExpenses(e);
      setCategories(c);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSetLimit = async (e) => {
    e.preventDefault();
    if (!newLimit.category || !newLimit.amount) return;
    await budgetApi.setLimit({ category: newLimit.category, monthly_limit_cents: Math.round(parseFloat(newLimit.amount) * 100) });
    setNewLimit({ category: '', amount: '' });
    load();
  };

  const handleLogExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.category || !newExpense.amount) return;
    await expensesApi.create({
      category: newExpense.category,
      amount_cents: Math.round(parseFloat(newExpense.amount) * 100),
      merchant: newExpense.merchant || undefined,
      expense_date: newExpense.date,
    });
    setNewExpense({ category: '', amount: '', merchant: '', date: new Date().toISOString().slice(0, 10) });
    load();
  };

  if (loading) return <p className="text-center py-16 text-gray-400">Loading…</p>;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Budget & Expenses</h1>

      {summary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">This Month</h2>
          <BudgetChart summary={summary} />
          <div className="mt-4 divide-y divide-gray-100">
            {summary.map((s) => {
              const pct = s.monthly_limit_cents ? Math.min(100, Math.round((s.spent_cents / s.monthly_limit_cents) * 100)) : null;
              const over = s.monthly_limit_cents && s.spent_cents > s.monthly_limit_cents;
              return (
                <div key={s.category} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.category}</span>
                  <div className="flex items-center gap-3">
                    <span className={over ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {formatCents(s.spent_cents)}
                    </span>
                    {s.monthly_limit_cents && (
                      <span className="text-gray-400 text-xs">/ {formatCents(s.monthly_limit_cents)}</span>
                    )}
                    {pct !== null && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Set Budget Limit</h2>
          <form onSubmit={handleSetLimit} className="space-y-2">
            <select value={newLimit.category} onChange={(e) => setNewLimit((p) => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              type="number" step="0.01" min="0" placeholder="Monthly limit ($)"
              value={newLimit.amount} onChange={(e) => setNewLimit((p) => ({ ...p, amount: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
              Save Limit
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Log Expense</h2>
          <form onSubmit={handleLogExpense} className="space-y-2">
            <select value={newExpense.category} onChange={(e) => setNewExpense((p) => ({ ...p, category: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input
              type="number" step="0.01" min="0.01" placeholder="Amount ($)" required
              value={newExpense.amount} onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              placeholder="Merchant (optional)"
              value={newExpense.merchant} onChange={(e) => setNewExpense((p) => ({ ...p, merchant: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="date" value={newExpense.date} onChange={(e) => setNewExpense((p) => ({ ...p, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700">
              Log Expense
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Expenses</h2>
        {recentExpenses.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No expenses logged yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentExpenses.map((e) => (
              <div key={e.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-700">{e.merchant || e.description || e.category}</span>
                  <span className="ml-2 text-xs text-gray-400">{e.category} · {e.expense_date}</span>
                </div>
                <span className="font-medium text-gray-900">{formatCents(e.amount_cents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
