// AEAD XChaCha20-Poly1305-IETF (RFC 8439 + draft-irtf-cfrg-xchacha).
// Implementado em cima de libsodium (unico algoritmo AEAD com AES
// indisponível no build WASM). Nonce aleatorio de 192 bits elimina
// risco de reuso mesmo sem contador, até 2^64 mensagens por chave.

import sodium from 'libsodium-wrappers';

const KEY_BYTES = 32;
const NPUB_BYTES = 24; // IETF XChaCha20-Poly1305 nonce.

async function ensureReady(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

/** Cifra com AEAD. Retorna (nonce || ciphertext_tag). */
export async function encrypt(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
): Promise<Uint8Array> {
  if (key.length !== KEY_BYTES) {
    throw new Error('key must be ' + KEY_BYTES + ' bytes');
  }
  const s = await ensureReady();
  const npub = s.randombytes_buf(NPUB_BYTES);
  // Real libsodium-wrappers retorna Uint8Array sincronamente (WASM sync).
  // O shim de sandbox usa SubtleCrypto e devolve Promise<Uint8Array>; o `await`
  // funciona para ambas as impls (subtle resolve same tick no sync path).
  const ct = await s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad,
    npub,
    key,
  );
  const out = new Uint8Array(npub.length + ct.length);
  out.set(npub, 0);
  out.set(ct, npub.length);
  return out;
}

/** Decifra resultado de `encrypt`. Exige AAD idêntica. */
export async function decrypt(
  key: Uint8Array,
  sealed: Uint8Array,
  aad: Uint8Array = new Uint8Array(),
): Promise<Uint8Array> {
  if (key.length !== KEY_BYTES) {
    throw new Error('key must be ' + KEY_BYTES + ' bytes');
  }
  if (sealed.length < NPUB_BYTES + 16) {
    throw new Error('sealed ciphertext too short');
  }
  const s = await ensureReady();
  const npub = sealed.slice(0, NPUB_BYTES);
  const ct = sealed.slice(NPUB_BYTES);
  // Mesmo motivo do encrypt: shim async, real sync; await unifica.
  return await s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ct, aad, npub, key);
}

/** Separador para packing, util para debug. */
export function splitSealed(sealed: Uint8Array): { nonce: Uint8Array; ct: Uint8Array } {
  return {
    nonce: sealed.slice(0, NPUB_BYTES),
    ct: sealed.slice(NPUB_BYTES),
  };
}
