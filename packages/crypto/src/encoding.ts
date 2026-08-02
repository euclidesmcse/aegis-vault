// Codificacao canonica.
// - base64url sem padding (RFC 4648 §5) para trafegar em URL e JSON.
// - HEX produtor e consumidor para exibir na UI.
// - utf8 helpers com validacao estrita para Unicode malformed.

export type ByteArray = Uint8Array;

export function toHex(bytes: ByteArray): string {
  const out = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    const v = bytes[i] ?? 0;
    out[i] = v.toString(16).padStart(2, '0');
  }
  return out.join('');
}

export function fromHex(hex: string): ByteArray {
  if (hex.length % 2 !== 0) {
    throw new Error('hex length must be even');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(v)) {
      throw new Error('invalid hex at index ' + i);
    }
    out[i] = v;
  }
  return out;
}

const B64URL_PAD = false;

export function toBase64Url(bytes: ByteArray): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = (globalThis as any).btoa || ((b: string) => Buffer.from(b, 'binary').toString('base64'));
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  const b64 = g(s);
  const url = b64.replace(/\+/g, '-').replace(/\//g, '_');
  return B64URL_PAD ? url : url.replace(/=+$/g, '');
}

export function fromBase64Url(b64url: string): ByteArray {
  if (b64url.includes('=')) {
    throw new Error('base64url input must be unpadded');
  }
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a: any = (globalThis as any).atob || ((s: string) => Buffer.from(s, 'base64').toString('binary'));
  const bin = a(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function utf8Encode(text: string): ByteArray {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0xff) {
      throw new Error('non-Latin1 char without TextEncoder');
    }
    out[i] = code;
  }
  return out;
}

export function utf8Decode(bytes: ByteArray): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i] ?? 0);
  }
  return decodeURIComponent(escape(s));
}

export function constantTimeEqual(a: ByteArray, b: ByteArray): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}
