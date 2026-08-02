# Runbook — Rotacao de segredos em producao

## Contexto

Rotacoes periodicas de `SESSION_SECRET`, segredos Argon2, e chaves de envelope
sao obrigatorias para limitar janela de exposicao em caso de vazamento.

## Escopo

- `SESSION_SECRET`: secret do Fastify cookie assinado.
- `ARGON2_TIME_COST`, `ARGON2_MEMORY_KIB`, `ARGON2_PARALLELISM`: ajuste fino
  anual de parametros.
- Pepper de cifra (quando ativado): armazenado em KMS separado do banco.

## Frequencia

- `SESSION_SECRET`: a cada 90 dias.
- Parametros Argon2: anual ou apos publicacao de papers relevantes.
- Pepper KMS: anual ou apos suspeita de comprometimento.

## Procedimento

1. **Anunciar janela de manutencao** (baixa utilizacao esperada).
2. **Backup do banco + manifesto sha256** (vide `scripts/backup.sh`).
3. **Gerar novo secret e atualizar KMS / secret manager**.
4. **Forcar logout de todas as sessoes**:
   - `UPDATE sessions SET revoked_at = NOW() WHERE revoked_at IS NULL`
5. **Reiniciar serviços com nova configuracao** (rolling update controlado).
6. **Auditar health checks** antes de remover a manutencao.
7. **Confirmar taxa de falhas de login** nao subiu inesperadamente (indicaria
   argumento invalido em upgrade).

## Verificacao pos-rotacao

- [ ] `/api/v1/health` retorna 200.
- [ ] `/api/v1/ready` retorna 200 com sessao DB nova.
- [ ] Primeiro login de cada tenant funciona (e dispara Mfa challenge se
  habilitado).
- [ ] Shares ativos sobrevivem (eles sao decifrados localmente com vault
  secret, nao precisam do servidor).
- [ ] Audit log dos ultimos 30 minutos nao revela anomalias.

## Riscos residuais

- Rotacao de SESSION_SECRET invalida todas as sessoes. Usuarios terao que logar
  novamente. Esperar um pico de tentativas MFA logo apos a manutencao.
- Rotacao do pepper invalida historico de hashes de senha antigos se a tabela
  `auth_identities.password_hash` estava usando o pepper. Reiniciar com
  marcacao `argon2_params` versionada para re-hash progressivo.

## Modelo de comunicado aos usuarios

Periodo de manutencao programado:

> Subject: AegisVault --- manutencao programada em DATA
>
> Em DATA UTC realizaremos uma rotacao programada de segredo de sessao no
> AegisVault. Suas sessoes ativas serao invalidadas, mas voce podera logar
> normalmente apos a manutencao. Sem acao necessaria para usuarios com MFA.
> Usuarios sem MFA serao convidados a configurar durante o proximo login.

Rotacao nao-programada (resposta a incidente):

> Subject: AegisVault --- rotacao de seguranca concluida
>
> Em DATA UTC identificamos comportamento atipico que motivou a rotacao de
> segredo de sessao. Sua conta foi automaticamente protegida pela invalidacao
> de todas as sessoes. Por favor, faca login novamente e revise a atividade da
> sua conta em Settings > Devices. Caso observe algo suspeito, reporte via
> security@aegis-vault.example.
