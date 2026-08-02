import { describe, expect, it } from 'vitest';
import { redact, loadEnv } from '../src/index.js';

describe('Config redaction', () => {
  it('redacts secret keys', () => {
    const r = redact({ SESSION_SECRET: 'abc', NODE_ENV: 'production' } as Record<string, unknown>);
    expect(r['SESSION_SECRET']).toBe('[REDACTED]');
    expect(r['NODE_ENV']).toBe('production');
  });
});

describe('Config loader', () => {
  it('rejects missing DATABASE_URL', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });
});
