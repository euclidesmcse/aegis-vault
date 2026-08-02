export const REQUIRED_LOCALES = ['en', 'pt-BR', 'es', 'fr', 'zh-CN', 'hi', 'ar'] as const;
export const SOURCE_LOCALE = 'en';
export const RTL_LOCALES = new Set(['ar', 'he', 'fa']);

export type LocaleCode = typeof REQUIRED_LOCALES[number];
export type Direction = 'ltr' | 'rtl';

export type CatalogNode =
  | string
  | { plural: Record<string, string> }
  | { [key: string]: CatalogNode };

export type Catalog = Record<string, CatalogNode>;

export type InterpolationVars = Record<string, string | number>;

export function directionFor(locale: LocaleCode): Direction {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function normalizeLocale(input: string): LocaleCode | null {
  const lower = input.toLowerCase().replace('_', '-');
  for (const l of REQUIRED_LOCALES) {
    if (l.toLowerCase() === lower) return l;
  }
  const head = lower.split('-')[0];
  switch (head) {
    case 'en': return 'en';
    case 'pt': return 'pt-BR';
    case 'es': return 'es';
    case 'fr': return 'fr';
    case 'zh': return 'zh-CN';
    case 'hi': return 'hi';
    case 'ar': return 'ar';
    default: return null;
  }
}
