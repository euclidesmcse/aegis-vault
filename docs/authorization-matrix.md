# Matriz de autorizacao

> Papels: `owner`, `admin`, `manager`, `member`, `auditor`, `guest`.
> Esta matriz e avaliada por `packages/authz`. Toda negacao deve ter
> teste negativo correspondente em `apps/api/test/authz/*`.

## Tabela

Verbo: C=create, R=read, U=update, D=delete, S=share, X=export, M=manage.

Recursos:

- WORKSPACE (W)
- MEMBERSHIP (Mb)
- GROUP (G)
- POLICY (P)
- FOLDER (F)
- COLLECTION (C)
- VAULT_ITEM (I)
- SECURE_SHARE (Sh)
- AUDIT (A)
- API_CLIENT (Ac)

### Pessoal

owner do workspace pessoal tem acesso total ao W, Mb, F, C, I, Sh, Ac.

### Familia

- owner: todos os verbos em W, Mb, G, P, F, I, Sh, Ac e R em A.
- admin:  Mb, G, F, I apenas para membros; S em I; R em A.
- member: C/R/U/D em I proprio; R em C compartilhadas; S em I proprio.
- auditor: R em A, R em I agregado (sem plaintext); nenhum acesso a
  vault item privado.

### Empresa

| Recurso | owner | admin | manager | member | auditor |
|---------|:-----:|:-----:|:-------:|:------:|:-------:|
| W       | CRUDMS| R     | R       | R      | R       |
| Mb      | CRUD  | CRUD  | R       | R      | R       |
| G       | CRUD  | CRUD  | CRUD    | R      | R       |
| P       | CRUD  | CRUD  | R       | R      | R       |
| C       | CRUD  | CRUD  | CRUD    | R      | R       |
| F       | CRUD  | CRUD  | CRUD    | CRU    | R       |
| I privado| CRUDS| -     | -       | CRU    | -       |
| I compartilhado em C | CRUDS | CRUDS | CRUDS | R     | R       |
| Sh      | CRUD  | CRUD  | R       | CRU    | R       |
| A       | R     | R     | R       | -      | R       |
| Ac      | CRUD  | CRUD  | -       | -      | -       |

> **Tenancy**: Toda checagem inclui `workspace_id` validado via
> `memberships` para o `user_id` da sessao. Cross-workspace IDOR tem
> teste negativo dedicado em `tenant-isolation.test.ts`.

## Precedencia de politica

1. Politica da conta pessoal.
2. Politica do workspace.
3. Politica do grupo.
4. Politica especifica do item.
5. Excecao explicita em `policy_exceptions`.

Toda politica tem `version`. Toda mudanca gera entrada em `audit_events`.

## Acoes de auditoria exigidas

- Login (sucesso/falha)
- Logout
- Mudanca de papel
- Criacao, revogacao e consumo de share
- Mudanca de politica
- Exportacao de cofre
- Rotacao de segredo do cofre

Nenhuma entrada registra:
- Senha em claro, hash de senha, TOTP seed, ciphertext completo,
  chave, fragmento de URL, token completo.

## Step-up authentication

Operacoes que exigem reautenticacao (ate 5 min):
- Exportacao do cofre
- Mudanca de e-mail primario
- Rotacao do segredo do cofre
- Desativar MFA
- Criar API client
- Revogar todos os dispositivos
