import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/asyncWrapper.js';
import { validate } from '../middleware/validate.js';
import * as taskService from '../services/taskService.js';

const router = Router();

const recurrenceFields = {
  is_recurring: z.boolean().optional(),
  recurrence_pattern: z.enum(['daily', 'weekdays', 'weekly', 'monthly']).optional().nullable(),
  recurrence_interval: z.number().int().min(1).max(365).optional(),
  recurrence_days_of_week: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  recurrence_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
};

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  reminder_at: z.string().datetime({ offset: true }).optional().nullable(),
  category: z.string().optional(),
  ...recurrenceFields,
});

const updateSchema = createSchema.partial();

const completeSchema = z.object({
  note: z.string().optional(),
});

router.get('/', wrap(async (req, res) => {
  const tasks = await taskService.listTasks(req.query);
  res.json(tasks);
}));

router.get('/stats', wrap(async (_req, res) => {
  const stats = await taskService.getStats();
  res.json(stats);
}));

router.get('/:id', wrap(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.json(task);
}));

router.get('/:id/history', wrap(async (req, res) => {
  const history = await taskService.getCompletionHistory(req.params.id, parseInt(req.query.limit) || 30);
  res.json(history);
}));

router.post('/', validate(createSchema), wrap(async (req, res) => {
  const task = await taskService.createTask(req.body);
  res.status(201).json(task);
}));

router.patch('/:id', validate(updateSchema), wrap(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  res.json(task);
}));

router.post('/:id/complete', validate(completeSchema), wrap(async (req, res) => {
  const result = await taskService.completeTask(req.params.id, req.body.note);
  res.json(result);
}));

router.delete('/:id', wrap(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  res.status(204).end();
}));

export default router;
