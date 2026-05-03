import { Router } from 'express';
import { env } from '../config/env.js';
import { wrap } from '../middleware/asyncWrapper.js';
import { handleInboundMessage } from '../services/chatService.js';
import * as openclawService from '../services/openclawService.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Webhook endpoint for OpenClaw to deliver inbound user messages
router.post('/message', wrap(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${env.OPENCLAW_HOOKS_TOKEN}`) {
    throw new AppError('Unauthorized', 401);
  }

  const { text, channel, from } = req.body;
  if (!text) throw new AppError('text is required', 400);

  const reply = await handleInboundMessage(text, channel, from);

  await openclawService.sendNotification(reply, {
    channel: channel || env.OPENCLAW_DEFAULT_CHANNEL,
    deliver: 'all',
  }).catch(() => {});

  res.json({ reply });
}));

// Health check for OpenClaw integration
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', openclaw_url: env.OPENCLAW_GATEWAY_URL });
});

export default router;
