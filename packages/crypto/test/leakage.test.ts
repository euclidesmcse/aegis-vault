import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import { encryptEnvelope } from '../src/envelope.js';
import { utf8Encode } from '../src/encoding.js';

await sodium.ready;

describe('No plaintext leakage', () => {
  it('envelope output never includes the secret plain', async () => {
    const clear = 'TopSecretValue123!@#';
    const env = await encryptEnvelope(utf8Encode(clear), 'very-secret-password', {
      tenantId: 'ws-A',
      itemId: 'item-1',
      type: 'login',
    });
    const serialized = JSON.stringify(env);
    expect(serialized.includes(clear)).toBe(false);
    expect(serialized.includes('very-secret-password')).toBe(false);
  });

  it('envelope output structure keys are stable', async () => {
    const env = await encryptEnvelope(utf8Encode('value'), 'pwd', {
      tenantId: 'ws',
      itemId: 'item',
      type: 'note',
    });
    expect(Object.keys(env).sort()).toEqual(['aad', 'alg', 'ct', 'kdf', 'nonce', 'params', 'salt', 'v']);
  });
});
