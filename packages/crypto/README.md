# @aegis/crypto

Primitivas criptograficas usadas em cliente (browser) e servidor (Node):

- `crypto_pwhash` Argon2id (RFC 9106)
- `crypto_aead_xchacha20poly1305_ietf` (libsodium WASM)
- `crypto_hash_sha256`, `randombytes_buf`
- Envelope canon v1 com base64url
- Gerador de senhas, passphrase e PIN
- Strength tester offline
- Secure share com token + fragment

## Uso

```ts
import { encryptEnvelope, decryptEnvelope } from '@aegis/crypto';

const env = await encryptEnvelope(
  new TextEncoder().encode('hello vault'),
  userVaultSecret,
  { tenantId: 'ws-1', itemId: 'item-1', type: 'note' },
);

const recovered = await decryptEnvelope(env, userVaultSecret, {
  tenantId: 'ws-1',
  itemId: 'item-1',
  type: 'note',
});
```

## Testes

```bash
pnpm test
```

## Notas

- NUNCA use `Math.random()`. Use apenas helpers de `prng.ts`.
- NUNCA persista chaves em `localStorage` ou similar.
- O envelope tem `version: 1` para migração futura sem quebra.
