import { describe, expect, it } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  SignupRequestSchema,
  VaultItemEnvelopeSchema,
  ShareCreateRequestSchema,
} from '../src/index.js';

describe('Auth schema', () => {
  it('normalizes email to lowercase', () => {
    expect(EmailSchema.parse('  Foo@BAR.com  ')).toBe('foo@bar.com');
  });
  it('rejects too-short password', () => {
    expect(() => PasswordSchema.parse('123')).toThrow();
  });
  it('accepts signup full payload', () => {
    const r = SignupRequestSchema.safeParse({
      email: 'a@b.com',
      password: 'correct-horse-battery-staple',
      acceptTermsVersion: '2024-09-01',
      acceptPrivacyVersion: '2024-09-01',
      locale: 'pt-BR',
    });
    expect(r.success).toBe(true);
  });
});

describe('Vault schema', () => {
  it('rejects unknown algorithm in envelope', () => {
    const env = {
      v: 1,
      alg: 'AES-256-GCM',
      kdf: 'argon2id',
      params: { t: 3, m: 65536, p: 1 },
      salt: 'x',
      nonce: 'y',
      aad: 'z',
      ct: 'w',
    };
    expect(() => VaultItemEnvelopeSchema.parse(env)).toThrow();
  });
  it('accepts XCHACHA20 envelope', () => {
    const env = {
      v: 1,
      alg: 'XCHACHA20-POLY1305-IETF',
      kdf: 'argon2id',
      params: { t: 3, m: 65536, p: 1 },
      salt: 'x',
      nonce: 'y',
      aad: 'z',
      ct: 'w',
    };
    expect(VaultItemEnvelopeSchema.parse(env).alg).toBe('XCHACHA20-POLY1305-IETF');
  });
});

describe('Share schema', () => {
  it('caps TTL to 90 days', () => {
    expect(() =>
      ShareCreateRequestSchema.parse({ envelope: 'a', ttlSeconds: 60 * 60 * 24 * 365 }),
    ).toThrow();
  });
  it('accepts valid share request', () => {
    const r = ShareCreateRequestSchema.safeParse({
      envelope: 'aGVsbG8',
      ttlSeconds: 60,
    });
    expect(r.success).toBe(true);
  });
});
