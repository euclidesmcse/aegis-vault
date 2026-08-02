# Modelo de ameaca (STRIDE)

> Este documento descreve ativos, atores, limites de confianca e controles.
> Limites do modelo estao em `docs/assumptions.md`. Nenhuma auditoria
> independente foi realizada; revisao externa e obrigatoria antes de uso
> em escala.

## Ativos considerados

| Ativo                                | Classificacao                | Localizacao                        |
|--------------------------------------|------------------------------|------------------------------------|
| Senha da conta                       | alto                         | `auth_identities.password_hash`    |
| Segredo de desbloqueio do cofre      | critico - nunca no servidor  | cliente; deriva chaves locais      |
| Citadela (vault items)               | critico - cifrado no cliente | `vault_items.envelope`             |
| Token de compartilhamento            | alto                         | digestao em `secure_shares`        |
| Chave no fragmento                   | critico                      | `#fragment` - nunca vai ao servidor|
| E-mail do usuario                    | medio                        | `user_emails`                      |
| Eventos de auditoria                 | medio                        | `audit_events` (append-only)       |
| Codigo de recuperacao                | alto                         | `recovery_codes` (apenas hash)     |
| Segredo TOTP seed                    | critico - cifrado            | `mfa_methods.envelope`             |

## Atores

- **Visitante**: nao autenticado; usa gerador e tester sem identificacao.
- **Membro autenticado**: tem conta; usa cofre e compartilha segredos.
- **Administrador de workspace**: papel `admin` ou maior.
- **Operador de plataforma**: papel infra (deploy, backup).
- **Adversario externo**: inet.
- **Adversario interno**: funcionario malicioso, dependencia comprometida.

## Limites de confianca

1. Dispositivo cliente - assume SO e navegador atualizados.
2. Backend AegisVault - assume protecao de SO + kw + limites do PostgreSQL.
3. Banco PostgreSQL - assume que o administrador nao tem acesso direto
   a tabelas cifradas em texto claro (row-level security ativo).
4. Disco e backup - assume cifra em repouso (LUKS/age/KMS).

## Ameacas e controles (STRIDE)

| STRIDE   | Cenario                                       | Controle                                                                                  | Status e Implementacao                                                                                  |
|----------|-----------------------------------------------|-------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Spoofing | Vinho de phishing para sessao                  | SameSite + cookie HttpOnly + fingerprint de dispositivo + revogacao explicita             | `on-disk-but-env-blocked` (`apps/api`, `apps/web` src/ existem mas runtime NAO exercitado)              |
| Tampering| Modificacao de vault item                     | AEAD autenticada (Poly1305) + AAD contendo `tenant:item:type:v1`                          | `verified-this-session` * (`packages/crypto/src/aead.ts`, `envelope.ts` - 7/7 shim-roundtrip PASS)        |
| Repudiation| Operacao suspeita sem trilha                | `audit_events` append-only + cursor + IP minimizado                                       | `on-disk-but-env-blocked` (`apps/api/src/` ainda nao exercitado nesta sessao)                            |
| Information disclosure| Banco roubado                       | Citadela cifrada no cliente; chaves derivadas do segredo do usuario (nunca no DB)         | `verified-this-session` * (`packages/crypto/src/kdf.ts` deriveKey + `export.ts` .aegis round-trip)         |
| Denial of service| Brute force de login                  | Lockout adaptativo + rate limit por IP/email; tempos iguais para sucesso/falha            | `spec-only-not-exercited` (lockout descrito em `apps/api` spec + `docs/acceptance-criteria.md`; codigo de middleware NAO exercitado nesta sessao) |
| Elevation of privilege| Cross-tenant IDOR                  | Verificacao `membership` em cada query tenant-aware + testes negativos                     | `on-disk-but-env-blocked` (`packages/authz` docs presentes; matriciz RBAC/ABAC apenas documentada)         |
| Replay    | Reuso de token de compartilhamento            | Condicional `WHERE state='active'` + transicao atomica para `consumed`                    | `verified-this-session` * (AAD-on-token via `packages/crypto/src/share.ts`); transicao SQL `on-disk` apenas|
| MitM      | TLS no cliente                                | HSTS + TLS 1.2+ + certificate pinning opcional documentado                                 | `spec-only-not-exercited` (HSTS header + certificate pinning descritos em `apps/api` spec + `docs/operations.md`; NAO exercitados nesta sessao) |
| Crypto    | Vulnerabilidade em dependencia                | Lockfile + SBOM + atualizacao semanal + revisao de release notes                          | `on-disk-but-env-blocked` (`scripts/sbom.sh` presente mas NAO executado)                                  |
| Insider   | Administrador curio                           | Privilegio minimo + ABAC + ABAC-conditioned views sem plaintext; auditoria ativada        | `on-disk-but-env-blocked` (`packages/authz/` apenas docs; sem policy engine exercitado)                   |

