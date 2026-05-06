import { Router } from 'express';
import { wrap } from '../middleware/asyncWrapper.js';
import { uploadPDF } from '../middleware/upload.js';
import * as statementService from '../services/statementService.js';
import * as taskService from '../services/taskService.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

router.post('/upload', (req, res, next) => {
  uploadPDF(req, res, async (err) => {
    if (err) return next(err);
    if (!req.file) return next(new AppError('No file uploaded', 400));

    try {
      const result = await statementService.processStatement(req.file.path, req.file.originalname);
      res.status(202).json(result);
    } catch (e) {
      next(e);
    }
  });
});

router.get('/', wrap(async (_req, res) => {
  const statements = await statementService.listStatements();
  res.json(statements);
}));

router.get('/:id', wrap(async (req, res) => {
  const stmt = await statementService.getStatement(req.params.id);
  res.json(stmt);
}));

router.get('/:id/report', wrap(async (req, res) => {
  const report = await statementService.getReport(req.params.id);
  if (!report) throw new AppError('Report not yet available. Check statement status.', 404);
  res.json(report);
}));

router.get('/:id/transactions', wrap(async (req, res) => {
  const txns = await statementService.getTransactions(req.params.id);
  res.json(txns);
}));

router.get('/:id/findings', wrap(async (req, res) => {
  const findings = await statementService.getFindings(req.params.id);
  res.json(findings);
}));

router.patch('/transactions/:transactionId', wrap(async (req, res) => {
  const { category } = req.body;
  if (!category) throw new AppError('Provide { category }', 400);
  const txn = await statementService.reclassifyTransaction(req.params.transactionId, category);
  res.json(txn);
}));

router.patch('/findings/:findingId', wrap(async (req, res) => {
  const { action, reason } = req.body;
  const result = await statementService.updateFinding(req.params.findingId, action, reason);

  if (action === 'accept') {
    const finding = result.finding;
    const merchant = finding.merchant;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    await taskService.createTask({
      title: `Cancel ${merchant}`,
      description: `Recommended by statement analysis. Estimated monthly savings: $${((finding.estimated_monthly_savings_cents || 0) / 100).toFixed(2)}`,
      priority: finding.priority === 'high' ? 'high' : 'medium',
      due_date: dueDate.toISOString(),
      category: 'Subscriptions',
    });
  }

  res.json(result);
}));

router.get('/compare', wrap(async (req, res) => {
  const { ids } = req.query;
  if (!ids) throw new AppError('Provide ?ids=id1,id2', 400);
  const [id1, id2] = ids.split(',');
  if (!id1 || !id2) throw new AppError('Provide exactly two statement IDs', 400);
  const comparison = await statementService.compareStatements(id1, id2);
  res.json(comparison);
}));

export default router;
