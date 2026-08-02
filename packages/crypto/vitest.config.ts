import { defineConfig } from 'vitest/config';

// libsodium-wrappers-sumo 0.8.4 tem entry ESM autocontido: importa o specifier
// 'libsodium-sumo' (resolvido normalmente sob pnpm) e expõe todos os algoritmos
// usados pelo pacote (Argon2id, SHA-256, XChaCha20-Poly1305-IETF). Sem alias:
// o vitest roda direto contra o libsodium REAL via ESM nativo.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // totp.test.ts é um script standalone (node:assert + process.exit), não uma
    // suíte vitest — roda direto via Node (há também totp.test.mjs).
    exclude: ['test/totp.test.ts', 'node_modules/**'],
    globals: false,
    testTimeout: 20_000,
  },
});
