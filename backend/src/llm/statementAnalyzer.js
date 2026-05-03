function savingsPriority(monthlySavingsCents) {
  if (monthlySavingsCents > 3000) return 'high';
  if (monthlySavingsCents >= 1000) return 'medium';
  return 'low';
}

export function applyDetectionRules(transactions, budgetLimits = []) {
  const findings = [];
  const subs = transactions.filter((t) => t.category === 'Subscriptions');
  const limitMap = Object.fromEntries(budgetLimits.map((l) => [l.category, l.monthly_limit_cents]));

  // RULE-01: Duplicate subscriptions (same merchant charged more than once in period)
  const merchantCounts = {};
  for (const t of subs) {
    merchantCounts[t.merchant] = (merchantCounts[t.merchant] || []);
    merchantCounts[t.merchant].push(t);
  }
  for (const [merchant, txns] of Object.entries(merchantCounts)) {
    if (txns.length > 1) {
      const totalCents = txns.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
      const savingsCents = totalCents - Math.abs(txns[0].amount_cents);
      findings.push({
        rule_id: 'RULE-01',
        merchant,
        amount_cents: totalCents,
        frequency: txns.length,
        estimated_monthly_savings_cents: savingsCents,
        priority: 'high',
      });
    }
  }

  // RULE-02: Unused subscriptions (charged only once with a long gap since last charge)
  const subMerchants = [...new Set(subs.map((t) => t.merchant))];
  for (const merchant of subMerchants) {
    const txns = subs.filter((t) => t.merchant === merchant);
    if (txns.length === 1) {
      const avgAmount = Math.abs(txns[0].amount_cents);
      findings.push({
        rule_id: 'RULE-02',
        merchant,
        amount_cents: avgAmount,
        frequency: 1,
        estimated_monthly_savings_cents: avgAmount,
        priority: savingsPriority(avgAmount),
      });
    }
  }

  // RULE-03: Overlapping subscription services
  const streamingKeywords = ['netflix', 'disney', 'hulu', 'prime video', 'apple tv', 'crave', 'paramount'];
  const cloudKeywords = ['dropbox', 'google one', 'icloud', 'onedrive'];
  const overlapping = (keywords) =>
    subs.filter((t) => keywords.some((k) => t.merchant.toLowerCase().includes(k)));

  const streamingTxns = overlapping(streamingKeywords);
  if (streamingTxns.length > 1) {
    const cheapest = Math.min(...streamingTxns.map((t) => Math.abs(t.amount_cents)));
    const total = streamingTxns.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
    findings.push({
      rule_id: 'RULE-03',
      merchant: streamingTxns.map((t) => t.merchant).join(', '),
      amount_cents: total,
      frequency: streamingTxns.length,
      estimated_monthly_savings_cents: total - cheapest,
      priority: savingsPriority(total - cheapest),
    });
  }

  const cloudTxns = overlapping(cloudKeywords);
  if (cloudTxns.length > 1) {
    const cheapest = Math.min(...cloudTxns.map((t) => Math.abs(t.amount_cents)));
    const total = cloudTxns.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
    findings.push({
      rule_id: 'RULE-03',
      merchant: cloudTxns.map((t) => t.merchant).join(', '),
      amount_cents: total,
      frequency: cloudTxns.length,
      estimated_monthly_savings_cents: total - cheapest,
      priority: savingsPriority(total - cheapest),
    });
  }

  // RULE-04: High-frequency discretionary (food delivery, coffee, convenience)
  const discretionaryKeywords = ['doordash', 'skip', 'uber eats', 'starbucks', 'tim hortons', 'mcdonald', 'convenience'];
  const discretionary = transactions.filter((t) =>
    discretionaryKeywords.some((k) => t.merchant.toLowerCase().includes(k))
  );
  if (discretionary.length > 8) {
    const total = discretionary.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
    findings.push({
      rule_id: 'RULE-04',
      merchant: 'High-frequency discretionary',
      amount_cents: total,
      frequency: discretionary.length,
      estimated_monthly_savings_cents: Math.round(total * 0.5),
      priority: savingsPriority(Math.round(total * 0.5)),
    });
  }

  // RULE-05: Above-average category spend (>20% over budget limit)
  const categoryTotals = {};
  for (const t of transactions) {
    if (t.amount_cents < 0) {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Math.abs(t.amount_cents);
    }
  }
  for (const [category, spentCents] of Object.entries(categoryTotals)) {
    const limitCents = limitMap[category];
    if (limitCents && spentCents > limitCents * 1.2) {
      const overCents = spentCents - limitCents;
      findings.push({
        rule_id: 'RULE-05',
        merchant: category,
        amount_cents: spentCents,
        frequency: null,
        estimated_monthly_savings_cents: overCents,
        priority: savingsPriority(overCents),
      });
    }
  }

  // RULE-06: International transaction fees
  const fxTxns = transactions.filter((t) =>
    t.raw_description?.toLowerCase().includes('foreign') ||
    t.raw_description?.toLowerCase().includes('fx fee') ||
    t.currency !== 'CAD'
  );
  if (fxTxns.length > 0) {
    const total = fxTxns.reduce((s, t) => s + Math.abs(t.amount_cents), 0);
    findings.push({
      rule_id: 'RULE-06',
      merchant: 'International/FX transactions',
      amount_cents: total,
      frequency: fxTxns.length,
      estimated_monthly_savings_cents: Math.round(total * 0.025),
      priority: 'low',
    });
  }

  // RULE-07: Recurring amounts not tracked as tasks
  // Flag merchants that appear consistently but aren't tagged as Subscriptions
  const nonSubRecurring = {};
  for (const t of transactions) {
    if (t.category === 'Subscriptions') continue;
    if (t.amount_cents < 0) {
      const key = `${t.merchant}:${t.amount_cents}`;
      nonSubRecurring[key] = (nonSubRecurring[key] || []);
      nonSubRecurring[key].push(t);
    }
  }
  for (const [key, txns] of Object.entries(nonSubRecurring)) {
    if (txns.length >= 2) {
      const [merchant] = key.split(':');
      const amt = Math.abs(txns[0].amount_cents);
      findings.push({
        rule_id: 'RULE-07',
        merchant,
        amount_cents: amt,
        frequency: txns.length,
        estimated_monthly_savings_cents: 0,
        priority: 'low',
      });
    }
  }

  return findings;
}
