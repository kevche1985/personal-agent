import pdfParse from 'pdf-parse';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { pool, withTransaction } from '../config/db.js';
import { anthropic, MODEL } from '../config/anthropic.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { applyDetectionRules } from '../llm/statementAnalyzer.js';
import { STATEMENT_EXTRACT_PROMPT, CLASSIFY_PROMPT, REPORT_PROMPT } from '../llm/prompts.js';
import { floatToCents } from '../utils/dateHelpers.js';
import { listLimits } from './budgetService.js';
import * as openclawService from './openclawService.js';

async function callClaude(messages, maxTokens = 1500) {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages,
    });
    return response.content[0].text;
  } catch (err) {
    if (err.status === 429) throw new AppError('AI service rate limited. Please try again in a moment.', 429);
    if (err.status === 400) throw new AppError('AI context length exceeded. PDF may be too large.', 400);
    throw new AppError('AI service error: ' + err.message, 502);
  }
}

async function extractTransactions(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);

  if (data.text.length < 50 * (data.numpages || 1)) {
    throw new AppError(
      'This PDF appears to be image-based. Please upload a text-based statement.',
      422
    );
  }

  const rawJson = await callClaude([
    { role: 'user', content: STATEMENT_EXTRACT_PROMPT + data.text.slice(0, 30000) },
  ]);

  let transactions;
  try {
    const jsonStr = rawJson.match(/\[[\s\S]*\]/)?.[0] || rawJson;
    transactions = JSON.parse(jsonStr);
  } catch {
    throw new AppError('Failed to parse transactions from PDF. Please check the file.', 422);
  }

  return transactions.map((t) => ({
    ...t,
    amount_cents: floatToCents(t.amount),
  }));
}

async function classifyTransactions(transactions) {
  const merchants = [...new Set(transactions.map((t) => t.merchant))];
  const classified = [];

  for (let i = 0; i < merchants.length; i += 50) {
    const batch = merchants.slice(i, i + 50);
    const rawJson = await callClaude([
      { role: 'user', content: CLASSIFY_PROMPT(batch) },
    ]);

    let map;
    try {
      map = JSON.parse(rawJson.match(/\{[\s\S]*\}/)?.[0] || rawJson);
    } catch {
      map = {};
    }

    for (const merchant of batch) {
      classified.push({ merchant, ...(map[merchant] || { category: 'Other', confidence: 'low' }) });
    }
  }

  const classMap = Object.fromEntries(classified.map((c) => [c.merchant, c]));
  return transactions.map((t) => ({
    ...t,
    category: classMap[t.merchant]?.category || 'Other',
    classification_confidence: classMap[t.merchant]?.confidence || 'low',
  }));
}

async function generateReport(statementId, findings, classified, limits) {
  const categoryTotals = {};
  for (const t of classified) {
    if (t.amount_cents < 0) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount_cents);
    }
  }

  const stats = {
    total_transactions: classified.length,
    total_debits_cents: Object.values(categoryTotals).reduce((s, v) => s + v, 0),
    category_totals: categoryTotals,
  };

  const limitMap = Object.fromEntries(limits.map((l) => [l.category, l.monthly_limit_cents]));
  const statsForReport = {
    ...stats,
    budget_limits: limitMap,
  };

  const findingsWithIds = findings.map((f, i) => ({ id: `f${i + 1}`, ...f }));

  const rawJson = await callClaude(
    [{ role: 'user', content: REPORT_PROMPT(findingsWithIds, statsForReport) }],
    800
  );

  let report;
  try {
    report = JSON.parse(rawJson.match(/\{[\s\S]*\}/)?.[0] || rawJson);
  } catch {
    report = { executive_summary: rawJson, recommendations: [], category_comparison: [] };
  }

  const { rows } = await pool.query(
    `INSERT INTO statement_reports (statement_id, executive_summary, recommendations_json, category_comparison_json)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [statementId, report.executive_summary, JSON.stringify(report.recommendations), JSON.stringify(report.category_comparison)]
  );

  return rows[0];
}

export async function processStatement(filePath, originalName) {
  const pdfBuffer = await readFile(filePath);
  const filename = filePath.split('/').pop();

  const { rows: [stmt] } = await pool.query(
    `INSERT INTO statements (filename, original_name, status) VALUES ($1,$2,'processing') RETURNING *`,
    [filename, originalName]
  );

  try {
    const rawTransactions = await extractTransactions(pdfBuffer);
    const classified = await classifyTransactions(rawTransactions);
    const limits = await listLimits();

    const findings = applyDetectionRules(classified, limits);

    await withTransaction(async (client) => {
      for (const t of classified) {
        await client.query(
          `INSERT INTO statement_transactions
           (statement_id, date, merchant, raw_description, amount_cents, currency, category, classification_confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [stmt.id, t.date, t.merchant, t.raw_description || t.merchant, t.amount_cents, t.currency || 'CAD', t.category, t.classification_confidence]
        );
      }

      for (const f of findings) {
        await client.query(
          `INSERT INTO statement_findings
           (statement_id, rule_id, merchant, amount_cents, frequency, estimated_monthly_savings_cents, priority)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [stmt.id, f.rule_id, f.merchant, f.amount_cents, f.frequency, f.estimated_monthly_savings_cents, f.priority]
        );
      }

      const totalDebitCents = classified
        .filter((t) => t.amount_cents < 0)
        .reduce((s, t) => s + Math.abs(t.amount_cents), 0);

      await client.query(
        `UPDATE statements SET status='complete', total_transactions=$1, total_amount_cents=$2, processed_at=NOW() WHERE id=$3`,
        [classified.length, totalDebitCents, stmt.id]
      );
    });

    const report = await generateReport(stmt.id, findings, classified, limits);

    const totalSavingsCents = findings.reduce((s, f) => s + (f.estimated_monthly_savings_cents || 0), 0);
    const topFinding = findings.sort((a, b) => (b.estimated_monthly_savings_cents || 0) - (a.estimated_monthly_savings_cents || 0))[0];

    await openclawService.sendAlert('statement_complete', {
      finding_count: findings.length,
      total_savings_cents: totalSavingsCents,
      top_finding: topFinding?.merchant,
      report_url: `/statements/${stmt.id}/report`,
    }).catch(() => {});

    return { statementId: stmt.id, findings: findings.length, totalSavingsCents };
  } catch (err) {
    await pool.query(`UPDATE statements SET status='error', error_message=$1 WHERE id=$2`, [err.message, stmt.id]);
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
  const { rows } = await pool.query('SELECT * FROM statement_reports WHERE statement_id=$1', [statementId]);
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
    'SELECT * FROM statement_findings WHERE statement_id=$1 ORDER BY priority DESC, estimated_monthly_savings_cents DESC',
    [statementId]
  );
  return rows;
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
      'UPDATE statement_findings SET status=$1, dismissed_reason=$2, dismissed_until=$3 WHERE id=$4',
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
    return Object.fromEntries(rows.map((r) => [r.category, r.total_cents]));
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
    const topIncrease = comparison.sort((a, b) => b.delta_cents - a.delta_cents)[0];
    await openclawService.sendAlert('spend_increase', {
      month: 'Current Period',
      prev_month: 'Previous Period',
      delta_cents: total2 - total1,
      percent: Math.round(deltaPercent),
      top_category: `${topIncrease.category} (+$${((topIncrease.delta_cents) / 100).toFixed(2)})`,
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
