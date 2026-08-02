# Resposta a incidentes

## Classificacao

| Severidade   | Definicao                                                   | SLA de resposta |
|--------------|-------------------------------------------------------------|-----------------|
| SEV-1        | Exfilitracao confirmada ou provavel de citadela             | < 30 min        |
| SEV-2        | Comprometimento de credenciais admin / bypass de tenant     | < 4 h           |
| SEV-3        | Erro de seguranca corrigivel sem exposicao provavel         | < 24 h          |
| SEV-4        | Aperfeicoamento recomendado                                | < 7 dias        |

## Fluxo de resposta (SEV-1/SEV-2)

1. Confirmar e conter (preservar evidencia antes de mutar).
2. Conectar `incident` em `audit_events` e abrir canal `incident-*` no chat.
3. Destrancar **read-only**: snapshot do banco + manifesto SHA-256.
4. Notificacao juridica e usuarios (`SECURITY.md`).
5. Comunicado publico se afetar terceiros.
6. Rotacao preventiva de chaves: `SESSION_SECRET`, salt de tenant, senhas admin.
7. Pos-mortem em 5 dias uteis.

## Comunicacao

- Status: status.aegis-vault.example e por e-mail aos contatos `security`.
- Usuarios afetados: e-mail assinado PGP do time de seguranca + revogacao
  proativa de sessoes ativas.

## Destruicao de chave (cryptographic erasure)

Quando um usuario solicita exclusao:
1. Marca `users.state='deleted'`
2. Apaga o envelope do Item Key do usuario em todos os workspaces
3. Citadela torna-se irrecuperavel (XChaCha20 com chave perdida)
4. Mantem-se identificadores opacos para evitar reuso

## Contencao automatica

- Rate limit dobrado temporariamente em tentativas de login
- Bloqueio de novos shares ate revisao
- Sessoes invalidaveis em massa (`POST /api/v1/admin/sessions/invalidate-all`)
