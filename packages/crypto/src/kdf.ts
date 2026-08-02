import sodium from 'libsodium-wrappers-sumo';
import { utf8Encode, toBase64Url, fromBase64Url } from './encoding.js';

export const Argon2Params = {
  ALG: 2, // crypto_pwhash_ALG_ARGON2ID13
  DEFAULT_T: 3,
  DEFAULT_M_KIB: 65_536,
  DEFAULT_P: 1,
  SALT_BYTES: 16,
  KEY_BYTES: 32,
  MIN_PWD_LEN: 1,
  MAX_PWD_LEN: 1024,
} as const;

export type Argon2Profile = { t: number; m: number; p: number };

export const Profiles = {
  fast: { t: 2, m: 19_456, p: 1 },
  standard: { t: 3, m: 65_536, p: 1 },
  hardened: { t: 4, m: 131_072, p: 1 },
} as const;

async function ensureReady(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

export async function deriveKey(password: string, salt: Uint8Array, profile: Argon2Profile = Profiles.standard, keyBytes = Argon2Params.KEY_BYTES): Promise<Uint8Array> {
  if (typeof password !== 'string' || password.length === 0) throw new Error('password must be a non-empty string');
  if (password.length > Argon2Params.MAX_PWD_LEN) throw new Error('password exceeds maximum length');
  if (salt.length !== Argon2Params.SALT_BYTES) throw new Error('salt must be exactly ' + Argon2Params.SALT_BYTES + ' bytes');
  const s = await ensureReady();
  return s.crypto_pwhash(keyBytes, utf8Encode(password.normalize('NFKC')), salt, profile.t, profile.m, Argon2Params.ALG);
}

/**
 * Server-side argon2id hash. Retorna `hash` e `salt` em formato base64url
 * para que o banco armazene opaco sem dependencia de tipos binarios.
 */
export async function hashPassword(password: string, profile: Argon2Profile = Profiles.hardened): Promise<{ hashB64Url: string; saltB64Url: string; profile: Argon2Profile }> {
  const s = await ensureReady();
  const salt = s.randombytes_buf(Argon2Params.SALT_BYTES);
  const out = s.crypto_pwhash(Argon2Params.KEY_BYTES, utf8Encode(password.normalize('NFKC')), salt, profile.t, profile.m, Argon2Params.ALG);
  return { hashB64Url: toBase64Url(out), saltB64Url: toBase64Url(salt), profile };
}

/** Server-side verification constant-time. Recebe hash e salt em base64url. */
export async function verifyPassword(password: string, hashB64Url: string, saltB64Url: string, profile: Argon2Profile = Profiles.hardened): Promise<boolean> {
  const s = await ensureReady();
  const salt = fromBase64Url(saltB64Url);
  if (salt.length !== Argon2Params.SALT_BYTES) return false;
  const out = s.crypto_pwhash(Argon2Params.KEY_BYTES, utf8Encode(password.normalize('NFKC')), salt, profile.t, profile.m, Argon2Params.ALG);
  const stored = fromBase64Url(hashB64Url);
  if (stored.length !== out.length) return false;
  return s.memcmp(stored, out);
}
