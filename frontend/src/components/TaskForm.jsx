import { useState } from 'react';

const CATEGORIES = ['Work', 'Personal', 'Finance', 'Health', 'Home', 'Other'];

export default function TaskForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    due_date: '', reminder_at: '', category: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.due_date) delete payload.due_date;
      if (!payload.reminder_at) delete payload.reminder_at;
      if (!payload.category) delete payload.category;
      if (!payload.description) delete payload.description;
      if (payload.due_date) payload.due_date = new Date(payload.due_date).toISOString();
      if (payload.reminder_at) payload.reminder_at = new Date(payload.reminder_at).toISOString();
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Due date</label>
          <input type="datetime-local" value={form.due_date} onChange={set('due_date')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Remind me at</label>
          <input type="datetime-local" value={form.reminder_at} onChange={set('reminder_at')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
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
