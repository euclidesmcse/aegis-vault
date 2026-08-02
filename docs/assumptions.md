# Premissas adotadas

Este documento consolida premissas que o agente implementador assumiu para
destrancar o desenvolvimento. Toda substituicao deve registrar data, autor e
impacto na matriz de autorizacao (`docs/authorization-matrix.md`).

## Identidade e autenticacao

- O usuario sera identificado por um **UUID imutavel** como `user_id`. O
  e-mail verificado sera mantido em `user_emails` e usado como chave de
  negocio; nunca como chave primaria.
- Senha de autenticacao (conta) e **separada** do segredo de desbloqueio do
  cofre no MVP. Texto explicito em `/auth/signup` recomenda codigo de
  recuperacao e exportacao cifrada.
- OPAQUE/PAKE esta fora do MVP. Substituicao exige ADR + revisao do
  threat model.
- WebAuthn/passkey e o metodo MFA preferencial. TOTP e alternativa.
  Codigos de recuperacao de uso unico sao armazenados somente como hash.

## Criptografia

- Argon2id para KDF e verificacao; parametros iniciais
  `t=3, m=64 MiB, p=1` ajustaveis em runtime via variavel de ambiente.
- XChaCha20-Poly1305-IETF (libsodium) para todo o conteudo cifrado.
- AES nao e usado. Justificativa: AES-GCM nao esta disponivel no build
  WASM de libsodium; XChaCha20 com nonce aleatorio de 192 bits elimina
  risco de reuso mesmo sem contador.

## Compartilhamento seguro

- Token em path, chave de descriptografia em fragmento `#`.
- Consumo so em POST, apos gesto explicito humano.
- Operacao atomica via `UPDATE ... WHERE state='active' RETURNING *`.
- Estados: `active`, `consumed`, `expired`, `revoked`, `deleted`.

## Implantacao

- Alvo primario: Linux amd64 e arm64 via Docker Compose.
- Banco: PostgreSQL 16, Redis 7, MinIO (S3-compat) local, Mailpit local.
- TLS terminas no proxy reverso (Caddy recomendado).
- Banco, Redis e S3 sao persistidos em volumes nomeados; backups via
  `scripts/backup.sh` sao cifrados localmente com chave em KMS.

## Fora do MVP

Autofill/autosave, cliente desktop/mobile nativo, modo offline robusto,
replay de ataque, autenticador TOTP embutido e SCIM sao adiados; os
respectivos requisitos foram mapeados em `docs/roadmap.md`.
