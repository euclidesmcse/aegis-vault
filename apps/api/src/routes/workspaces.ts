import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { isAllowed, canAccessWorkspace } from '@aegis/authz';
import { problem, ErrorCodes } from '@aegis/contracts';

export async function registerWorkspacesRoutes(app: FastifyInstance) {
  // Lista workspaces do usuario autenticado. Sem autenticacao implementada
  // no MVP requer header `x-test-user-id` para testes controlaveis; cookie
  // real sera plugado via middleware em Fase 5+.
  app.get('/api/v1/workspaces', async (req, reply) => {
    const userId = (req.headers['x-test-user-id'] as string | undefined) ?? '';
    if (!userId) return reply.code(401).type('application/problem+json').send(problem(401, ErrorCodes.AUTH_REQUIRED, 'login required'));
    const rows = await app.pg<{ id: string; type: string; name: string; role: string }[]>`
      SELECT w.id, w.type, w.name, m.role
        FROM workspaces w
        JOIN memberships m ON m.workspace_id = w.id AND m.user_id = ${userId} AND m.state = 'active'
    `;
    return rows.map(r => ({ ...r, role: r.role as 'owner'|'admin'|'manager'|'member'|'auditor'|'guest' }));
  });

  // Operacao que exige que `userId` esteja no workspace de destino.
  async function requireMembership(req: any, reply: any, target: { workspaceId: string; resource: any; verb: any }): Promise<{ userId: string; role: string } | null> {
    const userId = (req.headers['x-test-user-id'] as string | undefined) ?? '';
    if (!userId) {
      reply.code(401).type('application/problem+json').send(problem(401, ErrorCodes.AUTH_REQUIRED, 'login required'));
      return null;
    }
    const row = await app.pg<{ role: string; type: string }[]>`
      SELECT m.role, w.type FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ${userId} AND m.workspace_id = ${target.workspaceId} AND m.state = 'active'
    `;
    const r = row[0];
    if (!r) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'no membership'));
      return null;
    }
    if (!canAccessWorkspace({ subject: { userId, role: r.role as any, workspaceId: target.workspaceId, workspaceType: r.type as any }, targetWorkspaceId: target.workspaceId })) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'tenant guard violated'));
      return null;
    }
    if (!isAllowed({ resource: target.resource, verb: target.verb, workspaceType: r.type as any, subjectRole: r.role as any })) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'role denied'));
      return null;
    }
    return { userId, role: r.role };
  }

  app.post('/api/v1/workspaces/:workspaceId/invite', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const authz = await requireMembership(req, reply, { workspaceId, resource: 'membership', verb: 'C' });
    if (!authz) return;
    const body = req.body as { email: string; role: string };
    const userId = ulid();
    const membershipId = ulid();
    await app.pg.begin(async (tx) => {
      await tx`INSERT INTO users (id, locale) VALUES (${userId}, 'pt-BR') ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO user_emails (id, user_id, email, email_normalized) VALUES (${ulid()}, ${userId}, ${body.email}, ${body.email.toLowerCase()}) ON CONFLICT (email_normalized) DO NOTHING`;
      await tx`INSERT INTO memberships (workspace_id, user_id, role, state, invited_by, joined_at) VALUES (${workspaceId}, ${userId}, ${body.role}, 'invited', ${authz.userId}, NULL)`;
    });
    return reply.send({ userId, role: body.role, state: 'invited' });
  });
}
