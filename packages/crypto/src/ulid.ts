import { randomBytes } from './prng.js';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RAND_LEN = 16;

function charAt(idx: number): string {
  const ch = ENCODING.charAt(idx);
  if (ch === '') throw new Error('ulid: index out of range');
  return ch;
}

export function ulidNow(now: number = Date.now()): string {
  if (!Number.isFinite(now) || now < 0) throw new RangeError('now must be a positive number');
  let nowEncoded = '';
  let t = now;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = t % ENCODING_LEN;
    nowEncoded = charAt(mod) + nowEncoded;
    t = (t - mod) / ENCODING_LEN;
  }
  return nowEncoded + encodeRngSync(randomBytesSyncShim());
}

let lastTime = 0;
let lastRand = '';
async function bumpRng(): Promise<Uint8Array> {
  const buf = await randomBytes(RAND_LEN);
  if (Date.now() === lastTime) {
    lastRand = incrementMonotonic(lastRand);
    // Mesmo em caso de colisao monotônica, os bytes aleatórios nao sao
    // reutilizados porque geramos de novo a cada chamada.
    return buf;
  }
  lastTime = Date.now();
  lastRand = encodeRngSync(buf);
  return buf;
}

export async function ulid(): Promise<string> {
  const now = Date.now();
  let nowEncoded = '';
  let t = now;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = t % ENCODING_LEN;
    nowEncoded = charAt(mod) + nowEncoded;
    t = (t - mod) / ENCODING_LEN;
  }
  const rng = await bumpRng();
  let rand = '';
  for (let i = 0; i < RAND_LEN; i++) rand += charAt(rng[i] ?? 0);
  if (now === lastTime) {
    return nowEncoded + lastRand;
  }
  return nowEncoded + rand;
}

function incrementMonotonic(s: string): string {
  let carry = 1;
  const chars = s.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const ch = chars[i];
    if (ch === undefined) continue;
    const v = ENCODING.indexOf(ch);
    const newV = (v ?? 0) + carry;
    if (newV >= ENCODING_LEN) { chars[i] = charAt(0); carry = 1; }
    else { chars[i] = charAt(newV); carry = 0; break; }
  }
  return chars.join('');
}

function encodeRngSync(rng: Uint8Array): string {
  let out = '';
  for (let i = 0; i < rng.length; i++) out += charAt((rng[i] ?? 0) % ENCODING_LEN);
  return out;
}

function randomBytesSyncShim(): Uint8Array {
  // Sincronous fallback nunca e chamado em runtime: `ulidNow` e util para testes.
  const out = new Uint8Array(RAND_LEN);
  for (let i = 0; i < RAND_LEN; i++) out[i] = i;
  return out;
}

export function ulidFromRng(now: number, rng: Uint8Array): string {
  let nowEncoded = '';
  let t = now;
  for (let i = 0; i < TIME_LEN; i++) {
    const mod = t % ENCODING_LEN;
    nowEncoded = charAt(mod) + nowEncoded;
    t = (t - mod) / ENCODING_LEN;
  }
  return nowEncoded + encodeRngSync(rng);
}
