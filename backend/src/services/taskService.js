import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import * as openclawService from './openclawService.js';

export async function listTasks(filters = {}) {
  const { status, priority, category } = filters;
  const conditions = [];
  const values = [];

  if (status) { conditions.push(`status = $${values.length + 1}`); values.push(status); }
  if (priority) { conditions.push(`priority = $${values.length + 1}`); values.push(priority); }
  if (category) { conditions.push(`category = $${values.length + 1}`); values.push(category); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY due_date ASC NULLS LAST, created_at DESC`,
    values
  );
  return rows;
}

export async function getTask(id) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError('Task not found', 404);
  return rows[0];
}

export async function createTask(data) {
  const { title, description, status = 'pending', priority = 'medium', due_date, reminder_at, category } = data;
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, status, priority, due_date, reminder_at, category)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title, description, status, priority, due_date, reminder_at, category]
  );
  const task = rows[0];

  if (reminder_at) {
    const jobId = await openclawService.createCronJob(
      `task-${task.id}`,
      reminder_at,
      `⏰ Reminder: ${title}`
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

  const allowed = ['title', 'description', 'status', 'priority', 'due_date', 'reminder_at', 'category', 'google_calendar_event_id'];
  for (const key of allowed) {
    if (key in data) {
      fields.push(`${key} = $${values.length + 1}`);
      values.push(data[key]);
    }
  }
  fields.push(`updated_at = NOW()`);
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
        `task-${id}`,
        data.reminder_at,
        `⏰ Reminder: ${updated.title}`
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

export async function deleteTask(id) {
  const task = await getTask(id);
  if (task.openclaw_cron_job_id) {
    await openclawService.deleteCronJob(task.openclaw_cron_job_id);
  }
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
}

export async function getStats() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed','cancelled')) AS overdue
    FROM tasks
  `);
  return rows[0];
}
