import pdfParse from 'pdf-parse';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { pool, withTransaction } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { applyDetectionRules } from '../llm/statementAnalyzer.js';
import { floatToCents } from '../utils/dateHelpers.js';
import { listLimits } from './budgetService.js';
import * as openclawService from './openclawService.js';
import { isLikelyTextBasedPdf } from '../utils/statementText.js';
import { parseStatementText } from '../utils/statementParser.js';
import { classifyTransactions } from '../utils/merchantClassifier.js';
import { generateTemplateReport } from '../utils/reportGenerator.js';

// ─── Core pipeline (no AI required) ─────────────────────────────────────────

async function extractTransactions(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);

  if (!isLikelyTextBasedPdf(data.text, data.numpages)) {
    throw new AppError(
      'This PDF appears to be image-based. Please upload a text-based statement.',
      422
    );
  }

  const text = String(data.text || '').trim();
  const transactions = parseStatementText(text);

  if (transactions.length === 0) {
    throw new AppError(
      'No transactions found in this PDF. The format may not be supported yet.',
      422
    );
  }

  return transactions.map((t) => ({
    ...t,
    amount_cents: floatToCents(t.amount),
  }));
}

function applyClassification(transactions) {
  return classifyTransactions(transactions).map((t) => ({
    ...t,
    // merchantClassifier returns { category, confidence, sub_tag? }
    classification_confidence: t.confidence || 'high',
  }));
}

