// Envelope canon para citadela de cofre e shares efemeros.
// Formato:
/**
{
  "v": 1,
  "alg": "XCHACHA20-POLY1305-IETF",
  "kdf": "argon2id",
  "params": { "t": 3, "m": 65536, "p": 1 },
  "salt": "<base64url>",
  "nonce": "<base64url>",
  "aad": "<base64url>",
  "ct": "<base64url of ciphertext||tag>"
}
*/

import { encrypt, decrypt } from './aead.js';
import { deriveKey, type Argon2Profile, Profiles } from './kdf.js';
import { fromBase64Url, toBase64Url, utf8Encode, utf8Decode } from './encoding.js';
import { sha256 } from './hash.js';

export const ENVELOPE_VERSION = 1;
export const ENVELOPE_ALG = 'XCHACHA20-POLY1305-IETF';
export const ENVELOPE_KDF = 'argon2id';

export type EnvelopeRecord = {
  v: number;
  alg: string;
  kdf: string;
  params: Argon2Profile;
  salt: string;
  nonce: string;
  aad: string;
  ct: string;
};

export type EnvelopeAADContext = {
  tenantId: string;
  itemId: string;
  type: string;
  version?: number;
};

/** Constrói a string canônica de AAD conforme ADR 0002. */
export function buildAad(ctx: EnvelopeAADContext): Uint8Array {
  const v = ctx.version ?? ENVELOPE_VERSION;
  const aad = `${ctx.tenantId}:${ctx.itemId}:${ctx.type}:v${v}`;
  return utf8Encode(aad);
}

/** Gera um envelope a partir de um segredo + chave mestra derivada localmente. */
export async function encryptEnvelope(
  plaintext: Uint8Array,
  password: string,
  aadCtx: EnvelopeAADContext,
  profile: Argon2Profile = Profiles.standard,
): Promise<EnvelopeRecord> {
  const s = await sha256(utf8Encode(`${aadCtx.tenantId}|${aadCtx.itemId}`));
  const salt = s.slice(0, 16);
  const key = await deriveKey(password, salt, profile);
  const aad = buildAad(aadCtx);
  const sealed = await encrypt(key, plaintext, aad);
  const nonce = sealed.slice(0, 24);
  const ct = sealed.slice(24);
  const rec: EnvelopeRecord = {
    v: ENVELOPE_VERSION,
    alg: ENVELOPE_ALG,
    kdf: ENVELOPE_KDF,
    params: profile,
    salt: toBase64Url(salt),
    nonce: toBase64Url(nonce),
    aad: toBase64Url(aad),
    ct: toBase64Url(ct),
  };
  return rec;
}

/** Decifra um envelope. Falha se versao, alg, kdf ou AAD não correspondem. */
export async function decryptEnvelope(
  rec: EnvelopeRecord,
  password: string,
  aadCtx: EnvelopeAADContext,
): Promise<Uint8Array> {
  if (rec.v !== ENVELOPE_VERSION) {
    throw new Error('envelope version mismatch');
  }
  if (rec.alg !== ENVELOPE_ALG) {
    throw new Error('envelope algorithm mismatch');
  }
  if (rec.kdf !== ENVELOPE_KDF) {
    throw new Error('envelope kdf mismatch');
  }
  const salt = fromBase64Url(rec.salt);
  const nonce = fromBase64Url(rec.nonce);
  const aad = fromBase64Url(rec.aad);
  const ct = fromBase64Url(rec.ct);
  const aadExpected = buildAad({
    ...aadCtx,
    version: rec.v,
  });
  if (!bytesEqual(aad, aadExpected)) {
    throw new Error('aad mismatch');
  }
  const key = await deriveKey(password, salt, rec.params);
  const sealed = new Uint8Array(nonce.length + ct.length);
  sealed.set(nonce, 0);
  sealed.set(ct, nonce.length);
  return decrypt(key, sealed, aad);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Encode/decode JSON canon para trafegar. */
export function encodeEnvelope(rec: EnvelopeRecord): string {
  return JSON.stringify(rec);
}

export function decodeEnvelope(raw: string): EnvelopeRecord {
  const j: unknown = JSON.parse(raw);
  if (!j || typeof j !== 'object') {
    throw new Error('envelope JSON must be object');
  }
  const obj = j as Record<string, unknown>;
  if (
    typeof obj.v !== 'number' ||
    typeof obj.alg !== 'string' ||
    typeof obj.kdf !== 'string' ||
    typeof obj.params !== 'object' ||
    typeof obj.salt !== 'string' ||
    typeof obj.nonce !== 'string' ||
    typeof obj.aad !== 'string' ||
    typeof obj.ct !== 'string'
  ) {
    throw new Error('envelope JSON malformed');
  }
  return obj as unknown as EnvelopeRecord;
}

/** Apenas pra debug: `utf8Decode` do AAD */
export async function describeAad(rec: EnvelopeRecord): Promise<string> {
  return utf8Decode(fromBase64Url(rec.aad));
}
