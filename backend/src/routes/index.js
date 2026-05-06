import { Router } from 'express';
import tasksRouter from './tasks.js';
import budgetRouter from './budget.js';
import expensesRouter from './expenses.js';
import statementsRouter from './statements.js';
import chatRouter from './chat.js';
import calendarRouter from './calendar.js';
import agentRouter from './agent.js';
import settingsRouter from './settings.js';

const router = Router();

router.use('/tasks', tasksRouter);
router.use('/budget', budgetRouter);
router.use('/expenses', expensesRouter);
router.use('/statements', statementsRouter);
router.use('/chat', chatRouter);
router.use('/calendar', calendarRouter);
router.use('/agent', agentRouter);
router.use('/settings', settingsRouter);

router.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

export default router;
