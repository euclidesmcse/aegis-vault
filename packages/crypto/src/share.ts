import { encrypt, decrypt } from './aead.js';
import { sha256Base64Url } from './hash.js';
import { fromBase64Url, toBase64Url } from './encoding.js';
import { randomBytes } from './prng.js';

export type SharePayload = {
  token: string;
  fragmentKey: string;
  envelope: string;
};

const TOKEN_BYTES = 32;
const KEY_BYTES = 32;

/**
 * Producer side.
 * - `token` (32B) -> path; servidor guarda apenas `sha256(token)`.
 * - `fragmentKey` (32B) -> fragmento `#`; nunca apostado em path/query.
 * - `envelope` e cifrado com XChaCha20-Poly1305-IETF usando fragmentKey,
 *   com token como AAD para ligar ciphertext ao identificador da URL.
 */
export async function createShare(plaintext: Uint8Array): Promise<SharePayload> {
  const token = await randomBytes(TOKEN_BYTES);
  const fragmentKey = await randomBytes(KEY_BYTES);
  // encrypt() gera nonce aleatorio (24B) e devolve nonce||ct; nada extra aqui.
  const sealed = await encrypt(fragmentKey, plaintext, token);
  return {
    token: toBase64Url(token),
    fragmentKey: toBase64Url(fragmentKey),
    envelope: toBase64Url(sealed),
  };
}

export async function envelopeDigest(token: string): Promise<string> {
  return sha256Base64Url(fromBase64Url(token));
}

export async function revealShare(fragmentKey: string, envelope: string, token: string): Promise<Uint8Array> {
  const key = fromBase64Url(fragmentKey);
  const tokenBytes = fromBase64Url(token);
  const sealed = fromBase64Url(envelope);
  return decrypt(key, sealed, tokenBytes);
}
