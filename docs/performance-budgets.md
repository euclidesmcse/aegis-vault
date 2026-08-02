# Performance budgets (Phase 7)

## Paginas publicas (sem auth)

| Pagina | Largest Contentful Paint | Total Blocking Time | Cumulative Layout Shift |
|--------|--------------------------|---------------------|--------------------------|
| `/` landing | < 1.8 s (4G) | < 200 ms | < 0.05 |
| `/password-generator` | < 1.6 s | < 150 ms | < 0.05 |
| `/password-strength` | < 1.4 s | < 100 ms | < 0.05 |
| `/secure-share` (create) | < 1.8 s | < 200 ms | < 0.05 |
| `/s/[token]` (reveal) | < 1.4 s | < 150 ms (apos gesto) | < 0.05 |
| `/auth/login` | < 1.6 s | < 200 ms | < 0.05 |

## API endpoints

| Endpoint | p50 | p99 |
|----------|-----|-----|
| `/api/v1/health` | < 5 ms | < 50 ms (sem DB) |
| `/api/v1/ready` | < 25 ms | < 100 ms |
| `/api/v1/auth/login` (Argon2 real) | 250-500 ms | 800 ms |
| `/api/v1/shares (POST)` | < 50 ms | < 200 ms |
| `/api/v1/shares/:digest/consume` | < 60 ms | < 200 ms |
| `/api/v1/vault/:wid/items (GET 200 itens) | < 100 ms | < 300 ms |
| `/api/v1/vault/:wid/items (POST envelope) | < 80 ms | < 200 ms |

## Bundle sizes do frontend (gzip)

- `/` (landing + hero)              < 90 KiB
- `/password-generator`             < 100 KiB
- `/s/[token]` (reveal)             < 95 KiB
- `/auth/login`                     < 80 KiB
- Shell do app (cofre autenticado)  < 340 KiB
  - libsodium-wrappers WASM (~200 KiB sozinho) e carregado de forma lazy via
    `next/dynamic` dentro de Web Worker apos primeiro paint para nao concorrer
    com LCP. Codigo do shell em si: < 140 KiB.

## Fontes

- Auto-hospedagem de Inter (400/600), Fustat (600), Noto Naskh Arabic (400),
  Noto Sans Devanagari (Hindi), Noto Sans SC (zh-CN).
- Subset em vez de full weight; preconnect preloading NEGADO (sem CDN externo,
  cumpre o spec §14).
- `font-display: swap` em todos os `@font-face`.

## Imagens e midia

- Sem hotlink. Midia gerada localmente (orb SVG inline).
- Imagens em `.webp` quando possivel; `<picture>` com fallback.
- Sem GIFs animados no shell.

## Estrategia de lazy-load para libsodium

O modulo `libsodium-wrappers` (≈200 KiB gzip) e importado via
`await import('@aegis/crypto')` apenas em:

- Primeira interacao do gerador (apos click em Gerar).
- Submit de share (apos o cliente decidir cifrar).
- Restore de export (acao do usuario).
- Unlock do cofre (apos login do usuario).

No landing, gerador (tabs sem valor gerado), tester e paginas de auth, a
biblioteca NAO e carregada. Isso mantém o FCP < 1s mesmo em 4G.

## Como validar

- Lighthouse CI em smoke test antes de release (gate de pre-merge).
- `pagespeed.web.dev` para baseline manual mensal.
- Real User Monitoring (RUM) opcional em prod via OpenTelemetry.
- `next build --turbo` ativa metricas de bundle por rota.
