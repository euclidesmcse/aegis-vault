import type { Catalog, CatalogNode, InterpolationVars, LocaleCode } from './types.js';

function pluralCategory(n: number, locale: LocaleCode): string {
  const rules = new Intl.PluralRules(locale);
  return rules.select(n);
}

function resolveKey(catalog: Catalog, key: string): CatalogNode | undefined {
  const parts = key.split('.');
  let cur: CatalogNode | undefined = catalog;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null || Array.isArray(cur)) return undefined;
    if ('plural' in cur) return cur;
    cur = (cur as Record<string, CatalogNode>)[p];
  }
  return cur;
}

function interpolate(text: string, vars: InterpolationVars, locale: LocaleCode): string {
  const segments = text.split(/(\{[^{}]*\})/g);
  let out = '';
  for (const seg of segments) {
    if (!seg) continue;
    if (!(seg.startsWith('{') && seg.endsWith('}'))) {
      out += seg;
      continue;
    }
    const inner = seg.slice(1, -1);
    const parts = inner.split(',').map((p) => p.trim());
    const varName = parts[0];
    if (!varName) continue;
    const value = vars[varName] ?? '';
    if (parts.length === 1) { out += String(value); continue; }
    const kind = parts[1];
    if (kind === 'plural') {
      const n = typeof value === 'number' ? value : Number(value);
      const cat = pluralCategory(n, locale);
      const ruleMap = new Map<string, string>();
      let buf: string | null = null;
      for (let i = 2; i < parts.length; i++) {
        const tok = parts[i];
        if (!tok) continue;
        if (tok.startsWith('=') || ['zero', 'one', 'two', 'few', 'many', 'other'].includes(tok)) {
          buf = tok;
        } else if (tok.startsWith('{') && buf !== null) {
          ruleMap.set(buf, tok.slice(1, -1));
          buf = null;
        }
      }
      const exact = `=${n}`;
      out += interpolate(ruleMap.get(exact) ?? ruleMap.get(cat) ?? ruleMap.get('other') ?? '', vars, locale);
    } else if (kind === 'select') {
      const ruleMap = new Map<string, string>();
      let buf: string | null = null;
      for (let i = 2; i < parts.length; i++) {
        const tok = parts[i];
        if (!tok) continue;
        if (!tok.startsWith('{')) buf = tok;
        else if (buf !== null) { ruleMap.set(buf, tok.slice(1, -1)); buf = null; }
      }
      out += interpolate(ruleMap.get(String(value)) ?? ruleMap.get('other') ?? '', vars, locale);
    } else {
      out += String(value);
    }
  }
  return out;
}

export function t(cat: Catalog, fb: Catalog, key: string, locale: LocaleCode, vars: InterpolationVars = {}): string {
  const node = resolveKey(cat, key) ?? resolveKey(fb, key);
  if (typeof node === 'string') return interpolate(node, vars, locale);
  if (node && typeof node === 'object' && 'plural' in (node as Record<string, unknown>)) {
    const plurals = (node as { plural: Record<string, string> }).plural;
    const n = Number(vars['count']);
    const cat = pluralCategory(n, locale);
    const raw = plurals[`=${n}`] ?? plurals[cat] ?? plurals['other'] ?? '{count}';
    return interpolate(raw, vars, locale);
  }
  return key;
}
