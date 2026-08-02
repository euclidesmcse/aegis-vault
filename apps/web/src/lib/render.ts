import { loadCatalog, translate, type LocaleCode, directionFor, normalizeLocale } from '@aegis/i18n';

export interface PageContext { locale: LocaleCode; direction: 'ltr' | 'rtl'; t: (key: string, vars?: Record<string, string | number>) => string; }

export async function getPageContext(rawLocale: string | undefined): Promise<PageContext> {
  const locale = (rawLocale && normalizeLocale(rawLocale)) || 'pt-BR';
  loadCatalog(locale);
  return {
    locale,
    direction: directionFor(locale),
    t: (key, vars) => translate(locale, key, vars ?? {}),
  };
}
