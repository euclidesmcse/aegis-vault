// Minimo de helpers JSON deterministico para envelopes canonicos.
// Nao depende de bibliotecas externas.

export function JSONStringifyStable(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    out[k] = canonicalize(obj[k]);
  }
  return out;
}

export function JSONParseStrict(raw: string): unknown {
  return JSON.parse(raw);
}
