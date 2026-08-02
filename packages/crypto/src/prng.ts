import sodium from 'libsodium-wrappers';

let ready = false;
async function ensureReady(): Promise<typeof sodium> {
  if (!ready) {
    await sodium.ready;
    ready = true;
  }
  return sodium;
}

export async function readySodium(): Promise<typeof sodium> {
  return ensureReady();
}

export async function randomBytes(len: number): Promise<Uint8Array> {
  if (len <= 0) throw new RangeError('len must be positive');
  if (len > 1024 * 1024) throw new RangeError('len too large for synchronous generation');
  const s = await ensureReady();
  return s.randombytes_buf(len);
}

export async function randomIntBelow(max: number): Promise<number> {
  if (max <= 0 || !Number.isInteger(max)) throw new RangeError('max must be a positive integer');
  const s = await ensureReady();
  return s.randombytes_uniform(max);
}

export async function randomBase64Url(len: number): Promise<string> {
  const enc = await import('./encoding.js');
  return enc.toBase64Url(await randomBytes(len));
}

export async function pickN(charset: string, n: number, options: { excludeAmbiguous?: boolean; requireEach?: boolean } = {}): Promise<string> {
  const ambiguous = 'Il1O0o';
  const filtered = options.excludeAmbiguous
    ? Array.from(charset).filter((c) => !ambiguous.includes(c)).join('')
    : charset;
  if (filtered.length < 2) throw new RangeError('charset too small');
  const s = await ensureReady();
  const indexes: number[] = [];
  for (let i = 0; i < n; i++) indexes.push(s.randombytes_uniform(filtered.length));
  // Constroi string sem passar por indexacao tipada como `string | undefined`.
  const chars: string[] = [];
  for (let i = 0; i < filtered.length; i++) chars.push(filtered[i] as string);
  let out = '';
  for (const idx of indexes) out += chars[idx] ?? '';
  return out;
}

export async function shuffleInPlace<T>(arr: T[]): Promise<T[]> {
  const s = await ensureReady();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = s.randombytes_uniform(i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}
