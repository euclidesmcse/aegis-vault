# Criterios de aceite

> Traducao de `## 22` do prompt mestre. Cada cenario e mapeado a um
> teste automatizado ou manual reproduzivel.

| ID          | Cenario                                                            | Cobertura automatica                                  |
|-------------|--------------------------------------------------------------------|-------------------------------------------------------|
| AC-GEN-001  | Senha gerada respeita classes, sem `Math.random`, sem rede          | `packages/crypto/test/generator.test.ts` (Vitest)    |
| AC-TEST-001 | Tester nao envia a senha em nenhum canal                          | Revisao manual + teste de rede em Playwright         |
| AC-SHARE-001| Duas chamadas simultaneas ao consumir: uma vence                    | `apps/api/test/shares.atomicity.test.ts`              |
| AC-SHARE-002| GET/HEAD nao consome o share                                       | `apps/api/test/shares.scanner.test.ts`                |
| AC-SHARE-003| Link expirado/revogado/consumido: sem conteudo                       | `apps/api/test/shares.states.test.ts`                 |
| AC-SHARE-004| Clipboard API bloqueada: fallback manual sem nova leitura          | `apps/web/test/share.reveal.test.ts` (Playwright)     |
| AC-TENANT-001| Cross-tenant IDOR: 403, sem metadados visiveis                   | `apps/api/test/tenant-isolation.test.ts`              |
| AC-AUTH-001 | Resposta publicamente nao enumera conta                             | `apps/api/test/auth.enumeration.test.ts`              |
| AC-VAULT-001| Banco e logs sem texto claro de segredo/cifra                       | `packages/crypto/test/leakage.test.ts`                |
| AC-I18N-001 | 7 locais em paridade                                               | `packages/i18n/__tests__/parity.test.ts`              |
| AC-RTL-001  | arabe em RTL sem quebra                                            | `apps/web/test/a11y.rtl.test.ts` (Playwright + axe)   |
| AC-A11Y-001 | Apenas-teclado completa fluxos criticos                              | `apps/web/test/a11y.keyboard.test.ts`                 |
| AC-DEPLOY-001| Docker compose: smoke E2E verde em host limpo                      | Script `scripts/install.sh` + smoke test             |
| AC-RESTORE-001| Restore do backup sem descoberta de cifras                      | `scripts/restore.sh --verify`                        |
