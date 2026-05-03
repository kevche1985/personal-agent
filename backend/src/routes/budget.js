import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/asyncWrapper.js';
import { validate } from '../middleware/validate.js';
import * as budgetService from '../services/budgetService.js';

const router = Router();

const limitSchema = z.object({
  category: z.string().min(1),
  monthly_limit_cents: z.number().int().min(0),
});

router.get('/limits', wrap(async (_req, res) => {
  const limits = await budgetService.listLimits();
  res.json(limits);
}));

router.put('/limits', validate(limitSchema), wrap(async (req, res) => {
  const limit = await budgetService.upsertLimit(req.body.category, req.body.monthly_limit_cents);
  res.json(limit);
}));

router.delete('/limits/:category', wrap(async (req, res) => {
  await budgetService.deleteLimit(req.params.category);
  res.status(204).end();
}));

router.get('/summary', wrap(async (req, res) => {
  const summary = await budgetService.getMonthSummary(req.query.month);
  res.json(summary);
}));

router.get('/categories', (_req, res) => {
  res.json(budgetService.CATEGORIES);
});

export default router;
