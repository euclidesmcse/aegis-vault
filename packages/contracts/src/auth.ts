import { z } from 'zod';

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'invalid email');

export const PasswordSchema = z
  .string()
  .min(8, 'min-length-8')
  .max(1024, 'max-length-1024');

export const SignupRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().min(1).max(120).optional(),
  acceptTermsVersion: z.string().min(1),
  acceptPrivacyVersion: z.string().min(1),
  locale: z.string().min(2).max(8),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const VerifyEmailRequestSchema = z.object({
  code: z.string().min(6).max(64),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  userId: z.string().min(1),
  // 'ok' = sessao criada; 'mfa' = exige segundo fator.
  status: z.enum(['ok', 'mfa']),
  mfaToken: z.string().min(1).optional(),
  expiresInSeconds: z.number().int().positive(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const MfaEnrollRequestSchema = z.object({
  type: z.enum(['totp', 'webauthn']),
  label: z.string().min(1).max(64),
});
export type MfaEnrollRequest = z.infer<typeof MfaEnrollRequestSchema>;

export const MfaEnrollResponseSchema = z.object({
  type: z.enum(['totp', 'webauthn']),
  // Para TOTP: segredo em texto claro SOMENTE no momento do enroll.
  // Para WebAuthn: challenge emitido pelo servidor.
  secret: z.string().optional(),
  challenge: z.string().optional(),
  credentialCreationOptions: z
    .record(z.string(), z.unknown())
    .optional(),
});
export type MfaEnrollResponse = z.infer<typeof MfaEnrollResponseSchema>;

export const RecoveryCodesResponseSchema = z.object({
  codes: z.array(z.string().min(8).max(64)).min(8).max(32),
});
export type RecoveryCodesResponse = z.infer<typeof RecoveryCodesResponseSchema>;

export const OAuthCallbackRequestSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  iss: z.string().optional(),
  code_verifier: z.string().min(1).optional(),
});
export type OAuthCallbackRequest = z.infer<typeof OAuthCallbackRequestSchema>;
