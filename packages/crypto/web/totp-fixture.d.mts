// Declaração de tipos para o fixture ESM (web/totp-fixture.mjs).
export function base32Encode(bytes: Uint8Array): string;
export function base32Decode(text: string): Uint8Array;
export function totpCode(secret: Uint8Array, unixSeconds: number, period?: number, digits?: number): Promise<string>;
export function verifyTotp(secret: Uint8Array, code: string, unixSeconds: number, window?: number, period?: number): Promise<boolean>;
