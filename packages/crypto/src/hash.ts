// Hash digests.
// - SHA-256 via libsodium (não usamos crypto.subtle para garantir
//   paridade Node ↔ browser sem polyfills).
// - Helpers para digest de token de compartilhamento.

import sodium from 'libsodium-wrappers';
import { toBase64Url } from './encoding.js';

// @types/libsodium-wrappers@0.7.14 omite crypto_hash_sha256 (runtime 0.7.16 expõe).
type SodiumWithSha256 = typeof sodium & {
  crypto_hash_sha256(message: string | Uint8Array, outputFormat?: 'uint8array' | null): Uint8Array;
};

async function ensureReady(): Promise<SodiumWithSha256> {
  await sodium.ready;
  return sodium as SodiumWithSha256;
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

// Nota: constantTimeEqual (sync, sem libsodium) vive em encoding.ts — removida
// a variante async duplicada para eliminar a colisão no index.ts.

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
