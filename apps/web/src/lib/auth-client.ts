// client-side auth state + flows para AegisVault.
// Tudo persistido em localStorage simulando backend - chave nunca vai a rede.
//
// Modelo de dados em localStorage:
//
//   aegis.users['<userId>']              -> { id, email, saltAuth, saltVault,
//                                           totpEnvelope, verifiedAt, mfaEnrolledAt,
//                                           createdAt, updatedAt }
//   aegis.usersByEmail['<email>']       -> userId
//   aegis.verifyCodes['<userId>:1']     -> { hash, expiresAt, attempts }
//   aegis.session.userId                 -> userId
//   aegis.session.lastUnlockedAt         -> ISO timestamp
//   (sessionStorage) aegis.sandbox       -> { authKeyB64Url, vaultKeyB64Url }
//   (seria em cookies) aegis_session     -> mock session token

import {
  newSaltB64Url,
  newUserId,
  generateVerificationCode,
  hashVerificationCode,
  verifyCodeHash,
  deriveSessionKeys,
  wrapTotpSecret,
  unwrapTotpSecret,
  randomBytes,
  utf8Encode,
  toBase64Url,
} from './crypto-client.js';
import { ulidNow } from '@aegis/crypto';

// ---------- localStorage keys --------------------------------------------

const LS_USERS = 'aegis.users';
const LS_USERS_BY_EMAIL = 'aegis.usersByEmail';
const LS_VERIFY = 'aegis.verifyCodes';
const LS_SESSION = 'aegis.session';
const SS_KEYS = 'aegis.sandbox';

// ---------- Types ---------------------------------------------------------

