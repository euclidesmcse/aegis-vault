import type { FastifyInstance } from 'fastify';
import { ulidNow } from '@aegis/crypto';
import { problem } from '@aegis/contracts';

// Worker-side job stub: o cliente eh quem cifra no navegador. Esta rota
// INICIA o job e devolve status; o cliente pagina /vault/{wid}/items
// para baixar envs individuais e monta o .aegis bundle localmente.
export async function registerExportRoutes(app: FastifyInstance) {
  app.post('/api/v1/export/:workspaceId/request', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const ctx = await app.authenticate(req);
    if (!ctx) return reply.code(401).type('application/problem+json').send(problem(401, 'Authentication required', 'session required'));
    const jobId = ulidNow();
    await app.pg`INSERT INTO imports (id, workspace_id, state, counters) VALUES (${jobId}, ${workspaceId}, 'export-pending', '{}'::jsonb)`;
    return reply.code(202).send({ id: jobId, state: 'export-pending', note: 'client must build the .aegis file locally from /vault items' });
  });
  app.get('/api/v1/export/:workspaceId/status/:jobId', async (req, reply) => {
    const { workspaceId, jobId } = req.params as { workspaceId: string; jobId: string };
    const ctx = await app.authenticate(req);
    if (!ctx) return reply.code(401).type('application/problem+json').send(problem(401, 'Authentication required', 'session required'));
    const rows = await app.pg<{ id: string; state: string }[]>`SELECT id, state FROM imports WHERE id = ${jobId} AND workspace_id = ${workspaceId} LIMIT 1`;
    const row = rows[0];
    if (!row) return reply.code(404).type('application/problem+json').send(problem(404, 'Not found', 'job unknown'));
    return reply.code(200).send({ id: row.id, state: row.state });
  });
}
