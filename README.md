# AegisVault

> Plataforma web, com criptografia no cliente, para geracao, armazenamento, organizacao e compartilhamento seguro de senhas e segredos.

AegisVault e um monorepo executavel com frontend (Next.js), API (Fastify), worker assincrono, persistencia em PostgreSQL, cache/fila em Redis, armazenamento de objetos compativel com S3 e stack operacional via Docker Compose. Todo conteudo visivel vem de catalogos de internacionalizacao em sete idiomas e a interface arabe e executada em RTL semantico.

> **Aviso de transparencia.** Nenhuma auditoria independente de seguranca foi realizada ate a data deste release. Leia `SECURITY.md` e `docs/threat-model.md` antes de armazenar segredos reais em escala. Nenhuma afirmacao de "zero-knowledge" ou conformidade regulatoria e feita sem evidencia publicada.

## Composicao do repositorio

```
aegis-vault/
├─ apps/
│  ├─ web/        # Aplicacao Next.js (paginas publicas + cofre)
│  ├─ api/        # API HTTP (Fastify) - auth, cofre, share, admin
│  └─ worker/     # Processos assincronos - mail, expiracao, importacoes
├─ packages/
│  ├─ crypto/     # KDF Argon2id + AEAD XChaCha20-Poly1305 + envelopes
│  ├─ contracts/  # Schemas Zod compartilhados entre apps
│  ├─ authz/      # Avaliador RBAC+ABAC e matriz de autorizacao
│  ├─ i18n/       # Catalogos (en, pt-BR, es, fr, zh-CN, hi, ar) + paridade
│  ├─ ui/         # Design tokens e primitivos acessiveis
│  ├─ config/     # Validacao tipada do ambiente
│  └─ testing/    # Fixtures ficticias e helpers
├─ infra/
│  ├─ compose.yaml
│  ├─ compose.prod.yaml
│  └─ docker/
├─ docs/
│  ├─ threat-model.md
│  ├─ cryptography.md
│  ├─ authorization-matrix.md
│  ├─ assumptions.md
│  ├─ product-spec.md
│  ├─ roadmap.md
│  ├─ operations.md
│  ├─ backup-restore.md
│  └─ incident-response.md
└─ scripts/
   ├─ install.sh
   ├─ backup.sh
   └─ restore.sh
```

## Inicio rapido (Linux + Docker)

Pre-requisitos: Docker 24+, Docker Compose v2.

```bash
git clone https://example.com/aegis-vault.git
cd aegis-vault
cp .env.example .env
./scripts/install.sh        # verifica pre-requisitos e gera secrets
docker compose up -d --build
```

Servicos expostos:

| Servico       | URL                              |
|---------------|----------------------------------|
| Web           | http://localhost:3000            |
| API           | http://localhost:3001/api/v1     |
| Mailpit       | http://localhost:8025            |
| MinIO console | http://localhost:9001            |

## Criptografia

- Argon2id para derivacao (RFC 9106) e verificacao de senha
- XChaCha20-Poly1305-IETF (libsodium) para cifracao de conteudo
- Tokens de compartilhamento: digest SHA-256 no servidor, chave no fragmento `#`
- Envelopes versionados em base64url com AAD vinculado a `tenant:item:type`

Detalhes completos em `docs/cryptography.md` e `docs/threat-model.md`.

## Licenca

`LICENSE` (GPL-3.0). Substituicao do tipo de licenca exige aprovacao do proprietario.
