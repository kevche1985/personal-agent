import { statusBadge } from '../utils/formatCurrency.js';
import { CheckCircle, Trash2, Clock, RefreshCw } from 'lucide-react';

const RECURRENCE_LABEL = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function TaskCard({ task, onComplete, onDelete }) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

  return (
    <div className={`bg-white rounded-lg border p-4 flex items-start gap-3 ${isOverdue ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(task.status)}`}>
            {task.status.replace('_', ' ')}
          </span>
          {task.priority === 'high' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">high</span>
          )}
          {task.is_recurring && task.recurrence_pattern && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
              <RefreshCw size={10} />
              {RECURRENCE_LABEL[task.recurrence_pattern] || 'Recurring'}
              {task.recurrence_interval > 1 ? ` ×${task.recurrence_interval}` : ''}
            </span>
          )}
        </div>
        <p className="mt-1 font-medium text-gray-900 truncate">{task.title}</p>
        {task.description && <p className="text-sm text-gray-500 truncate">{task.description}</p>}
        <div className="flex items-center gap-3 mt-1">
          {task.due_date && (
            <p className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              <Clock size={12} />
              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {task.recurrence_time && ` · ${task.recurrence_time}`}
              {isOverdue && ' · Overdue'}
            </p>
          )}
          {task.is_recurring && task.completion_count > 0 && (
            <p className="text-xs text-gray-400">
              ✓ {task.completion_count}× completed
            </p>
          )}
          {task.last_completed_at && task.is_recurring && (
            <p className="text-xs text-gray-400">
              Last: {new Date(task.last_completed_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {task.status !== 'completed' && (
          <button
            onClick={() => onComplete(task.id)}
            className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
            title={task.is_recurring ? 'Mark done (advances to next occurrence)' : 'Mark complete'}
          >
            <CheckCircle size={18} />
          </button>
        )}
        <button
          onClick={() => onDelete(task.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
