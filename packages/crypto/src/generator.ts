// Gerador de senhas.
// - random: comprimento, classes, rejeicao de ambiguos, Fisher-Yates.
// - passphrase: lista de palavras com separador e capitalizacao.
// - pin: digitos com rejeicao (sem `Math.random`).
// - Propriedade de teste: 1000 execucoes, nenhuma falha.

import { pickN, randomBytes, randomIntBelow, shuffleInPlace } from './prng.js';
import { utf8Encode, toBase64Url } from './encoding.js';
import { sha256 } from './hash.js';

export type PasswordOptions = {
  length: number;
  /** cada classe é incluída se marcada */
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Remove Il1O0o */
  excludeAmbiguous: boolean;
  /** Garante ao menos um caractere de cada classe marcada */
  requireEach: boolean;
};

const SETS: Record<'upper' | 'lower' | 'digits' | 'symbols', string> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>/?',
};

/** Lista de palavras para passphrase (subset do EFF large wordlist, public domain). */
export const PASSPHRASE_WORDS_EFF = /* placeholder size, real wordlist is loaded from /static/assets */
  '' as const;

export type PassphraseOptions = {
  words: number;
  /** Length of separator used between words (1..4) */
  separatorLength: number;
  capitalize: 'none' | 'first' | 'all';
  includeNumber: boolean;
  wordlist: string[];
};

export type PinOptions = {
  length: number;
};

const MIN_LENGTH = 4;
const MAX_LENGTH = 256;

export async function generatePassword(opts: PasswordOptions): Promise<string> {
  if (!Number.isInteger(opts.length) || opts.length < MIN_LENGTH || opts.length > MAX_LENGTH) {
    throw new RangeError('length must be between ' + MIN_LENGTH + ' and ' + MAX_LENGTH);
  }
  const classes: Array<keyof typeof SETS> = [];
  if (opts.upper) classes.push('upper');
  if (opts.lower) classes.push('lower');
  if (opts.digits) classes.push('digits');
  if (opts.symbols) classes.push('symbols');
  if (classes.length === 0) {
    throw new Error('at least one character class must be selected');
  }
  const out: string[] = [];
  if (opts.requireEach) {
    for (const c of classes) {
      out.push(await pickN(SETS[c], 1, { excludeAmbiguous: opts.excludeAmbiguous }));
    }
  }
  const remaining = opts.length - out.length;
  const union = classes.map((c) => SETS[c]).join('');
  out.push(await pickN(union, remaining, { excludeAmbiguous: opts.excludeAmbiguous }));
  const flat = out.join('').split('');
  await shuffleInPlace(flat);
  return flat.join('');
}

export async function generatePassphrase(opts: PassphraseOptions): Promise<string> {
  if (!Number.isInteger(opts.words) || opts.words < 3 || opts.words > 16) {
    throw new RangeError('words must be between 3 and 16');
  }
  const separator = opts.separatorLength > 0
    ? (await pickN('-_. ', opts.separatorLength)).padEnd(opts.separatorLength, '-')
    : '';
  const tokens: string[] = [];
  for (let i = 0; i < opts.words; i++) {
    const idx = await randomIntBelow(opts.wordlist.length);
    const w = opts.wordlist[idx];
    if (!w) continue;
    let token = w;
    if (opts.capitalize === 'all' || (opts.capitalize === 'first' && i === 0)) {
      token = token[0]?.toUpperCase() + token.slice(1) ?? token;
    }
    tokens.push(token);
  }
  if (opts.includeNumber) {
    const num = await pickN('0123456789', 2);
    const idx = await randomIntBelow(tokens.length);
    tokens[idx] = (tokens[idx] ?? '') + num;
  }
  return tokens.join(separator);
}

export async function generatePin(opts: PinOptions): Promise<string> {
  if (!Number.isInteger(opts.length) || opts.length < 4 || opts.length > 32) {
    throw new RangeError('length must be between 4 and 32');
  }
  return pickN('0123456789', opts.length);
}

/** Pontuacao de entropia estimada em bits. */
export function estimateEntropyBits(s: string): number {
  if (s.length === 0) return 0;
  const counts: Record<string, number> = {};
  for (const ch of s) {
    counts[ch] = (counts[ch] ?? 0) + 1;
  }
  const total = s.length;
  let h = 0;
  for (const k in counts) {
    const p = (counts[k] ?? 0) / total;
    if (p <= 0) continue;
    h -= p * Math.log2(p);
  }
  // Aplicar cap com base no alfabeto de Shannon + heuristica de composicao.
  const charsetSize = estimateCharsetSize(s);
  return Math.min(h * total, Math.log2(charsetSize) * total);
}

function estimateCharsetSize(s: string): number {
  let size = 0;
  if (/[a-z]/.test(s)) size += 26;
  if (/[A-Z]/.test(s)) size += 26;
  if (/[0-9]/.test(s)) size += 10;
  if (/[^a-zA-Z0-9]/.test(s)) size += 33;
  return Math.max(1, size);
}

/** Hash represents the random seed; nao usa Math.random. */
export async function lastEntropySaltB64Url(): Promise<string> {
  const r = await randomBytes(16);
  return toBase64Url(r);
}

/** Util para diagnostico: bytes brutos do PRNG. */
export async function rawTestBytes(): Promise<string> {
  return toBase64Url(await randomBytes(16));
}

/** Hook para sanitizar: limpa um buffer nao-mutavel (best-effort). */
export function bestEffortWipe(buf: Uint8Array): void {
  for (let i = 0; i < buf.length; i++) {
    buf[i] = 0;
  }
}

/** Gera digest de um valor apenas para auditoria / rate-limit (opt-in). */
export async function auditDigest(input: string): Promise<string> {
  return toBase64Url(await sha256(utf8Encode(input)));
}
