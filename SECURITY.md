# AegisVault - Politica de Seguranca

## Reportar uma vulnerabilidade

Reporte **privadamente** por e-mail para `security@aegis-vault.example` (assunto: `[SECURITY]`). Nao abra issue publica.

| Severidade | Triagem     | Atualizacao  |
|------------|-------------|--------------|
| Critica    | ate 48 h    | diaria       |
| Alta       | ate 5 dias  | a cada 2 dias|
| Media      | ate 15 dias | semanal      |
| Baixa      | ate 45 dias | quinzenal    |

Use contas e dados ficticios. Nao inclua segredos reais em relatos.

## Versoes suportadas

Apenas a ultima versao de `main` recebe patches. Tags recebem correcoes por ate 90 dias.

## Modelo de ameaca e limites

Resumo executivo em `docs/threat-model.md`. Fora do modelo:
- Comprometimento fisico do dispositivo cliente no momento do uso.
- Malware persistente em nivel de SO.
- Adversario quantico (migracao planejada para Fase 2+).

Limites assumidos:
- Memoria JavaScript nao e apagavel imediatamente.
- Secret manager separado do banco (recomendado, nao exigido na imagem local).
- Perda do segredo de desbloqueio do cofre e irrecuperavel sem codigo de
  recuperacao baixado pelo usuario.

## Recomendacoes de implantacao

1. Use `compose.prod.yaml`. Nao exponha `compose.yaml` em producao.
2. Habilite TLS e HSTS no proxy reverso.
3. Mantenha `SESSION_SECRET` em secret manager; rotacione a cada 90 dias.
4. Habilite backup criptografado e teste restore trimestralmente.
5. Gere SBOM e rode scan de dependencias a cada release.
6. Restrinja Mailpit, MinIO e Postgres a rede privada.
