export function getNextDueDate(task) {
  if (!task.is_recurring || !task.recurrence_pattern) return null;

  const base = task.due_date ? new Date(task.due_date) : new Date();
  const interval = task.recurrence_interval || 1;

  switch (task.recurrence_pattern) {
    case 'daily': {
      base.setDate(base.getDate() + interval);
      break;
    }
    case 'weekdays': {
      // advance at least 1 day, then skip over Sat/Sun
      base.setDate(base.getDate() + 1);
      while (base.getDay() === 0 || base.getDay() === 6) {
        base.setDate(base.getDate() + 1);
      }
      break;
    }
    case 'weekly': {
      if (task.recurrence_days_of_week?.length) {
        // find next matching weekday after today
        const today = base.getDay();
        const sorted = [...task.recurrence_days_of_week].sort((a, b) => a - b);
        const next = sorted.find((d) => d > today) ?? sorted[0];
        const daysAhead = next > today ? next - today : 7 - today + next;
        base.setDate(base.getDate() + daysAhead);
      } else {
        base.setDate(base.getDate() + 7 * interval);
      }
      break;
    }
    case 'monthly': {
      base.setMonth(base.getMonth() + interval);
      break;
    }
    default:
      return null;
  }

  // preserve the recurrence_time if set
  if (task.recurrence_time) {
    const [hh, mm] = task.recurrence_time.split(':').map(Number);
    base.setHours(hh, mm, 0, 0);
  }

  return base;
}

export function recurrenceLabel(task) {
  if (!task.is_recurring) return null;
  const interval = task.recurrence_interval || 1;
  const map = {
    daily: interval === 1 ? 'Daily' : `Every ${interval} days`,
    weekdays: 'Weekdays',
    weekly: interval === 1 ? 'Weekly' : `Every ${interval} weeks`,
    monthly: interval === 1 ? 'Monthly' : `Every ${interval} months`,
  };
  return map[task.recurrence_pattern] ?? 'Recurring';
}
