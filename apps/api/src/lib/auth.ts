import type { FastifyRequest } from 'fastify';
import type postgres from 'postgres';
import { ulidNow } from '@aegis/crypto';

export type AuthContext = { userId: string; workspaceId: string | null; role: 'owner'|'admin'|'manager'|'member'|'auditor'|'guest' };

const isProd = () => process.env['NODE_ENV'] === 'production';

export async function resolveAuth(req: FastifyRequest, sql: postgres.Sql): Promise<AuthContext | null> {
  const cookie = req.cookies['aegis_session'];
  if (cookie) {
    const r = await sql<{ user_id: string }[]>`SELECT user_id FROM sessions WHERE id = ${cookie} AND revoked_at IS NULL AND expires_at > NOW()`;
    const row = r[0];
    if (row) return { userId: row.user_id, workspaceId: null, role: 'member' };
    return null;
  }
  // DEV ONLY: permite x-test-user-id em testes. Em producao e rejeitado.
  if (!isProd()) {
    const hdr = req.headers['x-test-user-id'];
    if (typeof hdr === 'string' && hdr.length > 0) return { userId: hdr, workspaceId: null, role: 'member' };
  }
  void ulidNow;
  return null;
}

export function attachAuthenticate(app: { pg: postgres.Sql; authenticate: (r: FastifyRequest) => Promise<AuthContext | null> }) {
  app.authenticate = async (req: FastifyRequest) => resolveAuth(req, app.pg);
}
