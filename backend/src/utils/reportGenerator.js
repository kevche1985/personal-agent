/**
 * Template-based improvement report generator.
 * Produces the same structure as the AI report but purely from rule logic.
 * No AI required.
 */

import { centsToFloat } from './dateHelpers.js';

const RULE_DESCRIPTIONS = {
  'RULE-01': 'Duplicate subscription charge — same service billed more than once this period',
  'RULE-02': 'Possibly forgotten subscription — charged only once recently, may be unused',
  'RULE-03': 'Overlapping services — multiple subscriptions serving the same purpose',
  'RULE-04': 'High-frequency discretionary spending — consider batching or reducing',
  'RULE-05': 'Category over budget limit — spending exceeded your set limit by more than 20%',
  'RULE-06': 'Foreign-exchange fees — could be avoided with a no-FX-fee card',
  'RULE-07': 'Untracked recurring charge — not yet set up as a Payment task in the agent',
};

export function generateTemplateReport(findings, classified, budgetLimits = []) {
  const limitMap = Object.fromEntries(budgetLimits.map((l) => [l.category, l.monthly_limit_cents]));

  // Category totals from transactions
  const categoryTotals = {};
  for (const t of classified) {
    if (t.amount_cents < 0) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount_cents);
    }
  }
  const totalSpentCents = Object.values(categoryTotals).reduce((s, v) => s + v, 0);

  // Sort findings by priority then savings
  const sorted = [...findings].sort((a, b) => {
    const p = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] - p[b.priority]) || (b.estimated_monthly_savings_cents - a.estimated_monthly_savings_cents);
  });

  const totalSavingsCents = sorted.reduce((s, f) => s + (f.estimated_monthly_savings_cents || 0), 0);
  const highCount = sorted.filter((f) => f.priority === 'high').length;
  const overBudget = Object.entries(categoryTotals)
    .filter(([cat, spent]) => limitMap[cat] && spent > limitMap[cat])
    .map(([cat]) => cat);

  // Executive summary
  let executive_summary;
  if (!sorted.length) {
    executive_summary = `Your statement looks clean — no significant unnecessary expenses were detected. Total spending was $${centsToFloat(totalSpentCents).toFixed(2)}.`;
  } else {
    const topSaving = sorted[0];
    executive_summary =
      `Statement analysis found ${sorted.length} improvement area${sorted.length !== 1 ? 's' : ''} ` +
      `with estimated monthly savings of $${centsToFloat(totalSavingsCents).toFixed(2)}. ` +
      (highCount > 0
        ? `${highCount} high-priority issue${highCount !== 1 ? 's' : ''} need${highCount === 1 ? 's' : ''} attention, ` +
          `including ${topSaving.merchant} ($${centsToFloat(topSaving.estimated_monthly_savings_cents || 0).toFixed(2)}/mo). `
        : '') +
      (overBudget.length
        ? `Categories over budget: ${overBudget.join(', ')}.`
        : 'All tracked categories are within budget.');
  }

  // Top 3 recommendations
  const recommendations = sorted.slice(0, 3).map((f, i) => ({
    rank: i + 1,
    finding_id: f.id || null,
    title: buildTitle(f),
    description: buildDescription(f),
    estimated_monthly_savings_dollars: centsToFloat(f.estimated_monthly_savings_cents || 0),
  }));

  // Category comparison
  const allCategories = new Set([
    ...Object.keys(categoryTotals),
    ...Object.keys(limitMap),
  ]);
  const category_comparison = [...allCategories].sort().map((cat) => ({
    category: cat,
    statement_dollars: centsToFloat(categoryTotals[cat] || 0),
    budget_limit_dollars: limitMap[cat] ? centsToFloat(limitMap[cat]) : null,
  }));

  return { executive_summary, recommendations, category_comparison };
}

function buildTitle(finding) {
  switch (finding.rule_id) {
    case 'RULE-01': return `Cancel duplicate ${finding.merchant} charge`;
    case 'RULE-02': return `Review ${finding.merchant} subscription`;
    case 'RULE-03': return `Consolidate overlapping services: ${finding.merchant}`;
    case 'RULE-04': return `Reduce ${finding.merchant} frequency`;
    case 'RULE-05': return `Bring ${finding.merchant} spending under budget`;
    case 'RULE-06': return 'Switch to a no-FX-fee card for international purchases';
    case 'RULE-07': return `Track recurring charge: ${finding.merchant}`;
    default: return `Review ${finding.merchant}`;
  }
}

function buildDescription(finding) {
  const savings = `Save ~$${centsToFloat(finding.estimated_monthly_savings_cents || 0).toFixed(2)}/mo.`;
  switch (finding.rule_id) {
    case 'RULE-01':
      return `${finding.merchant} was charged ${finding.frequency} times this period. Cancel the duplicate or contact your bank. ${savings}`;
    case 'RULE-02':
      return `${finding.merchant} appeared only once recently — log into the service and cancel if unused. ${savings}`;
    case 'RULE-03':
      return `You're paying for ${finding.merchant} which serve overlapping needs. Pick one and cancel the rest. ${savings}`;
    case 'RULE-04':
      return `${finding.merchant} appeared ${finding.frequency} times this month. Reducing by half could save ${savings}`;
    case 'RULE-05':
      return `${finding.merchant} spending exceeded your budget limit. Review recent transactions and adjust your limit or spending. ${savings}`;
    case 'RULE-06':
      return `${finding.frequency} international transaction${finding.frequency !== 1 ? 's' : ''} incurred FX fees. A no-foreign-transaction-fee card eliminates these. ${savings}`;
    case 'RULE-07':
      return `${finding.merchant} charges recur regularly but aren't tracked as a Payment task. Add it to stay on top of this expense.`;
    default:
      return RULE_DESCRIPTIONS[finding.rule_id] || `Review this charge from ${finding.merchant}.`;
  }
}
