import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { toCronExpression } from '../utils/dateHelpers.js';

const client = axios.create({
  baseURL: env.OPENCLAW_GATEWAY_URL,
  headers: { Authorization: `Bearer ${env.OPENCLAW_HOOKS_TOKEN}` },
  timeout: 10000,
});

export async function sendNotification(message, options = {}) {
  const { channel = env.OPENCLAW_DEFAULT_CHANNEL, to, deliver = 'all' } = options;
  try {
    await client.post('/hooks/agent', { message, channel, to, deliver });
  } catch (err) {
    logger.error({ err: err.message }, 'OpenClaw sendNotification failed');
    throw err;
  }
}

export async function sendAlert(alertType, data) {
  const messages = {
    budget_warning: `⚠️ Budget warning: ${data.category} is at ${data.percent}% of monthly limit ($${(data.amount_cents / 100).toFixed(2)} / $${(data.limit_cents / 100).toFixed(2)})`,
    budget_exceeded: `🚨 Budget exceeded: ${data.category} exceeded monthly limit by $${((data.amount_cents - data.limit_cents) / 100).toFixed(2)}`,
    statement_complete: `📊 Statement analysis complete: Found ${data.finding_count} improvement areas. Estimated monthly savings: $${(data.total_savings_cents / 100).toFixed(2)}. ${data.top_finding ? `Top issue: ${data.top_finding}.` : ''} View full report at ${data.report_url}`,
    task_reminder: `⏰ Reminder: ${data.title}${data.description ? ' — ' + data.description : ''}`,
    spend_increase: `📈 Your ${data.month} spending was $${(data.delta_cents / 100).toFixed(2)} more than ${data.prev_month} (+${data.percent}%). Top increase: ${data.top_category}.`,
  };
  const message = messages[alertType] || JSON.stringify(data);
  return sendNotification(message);
}

export async function createCronJob(name, reminderAt, message) {
  try {
    const { data } = await client.post('/cron', {
      name,
      at: toCronExpression(reminderAt),
      message,
      deliver: 'all',
    });
    return data.jobId || data.id;
  } catch (err) {
    logger.error({ err: err.message }, 'OpenClaw createCronJob failed');
    return null;
  }
}

export async function deleteCronJob(jobId) {
  if (!jobId) return;
  try {
    await client.delete(`/cron/${jobId}`);
  } catch (err) {
    logger.warn({ err: err.message, jobId }, 'OpenClaw deleteCronJob failed');
  }
}
