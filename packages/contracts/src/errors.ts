// Problem Details (RFC 9457) shape.
import { z } from 'zod';

export const ProblemDetailsSchema = z.object({
  type: z.string().url().default('about:blank'),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  errors: z
    .array(
      z.object({
        field: z.string(),
        message: z.string(),
        code: z.string().optional(),
      }),
    )
    .optional(),
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export function problem(
  status: number,
  title: string,
  detail?: string,
): ProblemDetails {
  const p: ProblemDetails = { type: 'about:blank', title, status };
  if (detail !== undefined) p.detail = detail;
  return p;
}

export const ErrorCodes = {
  TENANT_FORBIDDEN: 'tenant-forbidden',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  VALIDATION: 'validation',
  RATE_LIMITED: 'rate-limited',
  ENUMERATION: 'enumeration',
  ENVELOPE_INVALID: 'envelope-invalid',
  AAD_MISMATCH: 'aad-mismatch',
  SHARE_CONSUMED: 'share-consumed',
  SHARE_EXPIRED: 'share-expired',
  SHARE_REVOKED: 'share-revoked',
  AUTH_REQUIRED: 'auth-required',
  STEP_UP_REQUIRED: 'step-up-required',
  MFA_REQUIRED: 'mfa-required',
  EPHEMERAL_EXHAUSTED: 'ephemeral-exhausted',
  CONCURRENT_REPLAY: 'concurrent-replay',
} as const;
