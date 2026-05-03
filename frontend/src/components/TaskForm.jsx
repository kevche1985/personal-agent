import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CATEGORIES = ['Work', 'Personal', 'Finance', 'Health', 'Home', 'Other'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskForm({ onSubmit, onCancel, initial = {} }) {
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    priority: initial.priority || 'medium',
    due_date: initial.due_date ? new Date(initial.due_date).toISOString().slice(0, 16) : '',
    reminder_at: initial.reminder_at ? new Date(initial.reminder_at).toISOString().slice(0, 16) : '',
    category: initial.category || '',
    is_recurring: initial.is_recurring || false,
    recurrence_pattern: initial.recurrence_pattern || 'daily',
    recurrence_interval: initial.recurrence_interval || 1,
    recurrence_days_of_week: initial.recurrence_days_of_week || [],
    recurrence_time: initial.recurrence_time || '',
    recurrence_end_date: initial.recurrence_end_date || '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setNum = (k) => (e) => setForm((p) => ({ ...p, [k]: parseInt(e.target.value) || 1 }));
  const toggle = (k) => () => setForm((p) => ({ ...p, [k]: !p[k] }));

  const toggleDay = (day) => {
    setForm((p) => {
      const days = p.recurrence_days_of_week.includes(day)
        ? p.recurrence_days_of_week.filter((d) => d !== day)
        : [...p.recurrence_days_of_week, day];
      return { ...p, recurrence_days_of_week: days };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };

      // Convert datetime-local to ISO
      if (payload.due_date) payload.due_date = new Date(payload.due_date).toISOString();
      else delete payload.due_date;

      if (payload.reminder_at) payload.reminder_at = new Date(payload.reminder_at).toISOString();
      else delete payload.reminder_at;

      if (!payload.description) delete payload.description;
      if (!payload.category) delete payload.category;

      if (!payload.is_recurring) {
        delete payload.recurrence_pattern;
        delete payload.recurrence_interval;
        delete payload.recurrence_days_of_week;
        delete payload.recurrence_time;
        delete payload.recurrence_end_date;
      } else {
        if (!payload.recurrence_time) delete payload.recurrence_time;
        if (!payload.recurrence_end_date) delete payload.recurrence_end_date;
        if (payload.recurrence_pattern !== 'weekly') delete payload.recurrence_days_of_week;
        else if (!payload.recurrence_days_of_week.length) delete payload.recurrence_days_of_week;
        payload.recurrence_interval = parseInt(payload.recurrence_interval) || 1;
      }

      await onSubmit(payload);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        required
        placeholder="Task title *"
        value={form.title}
        onChange={set('title')}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <textarea
        placeholder="Description (optional)"
        value={form.description}
        onChange={set('description')}
        rows={2}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="grid grid-cols-2 gap-3">
        <select value={form.priority} onChange={set('priority')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
        <select value={form.category} onChange={set('category')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">No category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Due date + reminder */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            {form.is_recurring ? 'First occurrence' : 'Due date'}
          </label>
          <input type="datetime-local" value={form.due_date} onChange={set('due_date')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Remind me at</label>
          <input type="datetime-local" value={form.reminder_at} onChange={set('reminder_at')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      {/* Recurrence toggle */}
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div
            onClick={toggle('is_recurring')}
            className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer ${form.is_recurring ? 'bg-violet-500' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.is_recurring ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <RefreshCw size={14} className={form.is_recurring ? 'text-violet-600' : 'text-gray-400'} />
          <span className={`text-sm font-medium ${form.is_recurring ? 'text-violet-700' : 'text-gray-500'}`}>
            Recurring task
          </span>
        </label>

        {form.is_recurring && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Repeat</label>
                <select value={form.recurrence_pattern} onChange={set('recurrence_pattern')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays (Mon–Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Every{' '}
                  {form.recurrence_pattern === 'daily' ? 'day(s)' :
                   form.recurrence_pattern === 'weekly' ? 'week(s)' :
                   form.recurrence_pattern === 'monthly' ? 'month(s)' : ''}
                </label>
                {form.recurrence_pattern !== 'weekdays' ? (
                  <input
                    type="number" min="1" max="365"
                    value={form.recurrence_interval}
                    onChange={setNum('recurrence_interval')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                ) : (
                  <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-white">Auto</div>
                )}
              </div>
            </div>

            {/* Day picker for weekly */}
            {form.recurrence_pattern === 'weekly' && (
              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Days of the week</label>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${
                        form.recurrence_days_of_week.includes(i)
                          ? 'bg-violet-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Time of day</label>
                <input type="time" value={form.recurrence_time} onChange={set('recurrence_time')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End date (optional)</label>
                <input type="date" value={form.recurrence_end_date} onChange={set('recurrence_end_date')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? 'Saving…' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
