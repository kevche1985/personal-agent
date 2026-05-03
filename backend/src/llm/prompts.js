export const SYSTEM_PROMPT = `You are a personal AI assistant that helps manage tasks, budgets, and expenses.
Today's date is ${new Date().toISOString().slice(0, 10)}.

You have access to tools to create/list/complete tasks and log expenses. Use them when the user's message implies an action.
Always confirm what you did after using a tool.
Be concise and friendly. Use dollar amounts formatted as $X.XX.`;

export const STATEMENT_EXTRACT_PROMPT = `Extract all transactions from the following bank or credit card statement text.
Return ONLY a JSON array with no commentary. Each item must have:
- date: ISO date string (YYYY-MM-DD)
- merchant: merchant or payee name (string)
- amount: number (positive = credit, negative = debit/charge)
- currency: 3-letter code (default "CAD")
- raw_category: your best guess at a category

Statement text:
`;

export const CLASSIFY_PROMPT = (merchants) => `Classify each of the following merchant names into exactly one of these budget categories:
Housing, Food & Groceries, Transport, Insurance, Health, Subscriptions, Entertainment, Remittances, Education, Debt Payments, Savings, Other

Merchants: ${JSON.stringify(merchants)}

Return a JSON object mapping each merchant name to:
{ "category": "<category>", "confidence": "high"|"medium"|"low" }

No commentary. Only JSON.`;

export const REPORT_PROMPT = (findings, stats) => `Generate a plain-language financial improvement report based on the following analysis of a bank/credit card statement.

Stats:
${JSON.stringify(stats, null, 2)}

Findings (prioritized list of issues):
${JSON.stringify(findings, null, 2)}

Produce a JSON object with exactly these fields:
{
  "executive_summary": "2-3 sentences summarizing overall spending health and top issues",
  "recommendations": [
    {
      "rank": 1,
      "finding_id": "<id from findings>",
      "title": "short action title",
      "description": "specific next step",
      "estimated_monthly_savings_dollars": <number>
    }
  ],
  "category_comparison": [
    { "category": "<name>", "statement_dollars": <number>, "budget_limit_dollars": <number or null> }
  ]
}

Top 3 recommendations maximum. Be specific. No commentary outside JSON.`;
