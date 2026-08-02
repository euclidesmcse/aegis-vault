import { z } from 'zod';

export const ShareCreateRequestSchema = z.object({
  envelope: z.string().min(1),
  ttlSeconds: z.number().int().min(60).max(60 * 60 * 24 * 90),
  notify: z.object({
    channel: z.enum(['email', 'copy']),
    recipient: z.string().optional(),
  }).optional(),
});
export type ShareCreateRequest = z.infer<typeof ShareCreateRequestSchema>;

export const ShareCreateResponseSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  expiresAt: z.string().datetime(),
  state: z.enum(['active']),
});
export type ShareCreateResponse = z.infer<typeof ShareCreateResponseSchema>;

export const ShareStateResponseSchema = z.object({
  state: z.enum(['active', 'consumed', 'expired', 'revoked', 'deleted']),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  fingerprint: z.string().min(1),
});
export type ShareStateResponse = z.infer<typeof ShareStateResponseSchema>;

export const ShareConsumeRequestSchema = z.object({
  fragmentKey: z.string().min(1),
});
export type ShareConsumeRequest = z.infer<typeof ShareConsumeRequestSchema>;

export const ShareConsumeResponseSchema = z.object({
  envelope: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  // Em caso de clipboard API indisponível o cliente usa o campo `plain`.
  // O servidor NAO retornará plain — apenas o envelope.
});
export type ShareConsumeResponse = z.infer<typeof ShareConsumeResponseSchema>;

export const ShareRevokeRequestSchema = z.object({
  reason: z.string().min(1).max(120).optional(),
});
export type ShareRevokeRequest = z.infer<typeof ShareRevokeRequestSchema>;
