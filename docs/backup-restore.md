# Backup e restore

## Estrategia

- Backup diario `pg_dump` cifrado em repouso (chave GPG em KMS)
- Retencao: 7 diarios, 4 semanais, 12 mensais
- Backup incremental de bucket S3 em `infra/data/snapshots` via snapshot
  MinIO + replicacao para S3 remoto
- Teste de restore agendado (`scripts/restore.sh --dry-run`) e registro
  em `audit_events`

## Execucao manual

```bash
# Backup
./scripts/backup.sh

# Restore em ambiente isolado
./scripts/restore.sh /var/backups/aegis-2024-09-01.tar.gz.age
```

## Conteudo do backup

- `pg_dump` custom (`-Fc`)
- Snapshot de bucket S3 (sem cifras - conteudo ja em envelope)
- Manifesto JSON com hashes SHA-256, contagens e timestamps
- Manifesto cifrado em `manifest.age`

## Conteudo **NAO** incluido

- Cache e fila Redis (recriado sob demanda)
- Logs estruturados (enviados para sink externo)
- Telemetria opt-in apenas em agregado

## Verificacoes de restore

1. Restore em Postgres isolado
2. Replay das migrations ate o ponto do backup
3. Validacao por contagem de tabelas criticas
4. **Nenhum segredo descriptografado** - o teste compara tamanho de
   `vault_items.envelope.ct` antes e depois
5. Limpeza do ambiente de teste

## Runbook de incidente (sumario)

Vide `docs/incident-response.md` para o fluxo completo.

## Carta de PoR (limite)

Como todos os conteudos sao cifrados no cliente, perda do segredo do cofre
ou do codigo de recuperacao resultara em perda irrecuperavel do conteudo
do cofre. Backup nao substitui保管 de credenciais de recuperacao.
