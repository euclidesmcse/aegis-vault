import { describe, expect, it } from 'vitest';
// Teste de atomicidade conceitual - a concorrencia real exige banco vivo.
// Aqui verificamos a SQL canonica para evitar mudança acidental.
import fs from 'node:fs';
import path from 'node:path';

describe('Share atomic SQL used in POST /shares/:token/consume', () => {
  it('contains the conditional UPDATE with RETURNING', () => {
    const source = fs.readFileSync(
      path.resolve('apps/api/src/routes/share.ts'), 'utf-8');
    expect(source).toMatch(/UPDATE secure_shares/i);
    expect(source).toMatch(/SET state = 'consumed'/i);
    expect(source).toMatch(/WHERE state = 'active'/i);
    expect(source).toMatch(/RETURNING/i);
    expect(source).toMatch(/expires_at > NOW\(\)/i);
  });

  it('returns generic 410 (no enumeration)', () => {
    const source = fs.readFileSync(
      path.resolve('apps/api/src/routes/share.ts'), 'utf-8');
    expect(source).toMatch(/410/);
    expect(source).not.toMatch(/'expired'.*410.*consumed/);
  });
});
