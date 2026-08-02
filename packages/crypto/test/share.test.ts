import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { createShare, revealShare, envelopeDigest } from '../src/share.js';
import { utf8Encode } from '../src/encoding.js';

await sodium.ready;

describe('Secure share', () => {
  it('roundtrips plaintext to producer to consumer', async () => {
    const plaintext = utf8Encode('this is a secret');
    const { token, fragmentKey, envelope } = await createShare(plaintext);
    const recovered = await revealShare(fragmentKey, envelope, token);
    expect(new TextDecoder().decode(recovered)).toBe('this is a secret');
  });

  it('envelope digest is stable for same token', async () => {
    const { token } = await createShare(utf8Encode('secret'));
    const a = await envelopeDigest(token);
    const b = await envelopeDigest(token);
    expect(a).toBe(b);
  });

  it('envelope digest differs for different tokens', async () => {
    const t1 = await createShare(utf8Encode('1'));
    const t2 = await createShare(utf8Encode('2'));
    const d1 = await envelopeDigest(t1.token);
    const d2 = await envelopeDigest(t2.token);
    expect(d1).not.toBe(d2);
  });

  it('reveal with wrong fragmentKey fails', async () => {
    const { token, envelope } = await createShare(utf8Encode('secret'));
    await expect(
      revealShare('AAAA', envelope, token),
    ).rejects.toThrow();
  });
});
