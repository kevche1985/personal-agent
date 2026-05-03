import { Router } from 'express';
import { wrap } from '../middleware/asyncWrapper.js';
import * as calendarService from '../services/calendarService.js';

const router = Router();

router.get('/auth', (_req, res) => {
  const url = calendarService.getAuthUrl();
  res.json({ url });
});

router.get('/callback', wrap(async (req, res) => {
  const { code } = req.query;
  await calendarService.exchangeCode(code);
  res.redirect('/?calendarConnected=true');
}));

router.get('/events', wrap(async (req, res) => {
  const events = await calendarService.listUpcomingEvents(parseInt(req.query.limit) || 10);
  res.json(events);
}));

export default router;
