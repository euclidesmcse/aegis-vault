import type postgres from 'postgres';
import type pino from 'pino';

export function startShareJanitor({ sql, logger }: { sql: postgres.Sql; logger: pino.Logger }) {
  async function loop() {
    while (true) {
      try {
        const r = await sql<{ id: string }[]>`
          UPDATE secure_shares
             SET state = 'expired'
           WHERE state = 'active' AND expires_at < NOW()
           RETURNING id
        `;
        const d = await sql<{ id: string }[]>`
          DELETE FROM secure_shares
           WHERE state IN ('consumed','expired','revoked','deleted')
             AND COALESCE(consumed_at, revoked_at, expires_at) < NOW() - INTERVAL '7 days'
           RETURNING id
        `;
        if (r.length + d.length > 0) logger.info({ expired: r.length, deleted: d.length }, 'share janitor tick');
      } catch (e) {
        logger.error({ err: (e as Error).message }, 'janitor error');
      }
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
  void loop().catch(() => undefined);
  logger.info('share janitor started');
}
