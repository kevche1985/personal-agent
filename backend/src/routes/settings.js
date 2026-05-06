import { Router } from 'express';
import { wrap } from '../middleware/asyncWrapper.js';
import * as settingsService from '../services/settingsService.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.get('/', wrap(async (_req, res) => {
  const all = await settingsService.getAll();

  // Mask API keys in the response — only reveal whether they're set
  const sanitized = {};
  for (const [key, meta] of Object.entries(all)) {
    if (key.endsWith('_api_key')) {
      sanitized[key] = { value: meta.value ? '••••••••' : '', is_set: !!meta.value, updated_at: meta.updated_at };
    } else {
      sanitized[key] = meta;
    }
  }
  res.json(sanitized);
}));

router.put('/', wrap(async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new AppError('Body must be a key/value object', 400);
  }

  const results = await settingsService.setMany(updates);
  res.json({ updated: results.length, keys: results.map((r) => r.key) });
}));

router.put('/:key', wrap(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined) throw new AppError('Provide { value }', 400);
  const result = await settingsService.set(key, value);
  res.json(result);
}));

export default router;
