import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { loadEnv } from '@aegis/config';
import { attachAuthenticate } from './lib/auth.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerWorkspacesRoutes } from './routes/workspaces.js';
import { registerVaultRoutes } from './routes/vault.js';
import { registerShareRoutes } from './routes/share.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerHealthRoutes } from './routes/health.js';
import { requestContext, problemDetailsHandler } from './lib/context.js';
import { createPgPool } from './lib/pg.js';

const env = loadEnv();
// Pino redacao: NAO removemos req.url inteiro (operadores precisam de
// visibilidade de paths). Apenas os campos sensiveis saem com remove:true.
const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.envelope', 'req.body.fragmentKey', 'res.headers["set-cookie"]'],
      remove: true,
    },
    serializers: {
      req(req) {
        const orig = (req as { url?: string }).url ?? '';
        const safe = orig.replace(/(\/api\/v1\/shares\/)([^/?]+)/g, '$1<DIGEST>');
        return { ...req, url: safe };
      },
    },
  },
  disableRequestLogging: false,
  trustProxy: false,
  bodyLimit: 256 * 1024,
});

await app.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
  frameguard: { action: 'deny' },
});

await app.register(fastifyCookie, { secret: env.SESSION_SECRET, parseOptions: { httpOnly: true, sameSite: 'lax', secure: env.NODE_ENV === 'production' } });
await app.register(fastifyRateLimit, { max: 60, timeWindow: '5 minutes' });

app.setErrorHandler(problemDetailsHandler);
app.addHook('onRequest', requestContext);
app.decorate('pg', createPgPool(env.DATABASE_URL));
attachAuthenticate(app);

await app.register(registerHealthRoutes);
await app.register(registerAuthRoutes, { prefix: '/api/v1/auth' });
await app.register(registerWorkspacesRoutes, { prefix: '/api/v1/workspaces' });
await app.register(registerVaultRoutes, { prefix: '/api/v1/vault' });
await app.register(registerShareRoutes, { prefix: '/api/v1/shares' });
await app.register(registerAdminRoutes, { prefix: '/api/v1/admin' });

const port = Number(process.env['PORT'] ?? 3001);
app.listen({ host: '0.0.0.0', port }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
