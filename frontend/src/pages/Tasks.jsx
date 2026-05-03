import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import TaskCard from '../components/TaskCard.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { tasks as tasksApi } from '../api/client.js';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function Tasks() {
  const [taskList, setTaskList] = useState([]);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.list(filter ? { status: filter } : {});
      setTaskList(data);
    } catch {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data) => {
    await tasksApi.create(data);
    setShowForm(false);
    load();
  };

  const handleComplete = async (id) => {
    try {
      const result = await tasksApi.complete(id);
      if (result.next_due) {
        showToast(`Done! ✓  Next: ${new Date(result.next_due).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`);
      } else {
        showToast('Task completed!');
      }
      load();
    } catch {
      showToast('Failed to complete task', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this task?')) return;
    await tasksApi.delete(id);
    load();
  };

  const recurringTasks = taskList.filter((t) => t.is_recurring && t.status !== 'completed');
  const regularTasks = taskList.filter((t) => !t.is_recurring || t.status === 'completed');

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-900 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700"
        >
          <Plus size={16} />
          New Task
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Create Task</h2>
          <TaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === value ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-8">Loading…</p>}
      {error && <p className="text-sm text-red-500 text-center py-8">{error}</p>}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Recurring section */}
          {recurringTasks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={13} className="text-violet-500" />
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Recurring</span>
              </div>
              <div className="space-y-2">
                {recurringTasks.map((t) => (
                  <TaskCard key={t.id} task={t} onComplete={handleComplete} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {/* Regular tasks */}
          {regularTasks.length > 0 && (
            <div>
              {recurringTasks.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">One-time</span>
                </div>
              )}
              <div className="space-y-2">
                {regularTasks.map((t) => (
                  <TaskCard key={t.id} task={t} onComplete={handleComplete} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          )}

          {taskList.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">No tasks found.</p>
          )}
        </div>
      )}
    </div>
  );
}
