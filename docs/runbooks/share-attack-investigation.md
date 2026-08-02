# Runbook — Investigacao de ataque a links de compartilhamento

## Sinais de ataque

- Picos de `share_events` com `event='consume_denied'` acima do baseline.
- Tentativas de `consume` em horarios atipicos.
- Mesma origem consumindo muitos links em janela curta.
- `share.consumed` em massa coincidente com horario de incidente.

## Resposta (SEV-2 SE SEGURO, SEV-1 SE DADOS VAZARAM)

1. **Capturar contexto:**
   - `SELECT * FROM share_events WHERE occurred_at > NOW() - INTERVAL '1 hour'`
   - `SELECT * FROM secure_shares WHERE state = 'consumed' AND consumed_at > NOW() - INTERVAL '1 hour'`
2. **Identificar shares afetados** e notificar criadores via canal de
   seguranca.
3. **Analisar origem:** `ip_subnet` revela concentracao em algum range?
   `user_agent` revela scrape tool?
4. **Aplicar contramedidas:**
   - Rate-limit agressivo temporario em `/api/v1/shares` (5 req/min).
   - Bloqueio temporario de `ip_subnet` relevantes (CIDR allowlist).
   - Invaliacao preventiva: `UPDATE secure_shares SET state = 'revoked',
     revoked_at = NOW() WHERE ...` em massa.
5. **Revisar logs de pino** sanitizados — confirmar que `share.consumed`
   aparece SEM fragmento de URL em logs visiveis.
6. **Comunicar** via `SECURITY.md` contato de e-mail.

## Investigacao posterior

- Verificar logs de aplicacao (com redaction habilitada) por tentativas
  repetidas.
- Revisar RLS/PG policies em busca de bypass.
- Confirmar que `Content-Security-Policy` no `/s/*` nao foi relaxada em
  release recente.
- Correlacionar com `audit_events` em outros workspaces.

## Comunicado aos criadores

Template email:

> Subject: AegisVault --- links potencialmente consumidos em massa
>
> Relatamos atividade atipica no periodo de .... Os links a seguir foram
> consumidos em sua conta: [lista de IDs]. Caso algum conteudo tenha sido
> exposto, recomendamos rotacao imediata do segredo associado e geracao de
> novos links.
