CREATE TABLE IF NOT EXISTS app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults (do not overwrite existing values)
INSERT INTO app_settings (key, value)
VALUES
  ('ai_provider',        'anthropic'),
  ('ai_model',           'claude-sonnet-4-6'),
  ('anthropic_api_key',  ''),
  ('openai_api_key',     ''),
  ('openai_model',       'gpt-4o')
ON CONFLICT (key) DO NOTHING;
