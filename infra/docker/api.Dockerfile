ARG NODE_VERSION=20.12.2
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
COPY apps/api /app/apps/api
COPY packages /app/packages
COPY package.json pnpm-workspace.yaml /app/
RUN pnpm install --frozen-lockfile --filter @aegis/api... && pnpm --filter @aegis/api build
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --gid 1000 aegis && useradd --uid 1000 --gid aegis --shell /bin/bash aegis
COPY --from=builder --chown=aegis:aegis /app/apps/api/dist /app/apps/api/dist
COPY --from=builder --chown=aegis:aegis /app/apps/api/package.json /app/apps/api/package.json
COPY --from=builder --chown=aegis:aegis /app/apps/api/db/migrations /app/apps/api/db/migrations
USER aegis
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s CMD ["wget", "-qO-", "http://localhost:3001/api/v1/health"]
CMD ["node", "apps/api/dist/server.js"]
