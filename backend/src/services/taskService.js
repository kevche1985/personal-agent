import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import * as openclawService from './openclawService.js';
import { getNextDueDate } from '../utils/recurrence.js';

export async function listTasks(filters = {}) {
  const { status, priority, category } = filters;
  const conditions = [];
  const values = [];

  if (status) { conditions.push(`status = $${values.length + 1}`); values.push(status); }
  if (priority) { conditions.push(`priority = $${values.length + 1}`); values.push(priority); }
  if (category) { conditions.push(`category = $${values.length + 1}`); values.push(category); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY is_recurring DESC, due_date ASC NULLS LAST, created_at DESC`,
    values
  );
  return rows;
}

export async function getTask(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError('Task not found', 404);
  return rows[0];
}

const RECURRENCE_FIELDS = [
  'is_recurring', 'recurrence_pattern', 'recurrence_interval',
  'recurrence_days_of_week', 'recurrence_time', 'recurrence_end_date',
];

export async function createTask(data) {
  const {
    title, description, status = 'pending', priority = 'medium',
    due_date, reminder_at, category,
    is_recurring = false, recurrence_pattern, recurrence_interval = 1,
    recurrence_days_of_week, recurrence_time, recurrence_end_date,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO tasks (
       title, description, status, priority, due_date, reminder_at, category,
       is_recurring, recurrence_pattern, recurrence_interval,
       recurrence_days_of_week, recurrence_time, recurrence_end_date
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      title, description, status, priority, due_date, reminder_at, category,
      is_recurring, recurrence_pattern || null, recurrence_interval,
      recurrence_days_of_week || null, recurrence_time || null, recurrence_end_date || null,
    ]
  );
  const task = rows[0];

  if (reminder_at) {
    const jobId = await openclawService.createCronJob(
      `task-${task.id}`, reminder_at, `⏰ Reminder: ${title}`
    );
    if (jobId) {
      await pool.query('UPDATE tasks SET openclaw_cron_job_id = $1 WHERE id = $2', [jobId, task.id]);
      task.openclaw_cron_job_id = jobId;
    }
  }
  return task;
}

export async function updateTask(id, data) {
  const existing = await getTask(id);

  const fields = [];
  const values = [];

  const allowed = [
    'title', 'description', 'status', 'priority', 'due_date', 'reminder_at',
    'category', 'google_calendar_event_id',
    ...RECURRENCE_FIELDS,
  ];

  for (const key of allowed) {
    if (key in data) {
      fields.push(`${key} = $${values.length + 1}`);
      values.push(data[key] ?? null);
    }
  }
  fields.push('updated_at = NOW()');
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values
  );
  const updated = rows[0];

  if ('reminder_at' in data) {
    if (existing.openclaw_cron_job_id) {
      await openclawService.deleteCronJob(existing.openclaw_cron_job_id);
    }
    if (data.reminder_at) {
      const jobId = await openclawService.createCronJob(
        `task-${id}`, data.reminder_at, `⏰ Reminder: ${updated.title}`
      );
      if (jobId) {
        await pool.query('UPDATE tasks SET openclaw_cron_job_id = $1 WHERE id = $2', [jobId, id]);
        updated.openclaw_cron_job_id = jobId;
      }
    } else {
      await pool.query('UPDATE tasks SET openclaw_cron_job_id = NULL WHERE id = $1', [id]);
    }
  }

  return updated;
}

export async function completeTask(id, note) {
  const task = await getTask(id);

  // Log the completion
  await pool.query(
    `INSERT INTO task_completions (task_id, due_date_completed, note)
     VALUES ($1, $2::date, $3)`,
    [id, task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : null, note || null]
  );

  if (task.is_recurring && task.recurrence_pattern) {
    const nextDue = getNextDueDate(task);
    const expired = task.recurrence_end_date && nextDue > new Date(task.recurrence_end_date);

    if (!nextDue || expired) {
      // Series has ended — mark as completed for real
      const { rows } = await pool.query(
        `UPDATE tasks SET status='completed', last_completed_at=NOW(),
          completion_count=completion_count+1, updated_at=NOW()
         WHERE id=$1 RETURNING *`,
        [id]
      );
      return { task: rows[0], next_due: null, series_ended: true };
    }

    // Advance to next occurrence
    const nextReminder = task.reminder_at
      ? new Date(nextDue.getTime() - (new Date(task.due_date) - new Date(task.reminder_at)))
      : null;

    const { rows } = await pool.query(
      `UPDATE tasks
       SET due_date=$1, reminder_at=$2, last_completed_at=NOW(),
           completion_count=completion_count+1, status='pending', updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [nextDue.toISOString(), nextReminder?.toISOString() ?? null, id]
    );

    // Re-register reminder cron job for the new date
    if (nextReminder) {
      if (task.openclaw_cron_job_id) await openclawService.deleteCronJob(task.openclaw_cron_job_id);
      const jobId = await openclawService.createCronJob(
        `task-${id}`, nextReminder.toISOString(), `⏰ Reminder: ${task.title}`
      );
      if (jobId) {
        await pool.query('UPDATE tasks SET openclaw_cron_job_id=$1 WHERE id=$2', [jobId, id]);
        rows[0].openclaw_cron_job_id = jobId;
      }
    }

    return { task: rows[0], next_due: nextDue.toISOString(), series_ended: false };
  }

  // Non-recurring: simply mark done
  const { rows } = await pool.query(
    `UPDATE tasks SET status='completed', last_completed_at=NOW(),
      completion_count=completion_count+1, updated_at=NOW()
     WHERE id=$1 RETURNING *`,
    [id]
  );

  if (task.openclaw_cron_job_id) await openclawService.deleteCronJob(task.openclaw_cron_job_id);

  return { task: rows[0], next_due: null, series_ended: false };
}

export async function getCompletionHistory(taskId, limit = 30) {
  const { rows } = await pool.query(
    `SELECT * FROM task_completions WHERE task_id=$1 ORDER BY completed_at DESC LIMIT $2`,
    [taskId, limit]
  );
  return rows;
}

export async function deleteTask(id) {
  const task = await getTask(id);
  if (task.openclaw_cron_job_id) await openclawService.deleteCronJob(task.openclaw_cron_job_id);
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed','cancelled')) AS overdue,
      COUNT(*) FILTER (WHERE is_recurring = TRUE AND status NOT IN ('completed','cancelled')) AS recurring
    FROM tasks
  `);
  return rows[0];
}