async function persistAndReport(statementId, classified, limits) {
  const findings = applyDetectionRules(classified, limits);

  await withTransaction(async (client) => {
    for (const t of classified) {
      await client.query(
        `INSERT INTO statement_transactions
         (statement_id, date, merchant, raw_description, amount_cents, currency,
          category, classification_confidence)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          statementId, t.date, t.merchant, t.raw_description || t.merchant,
          t.amount_cents, t.currency || 'CAD', t.category,
          t.classification_confidence || 'high',
        ]
      );
    }

    for (const f of findings) {
      await client.query(
        `INSERT INTO statement_findings
         (statement_id, rule_id, merchant, amount_cents, frequency,
          estimated_monthly_savings_cents, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          statementId, f.rule_id, f.merchant, f.amount_cents, f.frequency,
          f.estimated_monthly_savings_cents, f.priority,
        ]
      );
    }

    const totalDebitCents = classified
      .filter((t) => t.amount_cents < 0)
      .reduce((s, t) => s + Math.abs(t.amount_cents), 0);

    await client.query(
      `UPDATE statements
       SET status='complete', total_transactions=$1, total_amount_cents=$2, processed_at=NOW()
       WHERE id=$3`,
      [classified.length, totalDebitCents, statementId]
    );
  });

  // Fetch persisted findings (they now have UUIDs)
  const { rows: savedFindings } = await pool.query(
    `SELECT * FROM statement_findings WHERE statement_id=$1`, [statementId]
  );

  const report = generateTemplateReport(savedFindings, classified, limits);

  const { rows } = await pool.query(
    `INSERT INTO statement_reports
       (statement_id, executive_summary, recommendations_json, category_comparison_json)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [
      statementId,
      report.executive_summary,
      JSON.stringify(report.recommendations),
      JSON.stringify(report.category_comparison),
    ]
  );

  return { report: rows[0], findings: savedFindings };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function processStatement(filePath, originalName) {
  const pdfBuffer = await readFile(filePath);
  const filename = filePath.split('/').pop();

  const { rows: [stmt] } = await pool.query(
    `INSERT INTO statements (filename, original_name, status)
     VALUES ($1,$2,'processing') RETURNING *`,
    [filename, originalName]
  );

  try {
    const rawTransactions = await extractTransactions(pdfBuffer);
    const classified = applyClassification(rawTransactions);
    const limits = await listLimits();
    const { findings } = await persistAndReport(stmt.id, classified, limits);

    const totalSavingsCents = findings.reduce((s, f) => s + (f.estimated_monthly_savings_cents || 0), 0);
    const topFinding = [...findings].sort(
      (a, b) => (b.estimated_monthly_savings_cents || 0) - (a.estimated_monthly_savings_cents || 0)
    )[0];

    await openclawService.sendAlert('statement_complete', {
      finding_count: findings.length,
      total_savings_cents: totalSavingsCents,
      top_finding: topFinding?.merchant,
      report_url: `/statements/${stmt.id}/report`,
    }).catch(() => {});

    logger.info({ statementId: stmt.id, transactions: classified.length, findings: findings.length }, 'Statement processed');
    return { statementId: stmt.id, findings: findings.length, totalSavingsCents };
  } catch (err) {
    await pool.query(
      `UPDATE statements SET status='error', error_message=$1 WHERE id=$2`,
      [err.message, stmt.id]
    );
    throw err;
  }
}

export async function listStatements() {
  const { rows } = await pool.query('SELECT * FROM statements ORDER BY uploaded_at DESC');
  return rows;
}

export async function getStatement(id) {
  const { rows } = await pool.query('SELECT * FROM statements WHERE id=$1', [id]);
  if (!rows[0]) throw new AppError('Statement not found', 404);
  return rows[0];
}

export async function getReport(statementId) {
  const { rows } = await pool.query(
    'SELECT * FROM statement_reports WHERE statement_id=$1', [statementId]
  );
  return rows[0] || null;
}

export async function getTransactions(statementId) {
  const { rows } = await pool.query(
    'SELECT * FROM statement_transactions WHERE statement_id=$1 ORDER BY date DESC',
    [statementId]
  );
  return rows;
}

export async function getFindings(statementId) {
  const { rows } = await pool.query(
    `SELECT * FROM statement_findings WHERE statement_id=$1
     ORDER BY
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       estimated_monthly_savings_cents DESC`,
    [statementId]
  );
  return rows;
}

export async function reclassifyTransaction(transactionId, newCategory) {
  const { rows } = await pool.query(
    `UPDATE statement_transactions
     SET user_override_category=$1, category=$1
     WHERE id=$2 RETURNING *`,
    [newCategory, transactionId]
  );
  if (!rows[0]) throw new AppError('Transaction not found', 404);
  return rows[0];
}

export async function updateFinding(findingId, action, reason) {
  const { rows } = await pool.query('SELECT * FROM statement_findings WHERE id=$1', [findingId]);
  if (!rows[0]) throw new AppError('Finding not found', 404);

  if (action === 'accept') {
    await pool.query('UPDATE statement_findings SET status=$1 WHERE id=$2', ['accepted', findingId]);
    return { status: 'accepted', finding: rows[0] };
  }

  if (action === 'dismiss') {
    const dismissedUntil = new Date();
    dismissedUntil.setDate(dismissedUntil.getDate() + 90);
    await pool.query(
      `UPDATE statement_findings
       SET status=$1, dismissed_reason=$2, dismissed_until=$3
       WHERE id=$4`,
      ['dismissed', reason, dismissedUntil.toISOString().slice(0, 10), findingId]
    );
    return { status: 'dismissed', finding: rows[0] };
  }

  throw new AppError('Invalid action. Use "accept" or "dismiss"', 400);
}

export async function compareStatements(id1, id2) {
  async function getCategoryTotals(stmtId) {
    const { rows } = await pool.query(
      `SELECT category, SUM(ABS(amount_cents)) AS total_cents
       FROM statement_transactions WHERE statement_id=$1 AND amount_cents < 0
       GROUP BY category`,
      [stmtId]
    );
    return Object.fromEntries(rows.map((r) => [r.category, parseInt(r.total_cents)]));
  }

  const [totals1, totals2] = await Promise.all([getCategoryTotals(id1), getCategoryTotals(id2)]);
  const allCategories = new Set([...Object.keys(totals1), ...Object.keys(totals2)]);

  const comparison = [];
  for (const cat of allCategories) {
    const t1 = totals1[cat] || 0;
    const t2 = totals2[cat] || 0;
    comparison.push({ category: cat, period1_cents: t1, period2_cents: t2, delta_cents: t2 - t1 });
  }

  const total1 = Object.values(totals1).reduce((s, v) => s + v, 0);
  const total2 = Object.values(totals2).reduce((s, v) => s + v, 0);
  const deltaPercent = total1 > 0 ? ((total2 - total1) / total1) * 100 : 0;

  if (deltaPercent > 10) {
    const topIncrease = [...comparison].sort((a, b) => b.delta_cents - a.delta_cents)[0];
    await openclawService.sendAlert('spend_increase', {
      month: 'Current Period',
      prev_month: 'Previous Period',
      delta_cents: total2 - total1,
      percent: Math.round(deltaPercent),
      top_category: `${topIncrease.category} (+$${(topIncrease.delta_cents / 100).toFixed(2)})`,
    }).catch(() => {});
  }

  return { comparison, total1_cents: total1, total2_cents: total2, delta_percent: deltaPercent };
}

export async function purgeOldPDFs(uploadDir, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const { rows } = await pool.query(
    `SELECT filename FROM statements WHERE uploaded_at < to_timestamp($1 / 1000.0)`,
    [cutoff]
  );
  for (const { filename } of rows) {
    await unlink(join(uploadDir, filename)).catch(() => {});
  }
  logger.info({ count: rows.length }, 'Purged old PDF files');
}
