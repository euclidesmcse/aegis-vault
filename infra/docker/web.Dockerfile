# Multi-stage build para apps/web.
# Stage 1: deps + build via pnpm.
ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc* /app/
COPY apps/web/package.json /app/apps/web/
COPY packages/*/package.json /app/packages/
RUN pnpm fetch --frozen-lockfile || true

FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
COPY --from=deps /app /app
COPY apps/web /app/apps/web
COPY packages /app/packages
RUN pnpm install --frozen-lockfile --filter @aegis/web... --filter @aegis/crypto --filter @aegis/i18n --filter @aegis/ui --filter @aegis/contracts --filter @aegis/authz --filter @aegis/config && pnpm --filter @aegis/web build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --gid 1000 aegis && useradd --uid 1000 --gid aegis --shell /bin/bash aegis
COPY --from=builder --chown=aegis:aegis /app/apps/web/.next /app/apps/web/.next
COPY --from=builder --chown=aegis:aegis /app/apps/web/public /app/apps/web/public
COPY --from=builder --chown=aegis:aegis /app/apps/web/package.json /app/apps/web/package.json
USER aegis
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s CMD ["wget", "-qO-", "http://localhost:3000/"]
CMD ["pnpm", "--filter", "@aegis/web", "start"]
