// client-side crypto helpers. Tudo no navegador, NUNCA toca rede, NUNCA Math.random.
//
// Hierarquia:
//   authKey  = Argon2id(passphrase, saltAuth,  Profiles.hardened)
//   vaultKey = Argon2id(passphrase, saltVault, Profiles.standard)
// TOTP secret (20 bytes) envelopado sob authKey via XChaCha20-Poly1305.
// Cada item do cofre envelopado sob vaultKey.

import {
  deriveKey,
  Profiles,
  buildAad,
  randomBytes,
  sha256,
  toHex,
  toBase64Url,
  fromBase64Url,
  utf8Encode,
  utf8Decode,
  encrypt,
  decrypt,
  type Argon2Profile,
} from '@aegis/crypto';

// ---------- Base32 (RFC 4648, sem padding) --------------------------------
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bitsLeft = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0;
    buffer = (buffer << 8) | v;
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      const idx = (buffer >>> (bitsLeft - 5)) & 0x1f;
      out += B32_ALPHABET[idx];
      bitsLeft -= 5;
    }
  }
  if (bitsLeft > 0) {
    const idx = (buffer << (5 - bitsLeft)) & 0x1f;
    out += B32_ALPHABET[idx];
  }
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const cleaned = text.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  const out: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const idx = B32_ALPHABET.indexOf(c ?? '');
    if (idx < 0) throw new Error('invalid base32 char at ' + i);
    buffer = (buffer << 5) | idx;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      out.push((buffer >>> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  if (bitsLeft !== 0 && buffer !== 0) throw new Error('base32 input truncated');
  return new Uint8Array(out);
}

// ---------- TOTP (RFC 6238 sobre HMAC-SHA1) -------------------------------
// HMAC-SHA1 via WebCrypto: libsodium NAO expoe crypto_auth_hmacsha1 em nenhum
// build (regular nem sumo). Mesmo helper roda em browser e Node 24+.

async function hmacSha1(keyBytes: Uint8Array, dataBytes: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto.subtle indisponivel - nao posso rodar TOTP');
  }
  const k = await globalThis.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', k, dataBytes);
  return new Uint8Array(sig);
}

export async function totpCode(secret: Uint8Array, unixSeconds: number, period = 30, digits = 6): Promise<string> {
  if (secret.length < 10) throw new Error('TOTP secret must be >= 10 bytes');
  const counter = Math.floor(unixSeconds / period);
  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { counterBytes[i] = c & 0xff; c = Math.floor(c / 256); }
  const mac = await hmacSha1(secret, counterBytes);
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binCode =
    (((mac[offset] ?? 0) & 0x7f) << 24) |
    (((mac[offset + 1] ?? 0) & 0xff) << 16) |
    (((mac[offset + 2] ?? 0) & 0xff) << 8) |
    ((mac[offset + 3] ?? 0) & 0xff);
  const modulus = 10 ** digits;
  const value = binCode % modulus;
  return value.toString().padStart(digits, '0');
}

export async function verifyTotp(secret: Uint8Array, code: string, unixSeconds: number, window = 1, period = 30): Promise<boolean> {
  const trimmed = code.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (let offset = -window; offset <= window; offset++) {
    const expected = await totpCode(secret, unixSeconds + offset * period, period);
    if (constantTimeStringEq(expected, trimmed)) return true;
  }
  return false;
}

function constantTimeStringEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function otpauthUri(opts: { issuer: string; account: string; secret: Uint8Array; period?: number; digits?: number; algorithm?: 'SHA1' | 'SHA256' | 'SHA512' }): string {
  const alg = opts.algorithm ?? 'SHA1';
  const period = opts.period ?? 30;
  const digits = opts.digits ?? 6;
  const secretB32 = base32Encode(opts.secret);
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const issuer = encodeURIComponent(opts.issuer);
  const params = new URLSearchParams({ secret: secretB32, issuer, algorithm: alg, digits: String(digits), period: String(period) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ---------- Derived session keys ------------------------------------------

export interface DerivedKeys {
  authKeyB64Url: string;
  vaultKeyB64Url: string;
}

const AUTH_PROFILE: Argon2Profile = Profiles.hardened;
const VAULT_PROFILE: Argon2Profile = Profiles.standard;

export async function deriveSessionKeys(passphrase: string, saltAuthB64Url: string, saltVaultB64Url: string): Promise<DerivedKeys> {
  const saltAuth = fromBase64Url(saltAuthB64Url);
  const saltVault = fromBase64Url(saltVaultB64Url);
  void Profiles; // profile constants re-exported through.
  const authKey = await deriveKey(passphrase, saltAuth, AUTH_PROFILE);
  const vaultKey = await deriveKey(passphrase, saltVault, VAULT_PROFILE);
  return { authKeyB64Url: toBase64Url(authKey), vaultKeyB64Url: toBase64Url(vaultKey) };
}

// ---------- Wrappers envelope canonizados --------------------------------
// Cada ciphertext inclui AAD `tenantId:itemId:type:v1`. O nonce (24B) e
// concatenado com o ct_with_tag antes do base64url.

async function sealWith(rawKey: Uint8Array, plaintext: Uint8Array, aad: Uint8Array): Promise<{ nonce: string; aad: string; ct: string }> {
  const sealed = await encrypt(rawKey, plaintext, aad);
  const nonce = sealed.slice(0, 24);
  const ct = sealed.slice(24);
  return { nonce: toBase64Url(nonce), aad: toBase64Url(aad), ct: toBase64Url(ct) };
}

async function openWith(rawKey: Uint8Array, parts: { nonce: string; aad: string; ct: string }): Promise<Uint8Array> {
  const nonce = fromBase64Url(parts.nonce);
  const ct = fromBase64Url(parts.ct);
  const aad = fromBase64Url(parts.aad);
  const sealed = new Uint8Array(nonce.length + ct.length);
  sealed.set(nonce, 0);
  sealed.set(ct, nonce.length);
  return decrypt(rawKey, sealed, aad);
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function makePreDerivedEnvelope(parts: { nonce: string; aad: string; ct: string }): string {
  return JSON.stringify({
    v: 1,
    alg: 'XCHACHA20-POLY1305-IETF',
    kdf: 'pre-derived',
    params: { t: 0, m: 0, p: 0 },
    salt: '',
    nonce: parts.nonce,
    aad: parts.aad,
    ct: parts.ct,
  });
}

export interface PreDerivedEnvelope extends Record<string, string | number | { t: number; m: number; p: number }> {
  v: number;
  alg: string;
  kdf: string;
  params: { t: number; m: number; p: number };
  salt: string;
  nonce: string;
  aad: string;
  ct: string;
}

export function readPreDerivedEnvelope(json: string): PreDerivedEnvelope {
  const obj = JSON.parse(json) as PreDerivedEnvelope;
  if (obj.alg !== 'XCHACHA20-POLY1305-IETF') throw new Error('unsupported envelope algorithm');
  if (obj.kdf !== 'pre-derived') throw new Error('unsupported envelope kdf marker');
  return obj;
}

/** Wrap de segredo TOTP (20 bytes) sob authKey, com AAD vinculada a userId. */
export async function wrapTotpSecret(secretBytes: Uint8Array, authKeyB64Url: string, userId: string): Promise<string> {
  const aad = buildAad({ tenantId: userId, itemId: 'mfa-totp', type: 'mfa-totp' });
  const parts = await sealWith(fromBase64Url(authKeyB64Url), secretBytes, aad);
  return makePreDerivedEnvelope(parts);
}

export async function unwrapTotpSecret(envelopeJson: string, authKeyB64Url: string, userId: string): Promise<Uint8Array> {
  const rec = readPreDerivedEnvelope(envelopeJson);
  const aadExpected = buildAad({ tenantId: userId, itemId: 'mfa-totp', type: 'mfa-totp' });
  const aadFound = fromBase64Url(rec.aad);
  if (!bytesEqual(aadFound, aadExpected)) throw new Error('TOTP wrap AAD mismatch (tamper or wrong key)');
  return openWith(fromBase64Url(authKeyB64Url), rec);
}

/** Envelope canon de item do cofre. */
export async function encryptVaultItem(plaintext: string, vaultKeyB64Url: string, ctx: { workspaceId: string; itemId: string; type: string }): Promise<string> {
  const aad = buildAad({ tenantId: ctx.workspaceId, itemId: ctx.itemId, type: ctx.type });
  const parts = await sealWith(fromBase64Url(vaultKeyB64Url), utf8Encode(plaintext), aad);
  return makePreDerivedEnvelope(parts);
}

export async function decryptVaultItem(envelopeJson: string, vaultKeyB64Url: string): Promise<string> {
  const rec = readPreDerivedEnvelope(envelopeJson);
  // Caller is expected to know the AAD context; for direct read, we trust the
  // envelope's aad field. If aad is missing/wrong, decrypt will throw.
  const pt = await openWith(fromBase64Url(vaultKeyB64Url), rec);
  return utf8Decode(pt);
}

// ---------- Verification code (6-digit, sans modulo bias) -----------------

const VERIFY_MAX = 1_000_000;
const MOD_BIAS = 4_294_967_296 % VERIFY_MAX; // 4_967_296
const REJECT_THRESHOLD = 4_294_967_296 - MOD_BIAS; // 4_294_000_000

export async function generateVerificationCode(): Promise<string> {
  while (true) {
    const buf = await randomBytes(4);
    const v =
      ((buf[0] ?? 0) << 24) |
      ((buf[1] ?? 0) << 16) |
      ((buf[2] ?? 0) << 8) |
      (buf[3] ?? 0);
    const unsigned = v >>> 0;
    if (unsigned < REJECT_THRESHOLD) return (unsigned % VERIFY_MAX).toString().padStart(6, '0');
  }
}

export async function hashVerificationCode(code: string): Promise<string> {
  return toHex(await sha256(utf8Encode(code)));
}

export async function verifyCodeHash(submitted: string, stored: string): Promise<boolean> {
  const submittedHash = await hashVerificationCode(submitted);
  if (submittedHash.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < submittedHash.length; i++) {
    diff |= submittedHash.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return diff === 0;
}

// ---------- Salt + helpers -------------------------------------------------

export async function newSaltB64Url(): Promise<string> {
  return toBase64Url(await randomBytes(16));
}

export { ulidNow as newUserId } from '@aegis/crypto';