export interface StoredUser {
  id: string;
  email: string;
  emailNormalized: string;
  saltAuth: string; // base64url
  saltVault: string; // base64url
  totpEnvelope: string | null;
  verifiedAt: string | null;
  mfaEnrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyRecord {
  userId: string;
  hash: string;
  expiresAt: number; // ms epoch
  attempts: number;
  issuedAt: number;
}

export interface Sandbox {
  authKeyB64Url: string;
  vaultKeyB64Url: string;
  userId: string;
}

// ---------- low-level helpers --------------------------------------------

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
function ssWrite(value: unknown): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(SS_KEYS, JSON.stringify(value));
}
export function ssRead<T>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SS_KEYS);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}
export function ssClear(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(SS_KEYS);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ---------- Signup ---------------------------------------------------------

export interface SignupResult {
  userId: string;
  email: string;
  verificationCode: string;
  expiresAt: number;
}

/**
 * Cadastro client-side: cria user, gera codigo de verificacao (mostrado na
 * UI por causa do "client-side only"), guarda hash + expira em 10 minutos.
 */
export async function signup(input: { email: string }): Promise<SignupResult> {
  if (typeof window === 'undefined') throw new Error('SSR unsupported');
  const email = input.email.trim();
  const emailNormalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid email');

  const usersByEmail = lsRead<Record<string, string>>(LS_USERS_BY_EMAIL) ?? {};
  if (usersByEmail[emailNormalized]) throw new Error('email already registered');

  const id = newUserId();
  const [saltAuth, saltVault] = await Promise.all([newSaltB64Url(), newSaltB64Url()]);
  const now = new Date().toISOString();

  const user: StoredUser = {
    id,
    email,
    emailNormalized,
    saltAuth,
    saltVault,
    totpEnvelope: null,
    verifiedAt: null,
    mfaEnrolledAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  users[id] = user;
  usersByEmail[emailNormalized] = id;
  lsWrite(LS_USERS, users);
  lsWrite(LS_USERS_BY_EMAIL, usersByEmail);

  // Codigo de verificacao de 6 digitos.
  const code = await generateVerificationCode();
  const hash = await hashVerificationCode(code);
  const expiresAt = Date.now() + 10 * 60 * 1000;
  const verifyRec: VerifyRecord = { userId: id, hash, expiresAt, attempts: 0, issuedAt: Date.now() };
  const verifyMap = lsRead<Record<string, VerifyRecord>>(LS_VERIFY) ?? {};
  verifyMap[`${id}:email`] = verifyRec;
  lsWrite(LS_VERIFY, verifyMap);

  // Mantem sessao leve para fluxos seguintes.
  lsWrite(LS_SESSION, { userId: id, after: 'pending_verification' });

  return { userId: id, email, verificationCode: code, expiresAt };
}

// ---------- Verify email ---------------------------------------------------

export async function verifyEmail(submittedCode: string): Promise<{ ok: true; userId: string } | { ok: false; reason: 'expired' | 'mismatch' | 'wrong' }> {
  if (typeof window === 'undefined') throw new Error('SSR unsupported');
  const session = lsRead<{ userId?: string }>(LS_SESSION);
  const userId = session?.userId;
  if (!userId) return { ok: false, reason: 'wrong' };
  const verifyMap = lsRead<Record<string, VerifyRecord>>(LS_VERIFY) ?? {};
  const rec = verifyMap[`${userId}:email`];
  if (!rec) return { ok: false, reason: 'wrong' };
  if (Date.now() > rec.expiresAt) return { ok: false, reason: 'expired' };
  if (rec.attempts >= 5) return { ok: false, reason: 'expired' };

  if (!/^\d{6}$/.test(submittedCode.trim())) {
    rec.attempts += 1;
    verifyMap[`${userId}:email`] = rec;
    lsWrite(LS_VERIFY, verifyMap);
    return { ok: false, reason: 'mismatch' };
  }
  const ok = await verifyCodeHash(submittedCode.trim(), rec.hash);
  if (!ok) {
    rec.attempts += 1;
    verifyMap[`${userId}:email`] = rec;
    lsWrite(LS_VERIFY, verifyMap);
    return { ok: false, reason: 'mismatch' };
  }
  // Sucesso: limpa codigo, marca usuario verificado.
  delete verifyMap[`${userId}:email`];
  lsWrite(LS_VERIFY, verifyMap);
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  const u = users[userId];
  if (!u) return { ok: false, reason: 'wrong' };
  u.verifiedAt = new Date().toISOString();
  u.updatedAt = u.verifiedAt;
  users[userId] = u;
  lsWrite(LS_USERS, users);
  lsWrite(LS_SESSION, { userId, after: 'pending_mfa' });
  return { ok: true, userId };
}

// ---------- MFA enrollment ------------------------------------------------

export interface MfaEnrollment {
  totpSecretBytes: Uint8Array;
  totpSecretBase32: string;
  otpauthUri: string;
  enrollCode: string; // 6-digit do momento, para validar
}

import { base32Encode, verifyTotp, otpauthUri, encryptVaultItem } from './crypto-client.js';

export async function beginMfaEnrollment(sandbox: Sandbox): Promise<MfaEnrollment> {
  // authKey ja vem no sandbox (derivado no signup e mantido em sessionStorage).
  // Zero exposicao da passphrase em disco.
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  const user = users[sandbox.userId];
  if (!user) throw new Error('user not found');
  const totpSecretBytes = await randomBytes(20);
  const totpSecretBase32 = base32Encode(totpSecretBytes);
  const otpauthUriStr = otpauthUri({
    issuer: 'AegisVault',
    account: user.email,
    secret: totpSecretBytes,
  });
  const enrollCode = await generateVerificationCode();
  return { totpSecretBytes, totpSecretBase32, otpauthUri: otpauthUriStr, enrollCode };
}

export async function confirmMfaEnrollment(opts: {
  sandbox: Sandbox;
  userCode: string;
  totpSecretBytes: Uint8Array;
}): Promise<{ verified: boolean }> {
  const { userCode, totpSecretBytes, sandbox } = opts;
  if (!/^\d{6}$/.test(userCode.trim())) return { verified: false };
  const ok = await verifyTotp(totpSecretBytes, userCode.trim(), Math.floor(Date.now() / 1000));
  if (!ok) return { verified: false };
  // Wrap & store.
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  const user = users[sandbox.userId];
  if (!user) return { verified: false };
  const envelope = await wrapTotpSecret(totpSecretBytes, sandbox.authKeyB64Url, sandbox.userId);
  user.totpEnvelope = envelope;
  user.mfaEnrolledAt = new Date().toISOString();
  user.updatedAt = user.mfaEnrolledAt;
  users[sandbox.userId] = user;
  lsWrite(LS_USERS, users);
  ssWrite(sandbox); // re-arm sandbox apos wrap bem-sucedido
  lsWrite(LS_SESSION, { userId: sandbox.userId, after: 'pending_unlock' });
  return { verified: true };
}

// ---------- Unlock vault (deriva chaves a partir da passphrase) ----------

export interface UnlockResult {
  userId: string;
  vaultKeyB64Url: string;
  authKeyB64Url: string;
  totpRequired: boolean;
}

export async function unlock(email: string, passphrase: string): Promise<UnlockResult | { error: 'unknown' | 'invalid' }> {
  const usersByEmail = lsRead<Record<string, string>>(LS_USERS_BY_EMAIL) ?? {};
  const userId = usersByEmail[normalizeEmail(email)];
  if (!userId) {
    // Anti-enumeracao: dummy derive do tamanho aproximado para equalizar tempo.
    await deriveSessionKeys(passphrase, 'A'.repeat(22), 'B'.repeat(22));
    return { error: 'invalid' };
  }
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  const user = users[userId];
  if (!user) return { error: 'invalid' };
  const derived = await deriveSessionKeys(passphrase, user.saltAuth, user.saltVault);
  // Se tem envelope MFA, tenta derivar authKey e decifrar para validar.
  if (user.totpEnvelope) {
    try {
      await unwrapTotpSecret(user.totpEnvelope, derived.authKeyB64Url, userId);
    } catch {
      return { error: 'invalid' };
    }
  }
  ssWrite({
    userId,
    authKeyB64Url: derived.authKeyB64Url,
    vaultKeyB64Url: derived.vaultKeyB64Url,
  });
  lsWrite(LS_SESSION, { userId, after: 'authenticated', lastUnlockedAt: new Date().toISOString() });
  return { userId, authKeyB64Url: derived.authKeyB64Url, vaultKeyB64Url: derived.vaultKeyB64Url, totpRequired: !!user.totpEnvelope };
}

// ---------- TOTP refresh check --------------------------------------------

export async function needsTotpChallenge(userId: string): Promise<boolean> {
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  return !!users[userId]?.totpEnvelope;
}

// ---------- Helpers exported for pages ----------------------------------

export async function getCurrentUser(): Promise<StoredUser | null> {
  const session = lsRead<{ userId?: string }>(LS_SESSION);
  if (!session?.userId) return null;
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  return users[session.userId] ?? null;
}

export async function listUsers(): Promise<StoredUser[]> {
  const users = lsRead<Record<string, StoredUser>>(LS_USERS) ?? {};
  return Object.values(users);
}

export async function clearAllData(): Promise<void> {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LS_USERS);
  window.localStorage.removeItem(LS_USERS_BY_EMAIL);
  window.localStorage.removeItem(LS_VERIFY);
  window.localStorage.removeItem(LS_SESSION);
  window.sessionStorage.removeItem(SS_KEYS);
}

void encryptVaultItem;
void ulidNow;
void utf8Encode;
void toBase64Url;
