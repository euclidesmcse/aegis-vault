ARG NODE_VERSION=20.12.2
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate
COPY apps/worker /app/apps/worker
COPY packages /app/packages
COPY package.json pnpm-workspace.yaml /app/
RUN pnpm install --frozen-lockfile --filter @aegis/worker... && pnpm --filter @aegis/worker build
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --gid 1000 aegis && useradd --uid 1000 --gid aegis --shell /bin/bash aegis
COPY --from=builder --chown=aegis:aegis /app/apps/worker/dist /app/apps/worker/dist
USER aegis
CMD ["node", "apps/worker/dist/index.js"]
