// Validacao tipada de variaveis de ambiente com Zod.
import { z } from 'zod';

const HexLike = z.string().regex(/^[0-9a-f]{16,}$/i, 'must be hex (>=64 bits entropy)');
const Base64Like = z.string().min(16).refine((s) => {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return /^[A-Za-z0-9+/=]+$/.test(base64);
}, 'must be base64 or base64url');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  PRIMARY_DOMAIN: z.string().default('localhost'),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres://')),
  DATABASE_POOL_MAX: z.coerce.number().int().default(20),
  REDIS_URL: z.string().default('redis://redis:6379/0'),
  BULLMQ_PREFIX: z.string().default('aegis:dev'),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().min(1),
  SESSION_SECRET: Base64Like,
  ARGON2_TIME_COST: z.coerce.number().int().min(1).max(10).default(3),
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(19_456).max(2_097_152).default(65_536),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(8).default(1),
  ENABLE_HIBP_K_ANON: z.coerce.boolean().default(false),
  HIBP_ENDPOINT: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

const REDACT_KEYS = new Set([
  'SESSION_SECRET', 'S3_SECRET_KEY', 'SMTP_PASS', 'ARGON2_TIME_COST',
  'ARGON2_MEMORY_KIB', 'ARGON2_PARALLELISM',
]);

export function redact(input: Record<string, unknown>): Record<string, unknown> {
  const cloned = { ...input };
  for (const k of REDACT_KEYS) {
    if (k in cloned) {
      const v = cloned[k];
      cloned[k] = typeof v === 'string' ? '[REDACTED]' : '[REDACTED]';
    }
  }
  return cloned;
}

/** Carrega env de `process.env`. Falha em campos faltantes ou malformados. */
export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error('Invalid environment:\n' + issues);
  }
  return parsed.data;
}

export const CONFIG_VERSION = '0.1.0';
