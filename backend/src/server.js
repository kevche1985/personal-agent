import cron from 'node-cron';
import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { redis } from './config/redis.js';
import { runMigrations } from './db/migrate.js';
import { logger } from './utils/logger.js';
import { purgeOldPDFs } from './services/statementService.js';

async function start() {
  await runMigrations();
  await redis.connect().catch(() => {});

  // Daily PDF retention cleanup at 3am
  cron.schedule('0 3 * * *', () => {
    purgeOldPDFs(env.UPLOAD_DIR, env.PDF_RETENTION_DAYS).catch((err) =>
      logger.error({ err: err.message }, 'PDF purge failed')
    );
  });

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await pool.end();
      await redis.quit();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
