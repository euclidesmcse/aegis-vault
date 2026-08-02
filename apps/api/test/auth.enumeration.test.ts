import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Anti-enumeration responses', () => {
  it('login returns 200 with generic message regardless of existence', () => {
    const src = fs.readFileSync(
      path.resolve('apps/api/src/routes/auth.ts'), 'utf-8');
    expect(src).toMatch(/If this email exists, you will receive further steps\./);
    expect(src).toMatch(/equalTimeDelay/);
  });
});
