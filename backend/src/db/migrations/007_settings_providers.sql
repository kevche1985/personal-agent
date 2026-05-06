INSERT INTO app_settings (key, value)
VALUES
  ('openrouter_api_key', ''),
  ('gemini_api_key',     ''),
  ('ollama_base_url',    'http://localhost:11434')
ON CONFLICT (key) DO NOTHING;
