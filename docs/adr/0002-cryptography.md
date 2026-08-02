# ADR 0002 - Arquitetura criptografica

## Status

Aceito.

## Contexto

O prompt lista duas opcoes: AES-256-GCM via Web Crypto ou
XChaCha20-Poly1305 via libsodium. A escolha afeta interoperabilidade
e seguranca.

## Decisao

1. **KDF**: Argon2id via `crypto_pwhash` (libsodium). Parametros
   iniciais `t=3, m=64 MiB, p=1`.
2. **AEAD**: XChaCha20-Poly1305-IETF via `crypto_aead_xchacha20poly1305_ietf_*`.
   Justificativa: nonce de 192 bits elimina risco de reuso mesmo sem
   contador; funciona identicamente em Node e WASM; unica dependencia
   criptografica.
3. **SHA-256** via libsodium para digest de token.
4. **Envelope canon**: JSON versionado com base64url canonico.

## Consequencias

- Migrar para AES-GCM no futuro exige looping via ADR quando
  suporte multi-plataforma for realidade; AES-GCM nao esta
  disponivel no build WASM de libsodium atualmente.
- O envelope nao e binary format - choice of detail didatico; ainda
  assim a versao `v` permite migrar para CBOR/TLS sem quebra funcional.

## Verificacao

Execute `pnpm test:crypto` para validar vetores.
