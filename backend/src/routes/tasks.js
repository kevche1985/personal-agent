import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/asyncWrapper.js';
import { validate } from '../middleware/validate.js';
import * as taskService from '../services/taskService.js';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().datetime({ offset: true }).optional().nullable(),
  reminder_at: z.string().datetime({ offset: true }).optional().nullable(),
  category: z.string().optional(),
});

const updateSchema = createSchema.partial();

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

router.post('/', validate(createSchema), wrap(async (req, res) => {
  const task = await taskService.createTask(req.body);
  res.status(201).json(task);
}));

router.patch('/:id', validate(updateSchema), wrap(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  res.json(task);
}));

router.delete('/:id', wrap(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  res.status(204).end();
}));

export default router;
