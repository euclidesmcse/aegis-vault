# Roadmap

## Fases

### Fase 0 - Descoberta  *concluida*

Premissas, threat model, arquitetura criptografica, matriz de autorizacao e
ADRs iniciais.

### Fase 1 - Fundacao  *concluida*

- Monorepo TypeScript estrito
- Páginas publicas em 7 idiomas
- CI: lint, typecheck, testes
- Containers base (web, api, worker)
- Smoke test
- Catálogos i18n em paridade

### Fase 2 - Identidade e tenancy  *concluida*

- Cadastro por e-mail com verificacao
- Login com senha + MFA TOTP + WebAuthn
- OAuth Google e Microsoft (OIDC com PKCE)
- Workspaces pessoal, familia e empresa
- Sessoes revogaveis

### Fase 3 - Cofre e chaves  *concluida*

- KDF Argon2id cliente e servidor
- Envelope AEAD canon
- CRUD de vault item
- Pastas e colecoes
- Lock/unlock com auto-lock

### Fase 4 - Ferramentas e share  *concluida*

- Gerador CSPRNG (aleatorio, frase, PIN)
- Tester offline com k-anon opt-in
- Share atomic o com fragmento
- Estados active/consumed/expired/revoked/deleted
- Worker de limpeza

### Fase 5 - Administracao e relatorios  *MVP*

- Grupos, politicas, excecoes
- Activity log append-only
- Aggregados de saude sem plaintext
- Sharing Hub (enviados, recebidos, expirados)

### Fase 6 - Importacao e APIs  *MVP*

- Importacao CSV generica com mapeamento
- Exportacao cifrada do cofre com step-up
- OpenAPI 3.1 em `/api/v1/openapi.json`
- API clients (Client Credentials)

### Fase 7 - Hardening e entrega  *MVP*

- A11y teste (axe + Playwright por teclado)
- RTL testado em arabe
- Performance budgets para landing e gerador
- Backup cifrado + restore testado
- Runbooks operacionais
- SBOM por release

## Fase 2+ (pos-MVP)

- SCIM 2.0 com Entra ID e Okta
- SSO SAML para Google Workspace, Entra ID, AD FS, Okta
- Network allowlist / bypass de emergencia auditado
- Configuracao corporativa herdada
- Pastas compartilhadas com chaves envelopadas
- History de senha com retencao configuravel
- Cliente CLI em `apps/cli` (login, unlock, sessao, lock, logout)

## Fase 3+ (futuro)

- Autenticador TOTP embutido (modulo separado, sem marca de terceiros)
- Biometria (WebAuthn opcional)
- Modo offline robusto com sync conflitante
- Cliente desktop (Tauri) e mobile (Capacitor)
- Extensao de autofill (manifest v3)
- Migracao pos-quantica (X25519+ML-KEM hibrido - pesquisa)

## Criterios globais de saida do MVP

Build limpo, testes verdes, 7 idiomas em paridade, RTL funcional,
autenticidade zero-knowledge arquivada em `docs/cryptography.md`,
share atomic o testado em concorrencia real e smoke E2E verde em
ambiente limpo.
