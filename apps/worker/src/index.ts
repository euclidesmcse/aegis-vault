import { loadEnv } from '@aegis/config';
import { logger } from './lib/logger.js';
import { startShareJanitor } from './jobs/share.janitor.js';
import { startMailWorker } from './jobs/mail.worker.js';

const env = loadEnv();
logger.info('worker starting', { env: env.NODE_ENV });

const sql = (await import('postgres')).default(env.DATABASE_URL, { max: 5 });
const redis = new (await import('ioredis')).default(env.REDIS_URL);

startShareJanitor({ sql, logger });
startMailWorker({ redis, logger });

process.on('SIGTERM', async () => { logger.info('SIGTERM'); await sql.end(); redis.disconnect(); process.exit(0); });
