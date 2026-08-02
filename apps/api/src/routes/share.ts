import type { FastifyInstance } from 'fastify';
import { ShareCreateRequestSchema, ShareConsumeRequestSchema, problem, ErrorCodes } from '@aegis/contracts';
import { ulidNow, envelopeDigest } from '@aegis/crypto';

export async function registerShareRoutes(app: FastifyInstance) {
  app.post('/api/v1/shares', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = ShareCreateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const data = parsed.data;
    // B1: exige sessao AUTENTICADA na criacao. O cliente entrega `x-token-digest`
    // (sha-256 do token de URL) e o servidor persiste apenas o digest.
    const ctx = await app.authenticate(req);
    if (!ctx) {
      return reply.code(401).type('application/problem+json').send(problem(401, ErrorCodes.AUTH_REQUIRED, 'session required'));
    }
    const id = ulidNow();
    const digest = req.headers['x-token-digest'];
    if (typeof digest !== 'string' || digest.length < 32) {
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', 'token digest missing or too short'));
    }
    await app.pg`INSERT INTO secure_shares (id, token_digest, envelope, state, expires_at, created_by) VALUES (
      ${id}, ${digest}, ${data.envelope}, 'active', NOW() + INTERVAL '1 second' * ${data.ttlSeconds}, ${ctx.userId}
    )`;
    // O servidor NAO devolve URL completa pois o fragmento `#key` nunca chega
    // ate ele. O cliente monta a URL por sua conta.
    return { id, state: 'active' as const, expiresAt: new Date(Date.now() + data.ttlSeconds * 1000).toISOString() };
  });

  // W-rec2: GET de estado usa DIGEST no parametro, jamais o token raw.
  app.get('/api/v1/shares/:digest/state', async (req) => {
    const { digest } = req.params as { digest: string };
    const r = await app.pg<{ state: string; expires_at: Date; created_at: Date; token_digest: string }[]>`
      SELECT state, expires_at, created_at, token_digest FROM secure_shares WHERE token_digest = ${digest} LIMIT 1
    `;
    const row = r[0];
    if (!row) return { state: 'deleted' as const, fingerprint: 'unavailable', createdAt: new Date().toISOString() };
    return {
      state: row.state as 'active' | 'consumed' | 'expired' | 'revoked' | 'deleted',
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      fingerprint: row.token_digest.slice(0, 8),
    };
  });

  // AC-SHARE-001: consumo atomico single-shot.
  app.post('/api/v1/shares/:digest/consume', async (req, reply) => {
    const { digest } = req.params as { digest: string };
    const parsed = ShareConsumeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const r = await app.pg<{ id: string; envelope: string; expires_at: Date }[]>`
      UPDATE secure_shares
         SET state = 'consumed', consumed_at = NOW()
       WHERE token_digest = ${digest}
         AND state = 'active'
         AND expires_at > NOW()
       RETURNING id, envelope, expires_at
    `;
    if (r.length === 0) {
      return reply.code(410).type('application/problem+json').send(problem(410, 'Link no longer available', 'expired, consumed, revoked or simply unavailable'));
    }
    const row = r[0]!;
    await app.pg`INSERT INTO share_events (id, share_id, event) VALUES (${ulidNow()}, ${row.id}, 'consumed')`;
    return { envelope: row.envelope, expiresAt: row.expires_at.toISOString() };
  });

  // Util exposto para o cliente que precisa do digest do token sem calculcar SHA-256 no browser.
  app.post('/api/v1/shares/_digest', async (req, reply) => {
    const token = (req.body as { token?: string }).token;
    if (typeof token !== 'string' || token.length < 16) return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', 'token invalid'));
    const d = await envelopeDigest(token);
    return { digest: d };
  });
}
