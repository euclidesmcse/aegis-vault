import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/api/v1/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));
  app.get('/api/v1/ready', async (_, reply) => {
    try {
      const r = await app.pg`SELECT 1 AS ok`;
      if (r.length === 0) throw new Error('no row');
      return { status: 'ready', ts: new Date().toISOString() };
    } catch (e) {
      return reply.code(503).send({ status: 'not_ready', error: (e as Error).message });
    }
  });
}
