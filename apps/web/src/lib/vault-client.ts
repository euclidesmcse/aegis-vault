// client-side vault CRUD. Persistencia em localStorage simulando backend.
// Cada item envelopado via envelope canon (XChaCha20-Poly1305, AAD binding
// tenantId:itemId:type:v1). vaultKey nunca eh persistida.

import {
  encryptVaultItem,
  decryptVaultItem,
  newUserId,
} from './crypto-client.js';
import { ssRead, type Sandbox } from './auth-client.js';

const LS_ITEMS = 'aegis.items';
const DEFAULT_WORKSPACE_ID = 'ws_personal_default';

export type ItemType = 'login' | 'note' | 'identity' | 'card';

// ---------- Plaintext shapes (discriminated by `type`) -------------------

export interface BaseFields {
  title: string;
  notes: string;
  favorite: boolean;
  updatedAt: string;
}

export interface LoginFields extends BaseFields {
  type: 'login';
  username: string;
  password: string;
  url: string;
}
export interface NoteFields extends BaseFields {
  type: 'note';
  body: string;
}
export interface IdentityFields extends BaseFields {
  type: 'identity';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}
export interface CardFields extends BaseFields {
  type: 'card';
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
}

export type VaultItemFields = LoginFields | NoteFields | IdentityFields | CardFields;

export interface VaultItemSummary {
  id: string;
  workspaceId: string;
  type: ItemType;
  title: string;
  favorite: boolean;
  trashed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultItemStored extends VaultItemSummary {
  fields: VaultItemFields;
}

// ---------- localStorage helpers ------------------------------------------

function lsRead<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}
function lsWrite(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

interface StoredRecord {
  id: string;
  workspaceId: string;
  type: ItemType;
  favorite: boolean;
  trashed: boolean;
  envelope: string; // JSON EnvelopeRecord (ciphertext)
  createdAt: string;
  updatedAt: string;
}

function readAll(): Record<string, StoredRecord> {
  return lsRead<Record<string, StoredRecord>>(LS_ITEMS) ?? {};
}
function writeAll(map: Record<string, StoredRecord>): void {
  lsWrite(LS_ITEMS, map);
}

// ---------- Workspace id --------------------------------------------------

export function defaultWorkspaceId(): string {
  return DEFAULT_WORKSPACE_ID;
}

// ---------- Create --------------------------------------------------------

export async function createItem(fields: VaultItemFields, opts: { sandbox?: Sandbox } = {}): Promise<VaultItemSummary> {
  if (typeof window === 'undefined') throw new Error('SSR unsupported');
  const sandbox = opts.sandbox ?? ssRead<Sandbox>();
  if (!sandbox) throw new Error('vault is locked');
  const id = newUserId();
  const createdAt = new Date().toISOString();
  const workspaceId = defaultWorkspaceId();
  const full: VaultItemStored = { ...fields, id, workspaceId, createdAt, updatedAt: createdAt, trashed: false };
  const envelope = await encryptVaultItem(JSON.stringify(full), sandbox.vaultKeyB64Url, {
    workspaceId,
    itemId: id,
    type: fields.type,
  });
  const map = readAll();
  map[id] = { id, workspaceId, type: fields.type, favorite: fields.favorite, trashed: false, envelope, createdAt, updatedAt: createdAt };
  writeAll(map);
  return { id, workspaceId, type: fields.type, title: fields.title, favorite: fields.favorite, trashed: false, createdAt, updatedAt: createdAt };
}

// ---------- List ----------------------------------------------------------

export async function listItems(opts: { sandbox?: Sandbox; includeTrashed?: boolean } = {}): Promise<VaultItemSummary[]> {
  const sandbox = opts.sandbox ?? ssRead<Sandbox>();
  if (!sandbox) throw new Error('vault is locked');
  const map = readAll();
  const out: VaultItemSummary[] = [];
  for (const rec of Object.values(map)) {
    if (!opts.includeTrashed && rec.trashed) continue;
    try {
      const pt = await decryptVaultItem(rec.envelope, sandbox.vaultKeyB64Url);
      const full = JSON.parse(pt) as VaultItemStored;
      out.push({
        id: rec.id,
        workspaceId: rec.workspaceId,
        type: rec.type,
        title: full.title,
        favorite: rec.favorite,
        trashed: rec.trashed,
        createdAt: rec.createdAt,
        updatedAt: full.updatedAt,
      });
    } catch {
      // Item nao deciphera: pula. Auto-logout tentaria logout em massa.
    }
  }
  // Sort by updatedAt desc.
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

// ---------- Read (full item) ----------------------------------------------

export async function getItem(id: string, opts: { sandbox?: Sandbox } = {}): Promise<VaultItemStored | null> {
  const sandbox = opts.sandbox ?? ssRead<Sandbox>();
  if (!sandbox) throw new Error('vault is locked');
  const map = readAll();
  const rec = map[id];
  if (!rec) return null;
  const pt = await decryptVaultItem(rec.envelope, sandbox.vaultKeyB64Url);
  return JSON.parse(pt) as VaultItemStored;
}

// ---------- Update --------------------------------------------------------

export async function updateItem(id: string, patch: Partial<VaultItemFields>, opts: { sandbox?: Sandbox } = {}): Promise<VaultItemSummary> {
  const sandbox = opts.sandbox ?? ssRead<Sandbox>();
  if (!sandbox) throw new Error('vault is locked');
  const map = readAll();
  const rec = map[id];
  if (!rec) throw new Error('item not found');
  const existing = await getItem(id, { sandbox });
  if (!existing) throw new Error('item not decryptable');
  const merged: VaultItemStored = { ...existing, ...patch, updatedAt: new Date().toISOString() } as VaultItemStored;
  const envelope = await encryptVaultItem(JSON.stringify(merged), sandbox.vaultKeyB64Url, {
    workspaceId: rec.workspaceId,
    itemId: id,
    type: rec.type,
  });
  rec.envelope = envelope;
  rec.favorite = merged.favorite;
  rec.updatedAt = merged.updatedAt;
  map[id] = rec;
  writeAll(map);
  return { id, workspaceId: rec.workspaceId, type: rec.type, title: merged.title, favorite: rec.favorite, trashed: rec.trashed, createdAt: rec.createdAt, updatedAt: rec.updatedAt };
}

// ---------- Delete (soft trash) ------------------------------------------

export async function trashItem(id: string, opts: { sandbox?: Sandbox } = {}): Promise<void> {
  const sandbox = opts.sandbox ?? ssRead<Sandbox>();
  if (!sandbox) throw new Error('vault is locked');
  const map = readAll();
  const rec = map[id];
  if (!rec) return;
  rec.trashed = true;
  map[id] = rec;
  writeAll(map);
}

export async function purgeTrashed(): Promise<void> {
  const map = readAll();
  for (const id of Object.keys(map)) {
    if (map[id]?.trashed) delete map[id];
  }
  writeAll(map);
}
