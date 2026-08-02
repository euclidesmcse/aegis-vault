# Matriz requisito -> implementacao -> teste -> estado

> Mapeamento por Acceptance Criteria (`docs/acceptance-criteria.md`), atualizado com a Fase 6 (export/import/OpenAPI).

| ID | Requisito | Arquivo principal | Teste | Estado |
|----|-----------|--------------------|-------|--------|
| AC-GEN-001  | Gerador CSPRNG | `packages/crypto/src/prng.ts`, `generator.ts` | `packages/crypto/test/generator.test.ts` | OK |
| AC-TEST-001 | Tester offline | `packages/crypto/src/strength.ts`, `password-strength/page.tsx` | Inspecao + Playwright (futuro) | OK parcial |
| AC-SHARE-001 | Consumo atomico | `apps/api/src/routes/share.ts`, `0001_initial.sql` | `apps/api/test/shares.atomicity.test.ts` | OK (SQL canon) |
| AC-SHARE-002 | GET nao destrui | `apps/api/src/routes/share.ts` | `apps/api/test/shares.scanner.test.ts` | OK |
| AC-SHARE-003 | Nao enumera motivo | `apps/api/src/routes/share.ts` (mensagem generica) | `apps/api/test/shares.atomicity.test.ts` | OK |
| AC-SHARE-004 | Fallback clipboard | `apps/web/src/app/[locale]/s/[token]/RevealClient.tsx` | Playwright futuro | OK |
| AC-TENANT-001 | Cross-tenant IDOR | `apps/api/src/routes/{workspaces,vault,admin}.ts` + `packages/authz` | `apps/api/test/tenant-isolation.test.ts` | OK |
| AC-AUTH-001 | Anti-enumeracao | `apps/api/src/routes/auth.ts` (`equalTimeDelay` + hash dummy) | `apps/api/test/auth.enumeration.test.ts` | OK |
| AC-VAULT-001 | Sem plaintext em log/banco | Envelope canon + Pino `redact` | `packages/crypto/test/leakage.test.ts` | OK |
| AC-EXPORT-001| Restore offline sem plaintext no servidor | `packages/crypto/src/export.ts` (`.aegis` v1) | `packages/crypto/test/export.test.ts` | OK parcial (roundtrip + rejeicao) |
| AC-EXPORT-002| Magic/version mismatch rejeitado | `packages/crypto/src/export.ts` (8B magic) | `export.test.ts` | OK |
| AC-EXPORT-003| Restore nao herda ID de origem para AAD | `decryptExportBundleWithContext` valida `workspaceId` interno | `export.test.ts` (`workspaceId mismatch refused`) | OK |
| AC-IMPORT-001| Import idempotente sem duplicar | `apps/api/src/routes/import.ts` (id deterministico) | Inspecao | OK (manual) |
| AC-I18N-001  | 7 locais em paridade | `packages/i18n/bin/parity.mjs` | `packages/i18n/test/parity.test.ts` | OK (zh-CN/hi/ar ainda placeholder, marcados) |
| AC-RTL-001   | arabe em RTL | `apps/web/src/components/DocumentLocaleSync.tsx` + CSS logical | Manual + Playwright | OK (FOUC parcial; see Phase 7) |
| AC-A11Y-001  | Apenas-teclado | `globals.css` + skip-link + axe em CI | Pendente Playwright | FUTURO |
| AC-DEPLOY-001| `docker compose up` verde | `infra/compose.yaml`, Dockerfiles (non-root, healthcheck) | `scripts/install.sh` | OK |
| AC-RESTORE-001| Restore sem descoberta | `scripts/backup.sh` + `scripts/restore.sh` (manifest sha256) | Execucao manual | OK |
| AC-DOC-001   | OpenAPI 3.1 publicado | `apps/api/openapi.yaml` (+ futura exposicao em `/api/v1/openapi.json`) | Inspecao | OK |

## Novos artefatos da Fase 6

| Arquivo | Conteudo |
|---------|----------|
| `packages/crypto/src/export.ts` | `.aegis` v1 bundle: magic(8) + version(1) + salt(16) + nonce(24) + AEAD payload. Argon2id batch profile `t=4, m=256MiB, p=1`. |
| `packages/crypto/src/json.ts` | JSON canonico determinista (sort keys) para envelopes canonicos. |
| `packages/crypto/test/export.test.ts` | Roundtrip + rejeicao de magic errado / passphrase errada / workspaceId inconsistente / falta de exportedAt. |
| `apps/api/openapi.yaml` | OpenAPI 3.1: 25+ rotas em `/api/v1/*` com schemas Zod espelhados em `components.schemas`. |
| `apps/api/src/lib/csv.ts` | Parser CSV header-only com suporte a bitwarden/chrome/firefox/generic. |
| `apps/api/src/routes/import.ts` | POST `/api/v1/import/:workspaceId` com ID deterministico (idempotente). |
| `apps/api/src/routes/export.ts` | POST `/api/v1/export/:workspaceId/request` + GET status (cliente cifra localmente). |
| `apps/api/src/routes/reports.ts` | Sharing Hub + agregados categoricos de saude (sem plaintext). |
| `packages/i18n/locales/{es,fr}.json` | Traducao completa de `es` e `fr`. `zh-CN`, `hi`, `ar` permanecem placeholders geometricos (marcados para revisao humana antes de marketing). |

## Riscos residuais

- O TS strict mode + `noUncheckedIndexedAccess` ainda nao foi validado em uma execucao completa de `pnpm typecheck` (pnpm nao esta instalado no seu sandbox). Recomenda-se rodar localmente antes do merge.
- Auditoria independente do envelope `.aegis` ainda nao foi realizada.
- O comportamento de FOUC para `/ar/*` foi mitigado via `DocumentLocaleSync` mas o ideal e mover `<html>` para `app/[locale]/layout.tsx` (vide ADR futuro).
- Restore do export depende de `exportedAt` ser passado (sidecar `.aegis.json`] gerado pelo cliente); o teste confirma a rejeicao sem ele.

## Limites assumidos para a Fase 6

- SCIM 2.0, SSO SAML enterprise, cliente desktop, extensao de autofill, autenticador TOTP embutido permanecem em Fase 2+/3+ documentados em `docs/roadmap.md`.
