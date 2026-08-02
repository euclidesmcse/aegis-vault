import type Redis from 'ioredis';
import type pino from 'pino';

export function startMailWorker({ redis, logger }: { redis: Redis; logger: pino.Logger }) {
  const queueName = 'mail.send';
  redis.subscribe(queueName + ':incoming').catch((e) => logger.error({ err: e.message }, 'mail subscribe'));
  redis.on('message', async (channel, raw) => {
    if (channel !== queueName + ':incoming') return;
    try {
      const msg = JSON.parse(raw) as { to: string; subject: string; body: string };
      logger.info({ to: msg.to, subject: msg.subject }, 'mail dispatched');
      // Em local, SMTP_HOST aponta para Mailpit. Em prod, plugar SMTP.
    } catch (e) {
      logger.error({ err: (e as Error).message }, 'mail parse failure');
    }
  });
  logger.info('mail worker started');
}
