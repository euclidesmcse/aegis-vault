// Tester offline. NUNCA envia a entrada à rede; apenas analiza padrões.

export type StrengthFinding = {
  factor: string;
  weight: number;
  message: string;
};

export type StrengthResult = {
  entropyBits: number;
  level: 'very-weak' | 'weak' | 'fair' | 'strong' | 'excellent';
  findings: StrengthFinding[];
};

const COMMON_PATTERNS = [
  /^123+/,
  /qwerty/i,
  /asdf/i,
  /zxcv/i,
  /password/i,
  /admin/i,
  /welcome/i,
  /letmein/i,
  /football/i,
  /baseball/i,
  /dragon/i,
  /sunshine/i,
  /princess/i,
  /master/i,
  /^1qaz.+wsx/i,
  /qwertyui/i,
];

const COMMON_KEYBOARD_SEQUENCES = [
  'qwerty',
  'asdf',
  'zxcv',
  '1234567890',
  'abcdefghijklmnopqrstuvwxyz',
];

export function analyzePassword(input: string): StrengthResult {
  const findings: StrengthFinding[] = [];
  if (input.length === 0) {
    return {
      entropyBits: 0,
      level: 'very-weak',
      findings: [{ factor: 'empty', weight: 0, message: 'No input provided' }],
    };
  }
  if (input.length < 8) {
    findings.push({
      factor: 'short',
      weight: 30,
      message: 'Muito curta. Recomendamos ao menos 14 caracteres.',
    });
  }
  if (/(.)\1{2,}/.test(input)) {
    findings.push({
      factor: 'repetition',
      weight: 15,
      message: 'Contem 3 ou mais caracteres repetidos em sequencia.',
    });
  }
  if (/^\d+$/.test(input)) {
    findings.push({
      factor: 'digits-only',
      weight: 50,
      message: 'Apenas digitos. Multiplique a entropia incluindo letras.',
    });
  }
  for (const rx of COMMON_PATTERNS) {
    if (rx.test(input)) {
      findings.push({
        factor: 'common-pattern',
        weight: 35,
        message: 'Contem uma palavra ou sequencia comum.',
      });
      break;
    }
  }
  if (hasKeyboardSequence(input)) {
    findings.push({
      factor: 'keyboard-walk',
      weight: 20,
      message: 'Sequencia de teclado previsivel detectada.',
    });
  }
  const charsetClasses =
    (Number(/[a-z]/.test(input)) +
      Number(/[A-Z]/.test(input)) +
      Number(/[0-9]/.test(input)) +
      Number(/[^a-zA-Z0-9]/.test(input)));
  const charsetSize =
    Number(/[a-z]/.test(input)) * 26 +
    Number(/[A-Z]/.test(input)) * 26 +
    Number(/[0-9]/.test(input)) * 10 +
    Number(/[^a-zA-Z0-9]/.test(input)) * 33;
  const entropyMath = Math.log2(Math.max(2, charsetSize)) * input.length;
  const entropyShannon = shannonEntropy(input) * input.length;
  // Activate the discoverable entropy but penalize by findings.
  let baseEntropy = Math.max(entropyMath, entropyShannon);
  let penalty = 0;
  for (const f of findings) penalty += f.weight;
  baseEntropy = Math.max(0, baseEntropy - penalty);
  if (input.length >= 14 && baseEntropy > 80 && charsetClasses >= 3) {
    findings.push({
      factor: 'mixed-classes',
      weight: -10,
      message: 'Boa variacao de classes de caracteres.',
    });
  }
  let level: StrengthResult['level'] = 'fair';
  if (baseEntropy < 28) level = 'very-weak';
  else if (baseEntropy < 48) level = 'weak';
  else if (baseEntropy < 72) level = 'fair';
  else if (baseEntropy < 100) level = 'strong';
  else level = 'excellent';
  return { entropyBits: Math.round(baseEntropy), level, findings };
}

function hasKeyboardSequence(s: string): boolean {
  const lower = s.toLowerCase();
  for (const seq of COMMON_KEYBOARD_SEQUENCES) {
    if (lower.includes(seq.slice(0, 5))) return true;
  }
  // Padrão de runs crescentes/decrescentes a-z ou 0-9.
  let asc = 1, desc = 1;
  for (let i = 1; i < lower.length; i++) {
    const diff = (lower.charCodeAt(i) ?? 0) - (lower.charCodeAt(i - 1) ?? 0);
    if (diff === 1) {
      asc++;
      if (asc >= 5) return true;
    } else asc = 1;
    if (diff === -1) {
      desc++;
      if (desc >= 5) return true;
    } else desc = 1;
  }
  return false;
}

function shannonEntropy(s: string): number {
  const counts: Record<string, number> = {};
  for (const ch of s) counts[ch] = (counts[ch] ?? 0) + 1;
  const total = s.length;
  let h = 0;
  for (const k in counts) {
    const p = (counts[k] ?? 0) / total;
    if (p <= 0) continue;
    h -= p * Math.log2(p);
  }
  return h;
}
