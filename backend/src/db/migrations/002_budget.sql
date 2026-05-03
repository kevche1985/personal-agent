CREATE TABLE IF NOT EXISTS budget_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  monthly_limit_cents INTEGER NOT NULL CHECK (monthly_limit_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  merchant TEXT,
  description TEXT,
  expense_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','statement_import')),
  statement_transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS expenses_category_date_idx ON expenses(category, expense_date);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(expense_date);

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  category TEXT NOT NULL,
  total_cents INTEGER NOT NULL DEFAULT 0,
  budget_limit_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, category)
);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('warning','exceeded')),
  amount_cents INTEGER NOT NULL,
  limit_cents INTEGER NOT NULL,
  alert_month DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);
