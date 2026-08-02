import type { FastifyInstance } from 'fastify';
import { isAllowed, canAccessWorkspace } from '@aegis/authz';
import { problem } from '@aegis/contracts';

export async function registerReportRoutes(app: FastifyInstance) {
  async function assertElevated(req: any, reply: any, workspaceId: string, verb: 'R' | 'C' = 'R'): Promise<{ userId: string; role: 'owner'|'admin'|'manager'|'member'|'auditor'|'guest'; type: 'personal'|'family'|'business' } | null> {
    const ctx = await app.authenticate(req);
    if (!ctx) { reply.code(401).type('application/problem+json').send(problem(401, 'Authentication required', 'session required')); return null; }
    const r = await app.pg<{ role: 'owner'|'admin'|'manager'|'member'|'auditor'|'guest'; type: 'personal'|'family'|'business' }[]>`
      SELECT m.role, w.type FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ${ctx.userId} AND m.workspace_id = ${workspaceId} AND m.state = 'active'
    `;
    const row = r[0];
    if (!row) { reply.code(403).type('application/problem+json').send(problem(403, 'Forbidden', 'no membership')); return null; }
    if (!canAccessWorkspace({ subject: { userId: ctx.userId, role: row.role, workspaceId, workspaceType: row.type }, targetWorkspaceId: workspaceId })) {
      reply.code(403).type('application/problem+json').send(problem(403, 'Forbidden', 'tenant guard violated')); return null;
    }
    if (!isAllowed({ resource: 'audit', verb, workspaceType: row.type, subjectRole: row.role })) {
      reply.code(403).type('application/problem+json').send(problem(403, 'Forbidden', 'role rejected')); return null;
    }
    return { userId: ctx.userId, role: row.role, type: row.type };
  }

  app.get('/api/v1/sharing/:workspaceId', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const ctx = await app.authenticate(req);
    if (!ctx) return reply.code(401).type('application/problem+json').send(problem(401, 'Authentication required', 'session required'));
    const member = await app.pg<{ user_id: string }[]>`
      SELECT user_id FROM memberships WHERE user_id = ${ctx.userId} AND workspace_id = ${workspaceId} AND state = 'active' LIMIT 1`;
    if (member.length === 0) return reply.code(403).type('application/problem+json').send(problem(403, 'Forbidden', 'no membership'));
    const rows = await app.pg<{ id: string; state: string; expires_at: Date; created_at: Date }[]>`
      SELECT id, state, expires_at, created_at FROM secure_shares WHERE created_by = ${ctx.userId} ORDER BY created_at DESC LIMIT 100`;
    return rows.map((r) => ({ id: r.id, state: r.state, expiresAt: r.expires_at.toISOString(), createdAt: r.created_at.toISOString() }));
  });

  // /reports/:wid/health: apenas roles com audit:R. Sem tenant escape.
  app.get('/api/v1/reports/:workspaceId/health', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    if (!await assertElevated(req, reply, workspaceId)) return;
    // Apenas categorias agregadas - nada de ciphertext em log/banco.
    const rows = await app.pg<{ type: string; favorite: boolean; trashed: boolean; updated_at: Date }[]>`
      SELECT type, favorite, trashed, updated_at FROM vault_items WHERE workspace_id = ${workspaceId}`;
    const totals = { active: 0, trashed: 0, favorites: 0 };
    const byType: Record<string, number> = {};
    const stale: string[] = []; const now = Date.now();
    for (const r of rows) {
      if (r.trashed) totals.trashed++; else totals.active++;
      if (r.favorite) totals.favorites++;
      byType[r.type] = (byType[r.type] ?? 0) + 1;
      const age = (now - new Date(r.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (age > 365) stale.push(r.type);
    }
    return { scope: 'workspace', ...totals, byType, staleByType: stale, note: 'categorical aggregates only; client computes per-item health offline' };
  });
}
