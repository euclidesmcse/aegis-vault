import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { encryptEnvelope, decryptEnvelope, ENVELOPE_VERSION } from '../src/envelope.js';
import { utf8Encode } from '../src/encoding.js';

await sodium.ready;

const ctx = {
  tenantId: 'ws-personal-123',
  itemId: 'item-abc',
  type: 'login',
};

describe('Envelope roundtrip', () => {
  it('roundtrips a payload', async () => {
    const plaintext = utf8Encode('hunter2-correct-horse-battery-staple');
    const env = await encryptEnvelope(plaintext, 'correct-vault-secret', ctx);
    expect(env.v).toBe(ENVELOPE_VERSION);
    expect(env.alg).toBe('XCHACHA20-POLY1305-IETF');
    const recovered = await decryptEnvelope(env, 'correct-vault-secret', ctx);
    expect(new TextDecoder().decode(recovered)).toBe('hunter2-correct-horse-battery-staple');
  });

  it('fails with wrong password', async () => {
    const plaintext = utf8Encode('secret');
    const env = await encryptEnvelope(plaintext, 'pwd-a', ctx);
    await expect(decryptEnvelope(env, 'pwd-b', ctx)).rejects.toThrow();
  });

  it('fails when AAD does not match', async () => {
    const plaintext = utf8Encode('secret');
    const env = await encryptEnvelope(plaintext, 'pwd-a', ctx);
    await expect(
      decryptEnvelope(env, 'pwd-a', { ...ctx, itemId: 'different' }),
    ).rejects.toThrow(/aad/i);
  });

  it('fails on unknown envelope version', async () => {
    const plaintext = utf8Encode('secret');
    const env = await encryptEnvelope(plaintext, 'pwd-a', ctx);
    const corruptedVersion = JSON.parse(JSON.stringify(env));
    corruptedVersion.v = 999;
    const raw = JSON.stringify(corruptedVersion);
    await expect(
      decryptEnvelope(JSON.parse(raw), 'pwd-a', ctx),
    ).rejects.toThrow(/version/i);
  });

  it('preserves envelope size under corruption attempt', async () => {
    const plaintext = utf8Encode('secret');
    const env = await encryptEnvelope(plaintext, 'pwd-a', ctx);
    const corrupted = JSON.parse(JSON.stringify(env));
    // flip a byte in the middle of ct
    const buf = Buffer.from(corrupted.ct, 'base64url');
    buf[buf.length - 5] = (buf[buf.length - 5] ?? 0) ^ 0x80;
    corrupted.ct = buf.toString('base64url');
    await expect(
      decryptEnvelope(corrupted, 'pwd-a', ctx),
    ).rejects.toThrow();
  });
});
