import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { checkAndAlert } from './budgetService.js';

export async function listExpenses(filters = {}) {
  const { category, from, to, limit = 100 } = filters;
  const conditions = [];
  const values = [];

  if (category) { conditions.push(`category = $${values.length + 1}`); values.push(category); }
  if (from) { conditions.push(`expense_date >= $${values.length + 1}`); values.push(from); }
  if (to) { conditions.push(`expense_date <= $${values.length + 1}`); values.push(to); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit);

  const { rows } = await pool.query(
    `SELECT * FROM expenses ${where} ORDER BY expense_date DESC LIMIT $${values.length}`,
    values
  );
  return rows;
}

export async function getExpense(id) {
  const { rows } = await pool.query('SELECT * FROM expenses WHERE id = $1', [id]);
  if (!rows[0]) throw new AppError('Expense not found', 404);
  return rows[0];
}

export async function createExpense(data) {
  const { category, amount_cents, merchant, description, expense_date, source = 'manual', statement_transaction_id } = data;
  const { rows } = await pool.query(
    `INSERT INTO expenses (category, amount_cents, merchant, description, expense_date, source, statement_transaction_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [category, amount_cents, merchant, description, expense_date, source, statement_transaction_id]
  );
  const expense = rows[0];
  await checkAndAlert(category).catch(() => {});
  return expense;
}

export async function deleteExpense(id) {
  await getExpense(id);
  await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
}

export async function getMonthlyTotals(year) {
  const y = year || new Date().getFullYear();
  const { rows } = await pool.query(`
    SELECT
      date_trunc('month', expense_date)::date AS month,
      category,
      SUM(amount_cents) AS total_cents
    FROM expenses
    WHERE EXTRACT(YEAR FROM expense_date) = $1
    GROUP BY 1, 2
    ORDER BY 1, 2
  `, [y]);
  return rows;
}