\* Valido apenas para a logica de contratos, buffers e serializacao. Veja **Verificado nesta sessao** abaixo para a caveat completa do libsodium shim.

## Verificado nesta sessao (Primitivas Criptograficas)

A base local de primitivas atingiu **18/18 PASS gates** em sandbox (11 smoke + 7 shim-roundtrip). Controles classificados como `verified-this-session` na tabela STRIDE acima indicam que o codigo real foi testado logicamente para os comportamentos abaixo:

- **Envelope v1** (`packages/crypto/src/envelope.ts`): encrypt/decrypt com enforcamento deterministico de AAD (`tenantId:itemId:type:v1`). Sad-path verificado: `tenantId` mutado -> erro `aad mismatch`; buildAad deterministico + version-mutation desloca bytes.
- **Compartilhamento Efemero** (`packages/crypto/src/share.ts`): derivacao da `fragmentKey` isolada da URL + binding de AAD-on-token contra reuso. Sad-path verificado: token arbitrario (32B random) gera tag mismatch GCM; recovery com token correto devolve plaintext.
- **Exportacao offline** (`packages/crypto/src/export.ts`): `.aegis` round-trip via `node packages/crypto/test/shim-roundtrip.test.mjs` -> 7/7 PASS. Offsets binarios (magic `AEGIS_V1` + version + salt + sealed) validados. Regression check `tail.length > 0 && tail.every(b === 0)` cobre re-introducao do over-allocation corrigido neste turno.
- **Codificacao/Seguranca da Base** (`packages/crypto/src/encoding.ts`): `utf8Decode` em modo fatal (rejeita bytes invalidos em vez de substituir por U+FFFD); `constantTimeEqual` evita timing-attack; `base64url` sem padding com normalizacao case-sensitive.

> **Caveat de Auditoria (Libsodium Shim).** O motor simulado nos testes de sessao (`node_modules/libsodium-wrappers/dist/modules-esm/libsodium.mjs`) injeta WebCrypto (PBKDF2-SHA256 + AES-256-GCM) para contornar restricoes de ambiente (sem `pnpm install`). Consequentemente, os controles `verified-this-session` validam a **transparencia referencial interna** (logica de contratos, buffers e serializacao), mas **NAO** certificam a blindagem criptografica baseada em `crypto_pwhash` Argon2id nem em `crypto_aead_xchacha20poly1305_ietf_*`. A eficacia algoritmica com o wrapper C/WASM real permanece, estritamente falando, `on-disk-but-env-blocked`. Re-executar `pnpm --filter @aegis/crypto test:all` apos `pnpm install` real para promover esses controles a `verified-with-real-libsodium`.

## Riscos residuais

- Memoria de processo nao pode ser apagada deterministicamente em JS.
- KEYLENGTH de 32 bytes e argilido em segmentos de 16 MiB por padrao.
- Recuperação de conta depende de codigo de recuperacao salvo pelo usuario;
  perda definitiva do segredo do cofre sem codigo implica perda total.
- Um SO ou navegador comprometido (keylogger, extensao maliciosa) nao esta
  no escopo deste modelo.

## Testes exigidos por controle

Ver `docs/acceptance-criteria.md` e a matriz por teste em `README.md`.
