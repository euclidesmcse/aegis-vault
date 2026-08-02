import { describe, expect, it } from 'vitest';
import { analyzePassword } from '../src/strength.js';

describe('Password strength', () => {
  it('classifies common passwords as weak', () => {
    const r = analyzePassword('12345678');
    expect(['very-weak', 'weak']).toContain(r.level);
  });
  it('flags long random as strong', () => {
    const r = analyzePassword('X#7f9!kQ2vR3%Y@aP$8nKw5eT6y_U1');
    expect(['strong', 'excellent']).toContain(r.level);
  });
  it('detects repetition', () => {
    const r = analyzePassword('aaabbbcccddd');
    expect(r.findings.some((f) => f.factor === 'repetition')).toBe(true);
  });
  it('detects keyboard walk', () => {
    const r = analyzePassword('qwertyuiopasdf');
    expect(r.findings.some((f) => f.factor === 'keyboard-walk')).toBe(true);
  });
});
