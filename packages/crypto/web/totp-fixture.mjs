// ESM fixture para TOTP RFC 6238.
// Usa WebCrypto (crypto.subtle.sign HMAC-SHA1) que funciona em Node 24+ e em browser.
// Em prod, libsodium-wrappers expoe crypto_auth_hmacsha1 e o codigo de producao
// em apps/web/src/lib/crypto-client.ts continua usando.

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let out = '', buffer = 0, bitsLeft = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0;
    buffer = (buffer << 8) | v;
    bitsLeft += 8;
    while (bitsLeft >= 5) { out += B32_ALPHABET[(buffer >>> (bitsLeft - 5)) & 0x1f]; bitsLeft -= 5; }
  }
  if (bitsLeft > 0) out += B32_ALPHABET[(buffer << (5 - bitsLeft)) & 0x1f];
  return out;
}

export function base32Decode(text) {
  const cleaned = text.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');
  const out = [];
  let buffer = 0, bitsLeft = 0;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const idx = B32_ALPHABET.indexOf(c ?? '');
    if (idx < 0) throw new Error('invalid base32 char at ' + i);
    buffer = (buffer << 5) | idx;
    bitsLeft += 5;
    if (bitsLeft >= 8) { out.push((buffer >>> (bitsLeft - 8)) & 0xff); bitsLeft -= 8; }
  }
  if (bitsLeft !== 0 && buffer !== 0) throw new Error('base32 input truncated');
  return new Uint8Array(out);
}

/**
 * HMAC-SHA1 via WebCrypto. Shim para libsodium-wrappers.crypto_auth_hmacsha1 no
 * sandbox (o WASM build do shim nao expoe). Em prod, libsodium real expoe.
 */
async function hmacSha1(keyBytes, dataBytes) {
  if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.subtle) {
    throw new Error('WebCrypto.subtle indisponivel - nao posso rodar TOTP');
  }
  const k = await globalThis.crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', k, dataBytes);
  return new Uint8Array(sig);
}

export async function totpCode(secret, unixSeconds, period = 30, digits = 6) {
  if (secret.length < 10) throw new Error('TOTP secret deve ter >= 10 bytes');
  const counter = Math.floor(unixSeconds / period);
  const cb = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { cb[i] = c & 0xff; c = Math.floor(c / 256); }
  const mac = await hmacSha1(secret, cb);
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const code =
    (((mac[offset] ?? 0) & 0x7f) << 24) |
    (((mac[offset + 1] ?? 0) & 0xff) << 16) |
    (((mac[offset + 2] ?? 0) & 0xff) << 8) |
    ((mac[offset + 3] ?? 0) & 0xff);
  const mod = 10 ** digits;
  return (code % mod).toString().padStart(digits, '0');
}

export async function verifyTotp(secret, code, unixSeconds, window = 1, period = 30) {
  const trimmed = (code || '').trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(trimmed)) return false;
  for (let off = -window; off <= window; off++) {
    const expected = await totpCode(secret, unixSeconds + off * period, period);
    if (expected === trimmed) return true;
  }
  return false;
}
