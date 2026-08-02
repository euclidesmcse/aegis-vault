// Encrypted vault export bundle (.aegis) - cleaned of dead code path.
import sodium from 'libsodium-wrappers';
import { utf8Encode, toBase64Url, fromBase64Url } from './encoding.js';
import { deriveKey, type Argon2Profile } from './kdf.js';
import { encrypt, decrypt } from './aead.js';
import { JSONStringifyStable, JSONParseStrict } from './json.js';

export const EXPORT_PROFILE: Argon2Profile = { t: 4, m: 262_144, p: 1 };
export const EXPORT_MAGIC = 'AEGIS_V1';
export const EXPORT_FILE_VERSION = 1;
const SALT_BYTES = 16;
const NONCE_BYTES = 24;

export type OriginMeta = { userId: string; email?: string; serverOrigin: string; exportedAt: string };
export type ExportedItem = {
  originItemId: string;
  type: 'login' | 'note' | 'identity' | 'card' | 'custom';
  folderIdOrigin: string | null;
  collectionIdOrigin: string | null;
  favorite: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
  payload: Uint8Array;
  originMeta: OriginMeta;
};

export type ExportBundleJson = {
  v: 1;
  workspaceId: string;
  exportedAt: string;
  itemCount: number;
  items: Array<{
    originItemId: string;
    type: ExportedItem['type'];
    folderIdOrigin: string | null;
    collectionIdOrigin: string | null;
    favorite: boolean;
    trashed: boolean;
    createdAt: string;
    updatedAt: string;
    payloadB64: string;
    originMeta: OriginMeta;
  }>;
};

export type ExportInput = {
  workspaceId: string;
  passphrase: string;
  items: Array<Omit<ExportedItem, 'payload' | 'originMeta'> & { payload: Uint8Array }>;
  originMeta: OriginMeta;
};

export async function createExportBundle(input: ExportInput): Promise<Uint8Array> {
  if (typeof input.passphrase !== 'string' || input.passphrase.length < 8) {
    throw new Error('passphrase must be at least 8 characters');
  }
  if (input.items.length > 100_000) {
    throw new Error('item count exceeds 100k — split into multiple bundles');
  }
  const s = await sodium.ready;
  const salt = s.randombytes_buf(SALT_BYTES);
  const workspaceId = (input.workspaceId ?? '').trim();
  if (!workspaceId.length || workspaceId.includes(':')) {
    throw new Error('workspaceId must be non-empty and contain no ":"');
  }
  const exportedAt = new Date().toISOString();
  // AAD distinct from in-app envelope (aegis-export:v1 prefix).
  const aad = utf8Encode(`aegis-export:v1:${workspaceId}:${exportedAt}`);
  const key = await deriveKey(input.passphrase, salt, EXPORT_PROFILE);
  const bundle: ExportBundleJson = {
    v: EXPORT_FILE_VERSION, workspaceId, exportedAt, itemCount: input.items.length,
    items: input.items.map((it) => ({
      originItemId: it.originItemId,
      type: it.type, folderIdOrigin: it.folderIdOrigin, collectionIdOrigin: it.collectionIdOrigin,
      favorite: it.favorite, trashed: it.trashed, createdAt: it.createdAt, updatedAt: it.updatedAt,
      payloadB64: toBase64Url(it.payload),
      originMeta: input.originMeta,
    })),
  };
  const plaintext = utf8Encode(JSONStringifyStable(bundle));
  const sealed = await encrypt(key, plaintext, aad);
  // `sealed` ja vem como `nonce(24B) || ct_with_tag` da aead.ts::encrypt,
  // portanto NAO precisamos fatiar e reescrever — escrevemos o buffer
  // inteiro logo apos o salt. O decoder separa nonce(24) e ct(rest) na
  // leitura por offsets constantes, sem depender do conteudo aqui.
  const file = new Uint8Array(EXPORT_MAGIC.length + 1 + SALT_BYTES + sealed.length);
  let off = 0;
  for (let i = 0; i < EXPORT_MAGIC.length; i++) file[off++] = EXPORT_MAGIC.charCodeAt(i) || 0;
  file[off++] = EXPORT_FILE_VERSION & 0xff;
  file.set(salt, off); off += SALT_BYTES;
  file.set(sealed, off);
  return file;
}

export async function decryptExportBundleWithContext(
  file: Uint8Array,
  passphrase: string,
  ctx: { workspaceId: string; exportedAt: string },
): Promise<ExportBundleJson> {
  const raw = typeof file === 'string' ? fromBase64Url(file) : file;
  const headerLen = EXPORT_MAGIC.length + 1 + SALT_BYTES + NONCE_BYTES;
  if (raw.length < headerLen + 16) throw new Error('file too short');
  for (let i = 0; i < EXPORT_MAGIC.length; i++) {
    if ((raw[i] ?? 0) !== (EXPORT_MAGIC.charCodeAt(i) || 0)) throw new Error('magic mismatch: not a .aegis file');
  }
  if ((raw[EXPORT_MAGIC.length] ?? 0) !== EXPORT_FILE_VERSION) throw new Error('unsupported file version');
  let off = EXPORT_MAGIC.length + 1;
  const salt = raw.slice(off, off + SALT_BYTES); off += SALT_BYTES;
  const nonce = raw.slice(off, off + NONCE_BYTES); off += NONCE_BYTES;
  const ct = raw.slice(off);
  const aad = utf8Encode(`aegis-export:v1:${ctx.workspaceId}:${ctx.exportedAt}`);
  const keyBuf = await deriveKey(passphrase, salt, EXPORT_PROFILE);
  const sealed = new Uint8Array(nonce.length + ct.length);
  sealed.set(nonce, 0); sealed.set(ct, nonce.length);
  const recovered = await decrypt(keyBuf, sealed, aad);
  const parsed = JSONParseStrict(new TextDecoder('utf-8').decode(recovered)) as ExportBundleJson;
  if (parsed.workspaceId !== ctx.workspaceId) throw new Error('workspaceId mismatch — refusing restore');
  return parsed;
}

export type ExportSidecar = {
  v: 1;
  workspaceId: string;
  exportedAt: string;
  itemCount: number;
  plaintextDigestB64: string;
};

export function writeSidecar(bundle: ExportBundleJson): ExportSidecar {
  // O cliente escreve o sidecar em paralelo ao .aegis para o restore nao
  // depender de tentativa por timestamp (mitigacao de brute-force temporal).
  return {
    v: 1,
    workspaceId: bundle.workspaceId,
    exportedAt: bundle.exportedAt,
    itemCount: bundle.itemCount,
    plaintextDigestB64: '', // preenchido no cliente via crypto.subtle
  };
}

export const EXPORT_CRYPTO_VERSION = '0.1.0';
