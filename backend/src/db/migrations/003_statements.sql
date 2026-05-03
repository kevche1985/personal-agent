CREATE TABLE IF NOT EXISTS statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  statement_type TEXT,
  account_last4 TEXT,
  billing_period_start DATE,
  billing_period_end DATE,
  total_transactions INTEGER,
  total_amount_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','complete','error')),
  error_message TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS statements_status_idx ON statements(status);

CREATE TABLE IF NOT EXISTS statement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  date DATE,
  merchant TEXT,
  raw_description TEXT,
  amount_cents INTEGER,
  currency TEXT DEFAULT 'CAD',
  category TEXT,
  classification_confidence TEXT DEFAULT 'high' CHECK (classification_confidence IN ('high','medium','low')),
  user_override_category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stmt_tx_statement_idx ON statement_transactions(statement_id);

CREATE TABLE IF NOT EXISTS statement_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  merchant TEXT,
  amount_cents INTEGER,
  frequency INTEGER,
  estimated_monthly_savings_cents INTEGER,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','dismissed')),
  dismissed_reason TEXT,
  dismissed_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS statement_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
  executive_summary TEXT,
  recommendations_json JSONB,
  category_comparison_json JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
