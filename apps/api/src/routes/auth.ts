import type { FastifyInstance } from 'fastify';
import { SignupRequestSchema, LoginRequestSchema, problem, ErrorCodes } from '@aegis/contracts';
import { hashPassword as argonHash, verifyPassword as argonVerify, ulidNow } from '@aegis/crypto';

export async function registerAuthRoutes(app: FastifyInstance) {
  // Anti-enumeracao: mantem tempos comparáveis independente de a conta existir.
  const FLOOR_MS = 250;
  async function equalTimeDelay(start: number, targetMs = FLOOR_MS) {
    const elapsed = Date.now() - start;
    if (elapsed < targetMs) await new Promise((r) => setTimeout(r, targetMs - elapsed));
  }
  // Dummy hash com mesmo salt para equalizar tempo quando o usuário nao existe.
  const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  app.post('/api/v1/auth/signup', async (req, reply) => {
    const start = Date.now();
    const parsed = SignupRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      await equalTimeDelay(start);
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const u = parsed.data;
    const userId = ulidNow();
    const emailId = ulidNow();
    const identityId = ulidNow();
    const normalized = u.email.toLowerCase();
    const { hashB64Url, saltB64Url, profile } = await argonHash(u.password);
    await app.pg.begin(async (tx) => {
      await tx`INSERT INTO users (id, locale, accepted_terms_at, accepted_privacy_at) VALUES (${userId}, ${u.locale}, NOW(), NOW())`;
      await tx`INSERT INTO user_emails (id, user_id, email, email_normalized, verified_at, is_primary) VALUES (${emailId}, ${userId}, ${u.email}, ${normalized}, NULL, true)`;
      await tx`INSERT INTO auth_identities (id, user_id, provider, subject, password_hash, argon2_salt, argon2_params) VALUES (${identityId}, ${userId}, 'password', ${userId}, ${hashB64Url}, ${saltB64Url}, ${JSON.stringify(profile)})`;
    });
    await equalTimeDelay(start);
    return reply.code(201).send({ userId, state: 'pending_verification' });
  });

  app.post('/api/v1/auth/login', async (req, reply) => {
    const start = Date.now();
    const parsed = LoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      await equalTimeDelay(start);
      return reply.code(400).type('application/problem+json').send(problem(400, 'Validation', parsed.error.message));
    }
    const { email, password } = parsed.data;
    const rows = await app.pg<{ user_id: string; password_hash: string; salt: string }[]>`
      SELECT u.id AS user_id, ai.password_hash, ai.argon2_salt
        FROM users u
        JOIN user_emails ue ON ue.user_id = u.id
        JOIN auth_identities ai ON ai.user_id = u.id AND ai.provider = 'password'
       WHERE ue.email_normalized = ${email.toLowerCase()}
       ORDER BY ai.created_at ASC
       LIMIT 1
    `;
    let success = false;
    let userId: string | undefined;
    const row = rows[0];
    if (row && row.password_hash && row.salt) {
      success = await verifyArgon(password, row.password_hash, row.salt);
      if (success) userId = row.user_id;
    } else {
      // Comparar com dummy para equalizar tempo sem confirmar existencia.
      await verifyArgon(password, DUMMY_HASH, DUMMY_SALT);
    }
    await equalTimeDelay(start);
    if (!success || !userId) {
      // Resposta generica: mesma para usuario existente/inexistente.
      return reply.code(200).type('application/problem+json').send(problem(200, 'If this email exists, you will receive further steps.'));
    }
    const sessionId = ulidNow();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await app.pg`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (${sessionId}, ${userId}, ${'sha256:' + sessionId}, ${expiresAt})`;
    reply.setCookie('aegis_session', sessionId, { path: '/', httpOnly: true, sameSite: 'lax', secure: process.env['NODE_ENV'] === 'production' });
    return reply.send({ userId, status: 'ok' as const, expiresInSeconds: 3600 });
  });

  app.post('/api/v1/auth/logout', async (req, reply) => {
    const sid = req.cookies['aegis_session'];
    if (sid) await app.pg`UPDATE sessions SET revoked_at = NOW() WHERE id = ${sid}`;
    reply.clearCookie('aegis_session', { path: '/' });
    return reply.send({ ok: true });
  });
}

async function verifyArgon(password: string, hashB64Url: string, saltB64Url: string): Promise<boolean> {
  try {
    return await argonVerify(password, hashB64Url, saltB64Url);
  } catch {
    return false;
  }
}
