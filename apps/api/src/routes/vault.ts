import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { isAllowed, canAccessWorkspace } from '@aegis/authz';
import { CreateVaultItemRequestSchema, UpdateVaultItemRequestSchema, problem, ErrorCodes } from '@aegis/contracts';

export async function registerVaultRoutes(app: FastifyInstance) {
  async function authz(req: any, reply: any, target: { workspaceId: string; resource: any; verb: any }): Promise<{ userId: string; role: string; type: string } | null> {
    const userId = (req.headers['x-test-user-id'] as string | undefined) ?? '';
    if (!userId) {
      reply.code(401).type('application/problem+json').send(problem(401, ErrorCodes.AUTH_REQUIRED, 'login required'));
      return null;
    }
    const row = await app.pg<{ role: string; type: string }[]>`
      SELECT m.role, w.type FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.user_id = ${userId} AND m.workspace_id = ${target.workspaceId} AND m.state = 'active'`;
    const r = row[0];
    if (!r) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'no membership'));
      return null;
    }
    if (!canAccessWorkspace({ subject: { userId, role: r.role as any, workspaceId: target.workspaceId, workspaceType: r.type as any }, targetWorkspaceId: target.workspaceId })) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'tenant guard violated'));
      return null;
    }
    if (target.resource !== 'workspace' && target.resource !== 'membership' && target.resource !== 'audit' && !isAllowed({ resource: target.resource, verb: target.verb, workspaceType: r.type as any, subjectRole: r.role as any })) {
      reply.code(403).type('application/problem+json').send(problem(403, ErrorCodes.TENANT_FORBIDDEN, 'role denied'));
      return null;
    }
    return { userId, role: r.role, type: r.type };
  }

  app.post('/api/v1/vault/:workspaceId/items', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const a = await authz(req, reply, { workspaceId, resource: 'vaultItem', verb: 'C' });
    if (!a) return;
    const parsed = CreateVaultItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const id = parsed.data.id ?? ulid();
    await app.pg`INSERT INTO vault_items (id, workspace_id, folder_id, collection_id, type, envelope, favorite, trashed, revision)
                 VALUES (${id}, ${workspaceId}, ${parsed.data.folderId ?? null}, ${parsed.data.collectionId ?? null}, ${parsed.data.type}, ${JSON.stringify(parsed.data.envelope)}, ${parsed.data.favorite ?? false}, ${parsed.data.trashed ?? false}, 0)`;
    return reply.code(201).send({ id, type: parsed.data.type });
  });

  app.get('/api/v1/vault/:workspaceId/items', async (req, reply) => {
    const { workspaceId } = req.params as { workspaceId: string };
    const a = await authz(req, reply, { workspaceId, resource: 'vaultItem', verb: 'R' });
    if (!a) return;
    const rows = await app.pg<{ id: string; type: string; favorite: boolean; trashed: boolean; folder_id: string | null; collection_id: string | null; revision: number; created_at: Date; updated_at: Date }[]>`
      SELECT id, type, favorite, trashed, folder_id, collection_id, revision, created_at, updated_at
        FROM vault_items
       WHERE workspace_id = ${workspaceId}
       ORDER BY updated_at DESC
       LIMIT 200`;
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      favorite: r.favorite,
      trashed: r.trashed,
      folderId: r.folder_id,
      collectionId: r.collection_id,
      revision: r.revision,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
    }));
  });

  app.patch('/api/v1/vault/:workspaceId/items/:itemId', async (req, reply) => {
    const { workspaceId, itemId } = req.params as { workspaceId: string; itemId: string };
    const a = await authz(req, reply, { workspaceId, resource: 'vaultItem', verb: 'U' });
    if (!a) return;
    const parsed = UpdateVaultItemRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).type('applicatio
