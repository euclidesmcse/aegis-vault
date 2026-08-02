# Especificacao do produto

AegisVault oferece quatro modos de uso:

1. **Visitante** - gerador e tester publicos sem cadastro.
2. **Pessoal** - cofre individual com linking de dispositivos.
3. **Familia** - workspaces compartilhados com RBAC.
4. **Empresa** - politicas granulares, SSO, SCIM, auditoria.

## Mapa de paginas

Publico:

- `/` landing
- `/password-generator` gerador CSPRNG
- `/password-strength` tester offline
- `/secure-share` criar link efemero
- `/s/[token]` preparar e revelar share
- `/security` Visao publica da postura
- `/how-it-works` Arquitetura em leigos
- `/docs` Documentacao tecnica publica
- `/faq` FAQ
- `/privacy` `/terms` `/security.txt`

Autenticado:

- `/auth/login` `/auth/signup` `/auth/verify`
- `/auth/recovery` `/auth/mfa` `/auth/oauth/[provider]/callback`
- `/app/[workspaceId]/vault`
- `/app/[workspaceId]/generator` (versao autenticada)
- `/app/[workspaceId]/sharing`
- `/app/[workspaceId]/reports`
- `/app/[workspaceId]/activity`
- `/app/[workspaceId]/members`
- `/app/[workspaceId]/groups`
- `/app/[workspaceId]/policies`
- `/app/[workspaceId]/import-export`
- `/settings`

## Estados da aplicacao

- empty, loading, skeleton, success, error, locked, offline,
  expired, revoked, no_permission, maintenance.

Mensagens publicas NUNCA revelam existencia de conta ou recurso alem
da autorizacao do solicitante.
