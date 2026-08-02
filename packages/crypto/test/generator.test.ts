import { describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import {
  generatePassword,
  generatePin,
  estimateEntropyBits,
  generatePassphrase,
} from '../src/generator.js';

await sodium.ready;

describe('Password generator', () => {
  it('AC-GEN-001: generated password respects length and selected classes', async () => {
    for (let i = 0; i < 100; i++) {
      const pwd = await generatePassword({
        length: 24,
        upper: true,
        lower: true,
        digits: true,
        symbols: true,
        excludeAmbiguous: false,
        requireEach: true,
      });
      expect(pwd).toHaveLength(24);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true);
    }
  });

  it('uses CSPRNG: not Math.random', async () => {
    // Test indiretamente: 1000 senhas nao se repetem em sequencia.
    const pool = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const pwd = await generatePassword({
        length: 16,
        upper: true,
        lower: true,
        digits: false,
        symbols: false,
        excludeAmbiguous: true,
        requireEach: false,
      });
      expect(pool.has(pwd)).toBe(false);
      pool.add(pwd);
    }
  });

  it('excludes ambiguous on demand', async () => {
    for (let i = 0; i < 100; i++) {
      const pwd = await generatePassword({
        length: 32,
        upper: true,
        lower: true,
        digits: true,
        symbols: false,
        excludeAmbiguous: true,
        requireEach: false,
      });
      expect(/[Il1O0o]/.test(pwd)).toBe(false);
    }
  });

  it('rejects invalid lengths', async () => {
    await expect(
      generatePassword({
        length: 3,
        upper: true,
        lower: true,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
        requireEach: false,
      }),
    ).rejects.toThrow();
    await expect(
      generatePassword({
        length: 257,
        upper: true,
        lower: true,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
        requireEach: false,
      }),
    ).rejects.toThrow();
  });
});

describe('Passphrase generator', () => {
  it('produces expected number of tokens', async () => {
    const wl = ['apple', 'blue', 'chair', 'delta', 'eagle', 'fox'];
    const p = await generatePassphrase({
      words: 4,
      separatorLength: 1,
      capitalize: 'first',
      includeNumber: false,
      wordlist: wl,
    });
    // O separador é sorteado entre '-_. ' (EFF-style), nao fixo em '-'.
    expect(p.split(/[-_. ]/)).toHaveLength(4);
  });
});

describe('PIN generator', () => {
  it('returns only digits', async () => {
    for (let i = 0; i < 100; i++) {
      const pin = await generatePin({ length: 6 });
      expect(pin).toMatch(/^[0-9]{6}$/);
    }
  });
});

describe('Entropy estimate', () => {
  it('longer mixed password has higher entropy', () => {
    const a = estimateEntropyBits('aaaaaaaa');
    const b = estimateEntropyBits('Aa1!Aa1!Aa1!Aa1!');
    expect(b).toBeGreaterThan(a);
  });
});
