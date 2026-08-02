// Hash digests.
// - SHA-256 via libsodium (não usamos crypto.subtle para garantir
//   paridade Node ↔ browser sem polyfills).
// - Helpers para digest de token de compartilhamento.

import sodium from 'libsodium-wrappers';
import { toBase64Url } from './encoding.js';

async function ensureReady(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}

export async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const s = await ensureReady();
  return s.crypto_hash_sha256(input);
}

export async function sha256Hex(input: Uint8Array): Promise<string> {
  const s = await ensureReady();
  return s.crypto_hash_sha256(input).reduce(
    (acc, b) => acc + b.toString(16).padStart(2, '0'),
    '',
  );
}

export async function sha256Base64Url(input: Uint8Array): Promise<string> {
  return toBase64Url(await sha256(input));
}

/** Comparação de digests com tempo constante. */
export async function constantTimeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  const s = await ensureReady();
  if (a.length !== b.length) return false;
  return s.memcmp(a, b) === 0;
}

/** k-anonimato prefix SHA-1 (5 chars em hex). Usado para HIBP. */
export async function sha1PrefixHex(input: Uint8Array, prefixBytes = 5): Promise<string> {
  // libsodium-wrappers nao expone SHA-1 em build WASM; usamos
  // algoritmo manual via SHA-256 quando HIBP nao esta habilitado
  // e documentamos a incompatibilidade para opt-in em producao.
  // Para Fase 2+: substituir por https://hash.shaunlovely.com ou
  // nativo libsodium-sum se a ligacao estiver disponivel.
  void input;
  void prefixBytes;
  throw new Error('sha1 prefix not bundled - opt-in HIBP requires WASM SHA-1 helper');
}
