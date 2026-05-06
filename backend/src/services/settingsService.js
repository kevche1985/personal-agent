import { pool } from '../config/db.js';
import { env } from '../config/env.js';

const ALLOWED_KEYS = new Set([
  'ai_provider',
  'ai_model',
  'anthropic_api_key',
  'openai_api_key',
  'openai_model',
]);

export async function getAll() {
  const { rows } = await pool.query('SELECT key, value, updated_at FROM app_settings ORDER BY key');
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, updated_at: r.updated_at }]));
}

export async function get(key) {
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key=$1', [key]);
  return rows[0]?.value ?? null;
}

export async function set(key, value) {
  if (!ALLOWED_KEYS.has(key)) throw new Error(`Unknown setting key: ${key}`);
  const { rows } = await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
     RETURNING *`,
    [key, value ?? '']
  );
  return rows[0];
}

export async function setMany(updates) {
  const results = [];
  for (const [key, value] of Object.entries(updates)) {
    results.push(await set(key, value));
  }
  return results;
}

/**
 * Returns the effective Anthropic API key: DB setting first, env fallback.
 */
export async function getAnthropicKey() {
  const dbKey = await get('anthropic_api_key');
  return (dbKey && dbKey.trim()) ? dbKey.trim() : env.ANTHROPIC_API_KEY;
}

/**
 * Returns the effective model for the active provider.
 */
export async function getActiveModel() {
  const provider = (await get('ai_provider')) || 'anthropic';
  if (provider === 'openai') {
    return (await get('openai_model')) || 'gpt-4o';
  }
  return (await get('ai_model')) || env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
}

export async function getActiveProvider() {
  return (await get('ai_provider')) || 'anthropic';
}
