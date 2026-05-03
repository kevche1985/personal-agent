import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/asyncWrapper.js';
import { validate } from '../middleware/validate.js';
import { chat } from '../services/chatService.js';

const router = Router();

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1),
  })).min(1),
});

router.post('/', validate(chatSchema), wrap(async (req, res) => {
  const reply = await chat(req.body.messages);
  res.json({ reply });
}));

export default router;
