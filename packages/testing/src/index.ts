import { encryptEnvelope, decryptEnvelope } from '@aegis/crypto';
import { utf8Encode } from '@aegis/crypto';

export async function makeFakeEnvelope(secret: string): Promise<string> {
  const env = await encryptEnvelope(utf8Encode(secret), 'fake-vault-secret-for-tests', {
    tenantId: 'ws-test', itemId: 'item-test', type: 'login',
  });
  return JSON.stringify(env);
}

export async function verifyFakeEnvelope(raw: string): Promise<string> {
  const env = JSON.parse(raw);
  const pt = await decryptEnvelope(env, 'fake-vault-secret-for-tests', {
    tenantId: 'ws-test', itemId: 'item-test', type: 'login',
  });
  return new TextDecoder().decode(pt);
}

export const FAKES = {
  emailStable: 'fixture.user@example.test',
  passwordStable: 'fixture-user-password-not-used-anywhere-real',
  displayNameStable: 'Fixture User',
};
export const TESTING_VERSION = '0.1.0';
