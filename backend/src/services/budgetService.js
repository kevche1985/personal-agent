import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import * as openclawService from './openclawService.js';
import { startOfMonth } from '../utils/dateHelpers.js';

export const CATEGORIES = [
  'Housing', 'Food & Groceries', 'Transport', 'Insurance', 'Health',
  'Subscriptions', 'Entertainment', 'Remittances', 'Education',
  'Debt Payments', 'Savings', 'Other'
];

export async function listLimits() {
  const { rows } = await pool.query('SELECT * FROM budget_limits ORDER BY category');
  return rows;
}

export async function upsertLimit(category, monthly_limit_cents) {
  const { rows } = await pool.query(
    `INSERT INTO budget_limits (category, monthly_limit_cents)
     VALUES ($1, $2)
     ON CONFLICT (category) DO UPDATE SET monthly_limit_cents = $2, updated_at = NOW()
     RETURNING *`,
    [category, monthly_limit_cents]
  );
  return rows[0];
}

export async function deleteLimit(category) {
  await pool.query('DELETE FROM budget_limits WHERE category = $1', [category]);
}

export async function getMonthSummary(month) {
  const monthStart = new Date(month || startOfMonth());
  const monthStr = monthStart.toISOString().slice(0, 7) + '-01';

  const { rows } = await pool.query(`
    SELECT
      e.category,
      SUM(e.amount_cents) AS spent_cents,
      bl.monthly_limit_cents
    FROM expenses e
    LEFT JOIN budget_limits bl ON bl.category = e.category
    WHERE date_trunc('month', e.expense_date) = date_trunc('month', $1::date)
    GROUP BY e.category, bl.monthly_limit_cents
    ORDER BY e.category
  `, [monthStr]);

  return rows;
}

export async function checkAndAlert(category) {
  const { rows: [limit] } = await pool.query(
    'SELECT monthly_limit_cents FROM budget_limits WHERE category = $1', [category]
  );
  if (!limit) return;

  const monthStr = startOfMonth().toISOString().slice(0, 7) + '-01';
  const { rows: [{ total }] } = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM expenses
     WHERE category = $1 AND date_trunc('month', expense_date) = date_trunc('month', $2::date)`,
    [category, monthStr]
  );

  const pct = (total / limit.monthly_limit_cents) * 100;

  if (pct >= 100) {
    const existing = await pool.query(
      `SELECT id FROM budget_alerts WHERE category = $1 AND level = 'exceeded'
       AND date_trunc('month', alert_month) = date_trunc('month', NOW())`,
      [category]
    );
    if (!existing.rows.length) {
      await pool.query(
        `INSERT INTO budget_alerts (category, level, amount_cents, limit_cents, alert_month)
         VALUES ($1, 'exceeded', $2, $3, date_trunc('month', NOW()))`,
        [category, total, limit.monthly_limit_cents]
      );
      await openclawService.sendAlert('budget_exceeded', {
        category, amount_cents: total, limit_cents: limit.monthly_limit_cents, percent: Math.round(pct)
      });
    }
  } else if (pct >= 75) {
    const existing = await pool.query(
      `SELECT id FROM budget_alerts WHERE category = $1 AND level = 'warning'
       AND date_trunc('month', alert_month) = date_trunc('month', NOW())`,
      [category]
    );
    if (!existing.rows.length) {
      await pool.query(
        `INSERT INTO budget_alerts (category, level, amount_cents, limit_cents, alert_month)
         VALUES ($1, 'warning', $2, $3, date_trunc('month', NOW()))`,
        [category, total, limit.monthly_limit_cents]
      );
      await openclawService.sendAlert('budget_warning', {
        category, amount_cents: total, limit_cents: limit.monthly_limit_cents, percent: Math.round(pct)
      });
    }
  }
}
