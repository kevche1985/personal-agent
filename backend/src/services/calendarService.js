import { google } from 'googleapis';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

function getOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
  });
}

export async function exchangeCode(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  await saveTokens(tokens);
  return tokens;
}

async function saveTokens(tokens) {
  const { access_token, refresh_token, expiry_date } = tokens;
  await pool.query(
    `INSERT INTO calendar_tokens (access_token, refresh_token, token_expiry)
     VALUES ($1, $2, to_timestamp($3 / 1000.0))
     ON CONFLICT DO NOTHING`,
    [access_token, refresh_token, expiry_date]
  );
  await redis.set('calendar:tokens', JSON.stringify(tokens), 'EX', 3500);
}

async function getAuthenticatedClient() {
  const cached = await redis.get('calendar:tokens');
  if (cached) {
    const tokens = JSON.parse(cached);
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);
    oauth2Client.on('tokens', async (newTokens) => {
      await redis.set('calendar:tokens', JSON.stringify({ ...tokens, ...newTokens }), 'EX', 3500);
    });
    return oauth2Client;
  }

  const { rows } = await pool.query(
    'SELECT access_token, refresh_token, token_expiry FROM calendar_tokens ORDER BY id DESC LIMIT 1'
  );
  if (!rows[0]) throw new Error('No Google Calendar credentials. Please complete OAuth flow at /api/calendar/auth');

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: rows[0].access_token,
    refresh_token: rows[0].refresh_token,
    expiry_date: rows[0].token_expiry ? new Date(rows[0].token_expiry).getTime() : undefined,
  });
  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...rows[0], ...newTokens };
    await redis.set('calendar:tokens', JSON.stringify(merged), 'EX', 3500);
    await pool.query(
      'UPDATE calendar_tokens SET access_token = $1, token_expiry = to_timestamp($2 / 1000.0) WHERE refresh_token = $3',
      [newTokens.access_token, newTokens.expiry_date, rows[0].refresh_token]
    );
  });
  return oauth2Client;
}

export async function createEvent(task) {
  const auth = await getAuthenticatedClient();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary: task.title,
    description: task.description,
    start: { dateTime: task.due_date || new Date().toISOString() },
    end: { dateTime: task.due_date || new Date().toISOString() },
  };

  const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
  return data.id;
}

export async function deleteEvent(eventId) {
  try {
    const auth = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not delete Google Calendar event');
  }
}

export async function listUpcomingEvents(maxResults = 10) {
  const auth = await getAuthenticatedClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  return data.items;
}
