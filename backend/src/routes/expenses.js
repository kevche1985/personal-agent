import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/asyncWrapper.js';
import { validate } from '../middleware/validate.js';
import * as expenseService from '../services/expenseService.js';

const router = Router();

const createSchema = z.object({
  category: z.string().min(1),
  amount_cents: z.number().int().min(1),
  merchant: z.string().optional(),
  description: z.string().optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['manual', 'statement_import']).optional(),
});

router.get('/', wrap(async (req, res) => {
  const expenses = await expenseService.listExpenses(req.query);
  res.json(expenses);
}));

router.get('/monthly-totals', wrap(async (req, res) => {
  const totals = await expenseService.getMonthlyTotals(req.query.year);
  res.json(totals);
}));

router.get('/:id', wrap(async (req, res) => {
  const expense = await expenseService.getExpense(req.params.id);
  res.json(expense);
}));

router.post('/', validate(createSchema), wrap(async (req, res) => {
  const expense = await expenseService.createExpense(req.body);
  res.status(201).json(expense);
}));

router.delete('/:id', wrap(async (req, res) => {
  await expenseService.deleteExpense(req.params.id);
  res.status(204).end();
}));

export default router;
