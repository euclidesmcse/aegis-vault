# ADR 0001 - Stack e layout de modulos

## Status

Aceito.

## Contexto

O prompt pede monorepo TypeScript com Next.js, NestJS ou equivalente,
PostgreSQL, Redis, S3, SMTP e OpenTelemetry. A escolha de cada tecnologia
impacta diretamente na velocidade de entrega e na conflacao de
responsabilidades em pacotes.

## Decisao

1. **Monorepo**: pnpm workspaces (com fallback npm documentedo).
2. **Frontend**: Next.js 14 (App Router) com `[locale]` segmentado e
   loaders autenticados no servidor.
3. **API**: Fastify com plugins estruturados (modulos equivalentes a
   NestJS). Justifica-se pela reducao de cerimonias e por oferecer
   schema JSON nativa com Type Provider.
4. **ORM**: Drizzle. Schema em TypeScript, migrations em SQL versionado.
5. **Filas**: BullMQ sobre Redis.
6. **Cache**: Redis com chave namespaced por `tenantId`.
7. **Observabilidade**: Pino (logs), OpenTelemetry SDK (traces), Prometheus
   exposition (metrics) - ativado por profile `observability`.
8. **Testes**: Vitest para unit/property, Playwright para E2E + a11y.
9. **Container**: multi-stage, non-root, distroless quando possivel.

## Consequencias

- Substituir NestJS por Fastify exige documentacao explicita na
  chegada de novos contribuidores.
- Drizzle exige disciplina para manter migrations sincronizadas com
  schema TS (CI falharia no `drizzle-kit check`).
- Vitest roda o mesmo codigo client-side; cumplicidade via `vi.useFakeTimers()`.

## Alternativas consideradas

- NestJS: forte, mas +30% de cerimonias.
- Prisma: query engine binario; menos estavel para RLS.
- Kysely: query builder puro; perdemos o typecheck nas joints.
