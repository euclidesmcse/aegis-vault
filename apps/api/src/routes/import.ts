// POST /api/v1/import/:workspaceId - idempotente. Cada preview contem envelope v1
// ja cifrado pelo cliente; o servidor valida o shape com Zod e armazena JSON.
import type { FastifyInstance } from 'fastify';
import { ulidNow } from '@aegis/crypto';
import { z } from 'zod';
import { VaultItemEnvelopeSchema, VaultItemTypeSchema, problem } from '@aegis/contracts';

const ALLOWED_FORMATS = ['csv-generic', 'bitwarden', 'chrome', 'firefox'] as const;

const PreviewSchema = z.object({
  externalId: z.string().min(1).max(256),
  envelope: VaultItemEnvelopeSchema,
  type: VaultItemTypeSchema,
  folderId: z.string().nullable().optional(),
  collectionId: z.string().nullable().optional(),
});

const ImportRequestSchema = z.object({
  format: z.enum(ALLOWED_FORMATS).default('csv-generic'),
  previews: z.array(PreviewSchema).min(1).max(10_000),
});

export async function registerImportRoutes(app: FastifyInstance) {
  app.post('/api/v1/import/:workspaceId', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const ctx = await app.authenticate(req);
    if (!ctx) return reply.code(401).type('application/problem+json').send(problem(401, 'Authentication required', 'session required'));
    const parsed = ImportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const data = parsed.data;
    const jobId = ulidNow();
    let created = 0;
    let skipped = 0;
    await app.pg.begin(async (tx) => {
      for (const p of data.previews) {
        const inputs = `${workspaceId}:${p.externalId}`;
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inputs));
        const hex = Array.from(new Uint8Array(buf).slice(0, 12)).map((b) => b.toString(16).padStart(2, '0')).join('');
        const id = `imp-${hex}`;
        const existing = await tx`SELECT 1 FROM vault_items WHERE id = ${id} AND workspace_id = ${workspaceId} LIMIT 1`;
        if (existing.length > 0) { skipped++; continue; }
        await tx`INSERT INTO vault_items (id, workspace_id, folder_id, collection_id, type, envelope, revision)
                 VALUES (${id}, ${workspaceId}, ${p.folderId ?? null}, ${p.collectionId ?? null}, ${p.type}, ${JSON.stringify(p.envelope)}::text, 0)`;
        created++;
      }
      await tx`INSERT INTO imports (id, workspace_id, state, counters) VALUES (${jobId}, ${workspaceId}, 'completed', ${JSON.stringify({ created, skipped })})`;
    });
    return reply.code(202).send({ id: jobId, state: 'completed', counters: { created, skipped } });
  });
}
