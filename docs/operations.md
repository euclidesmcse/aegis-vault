# Operacao

## Pre-requisitos de host

- Linux 5.10+ amd64 ou arm64
- Docker 24+ e Docker Compose v2
- 4 vCPU, 8 GiB RAM (recomendado 8 vCPU, 16 GiB)
- Disco: 30 GiB para `infra/data` (Postgres) + buffer para backups
- Portas: 80, 443 (web); 25 ou relay SMTP (outbound); 5432 a 127.0.0.1

## Variaveis de ambiente

Vide `.env.example`. Em producao:

- `NODE_ENV=production`
- `SESSION_SECRET` (>= 48 bytes base64; rotacionar a cada 90 dias)
- `DATABASE_URL` apontando ao Postgres gerenciado
- `REDIS_URL` apontando ao Redis gerenciado
- `S3_*` apontando ao bucket S3 dedicado
- `SMTP_*` apontando ao relay transactional (SES, Mailgun, Postmark)

## Health checks

- `/api/v1/health` (liveness) nao toca o banco
- `/api/v1/ready` (readiness) executa `SELECT 1`, ping Redis e bucket S3
- Worker reporta via `bullmq` ping no `ready`

## Graceful shutdown

- API: drenagem de 30 s, fim de requests em voo, encerramento
- Worker: fecha jobs ativos, sinaliza stalled a `concurrency_safe`
- Web: `SIGTERM` faz drain de conexoes keep-alive

## Atualizacao

1. Build nova imagem com tag `git-sha-${SHA}`
2. Migracao: `pnpm --filter @aegis/api db:migrate`
3. Rollout blue/green com verificacao de health antes de cortar
4. Rollback planejado: manter ultima imagem ativa por 24 h

## Observabilidade

- Logs JSON estruturados em stdout
- Metricas Prometheus expostas em `:9464/metrics` (protegido por IP allowlist)
- Traces OTLP em `/v1/traces` (opcional, perfil `observability`)
- PII scrubbing central via `packages/config::redact`

## Limites praticos atuais

- Rate limit por IP no `/api/v1/auth/login`: 30 req / 5 min
- Rate limit por e-mail normalizado: 5 tentativas em 15 min, com
  backoff exponencial ate 1 h
- Tamanho maximo de payload JSON: 256 kB (apenas para upload e
  importacao; resto usa 64 kB padrao)
- Citadela: ate 10.000 items ativos por workspace pessoal sem throttling
