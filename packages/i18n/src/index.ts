import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REQUIRED_LOCALES, SOURCE_LOCALE, type Catalog, type LocaleCode } from './types.js';
import { t as tImpl } from './t.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../locales');

const cache = new Map<LocaleCode, Catalog>();

export function loadCatalog(locale: LocaleCode): Catalog {
  const cached = cache.get(locale);
  if (cached) return cached;
  const filePath = path.join(LOCALES_DIR, `${locale}.json`);
  const json = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(json) as Catalog;
  cache.set(locale, parsed);
  return parsed;
}

export function translate(locale: LocaleCode, key: string, vars: Record<string, string | number> = {}): string {
  const cat = loadCatalog(locale);
  const fb = loadCatalog(SOURCE_LOCALE);
  return tImpl(cat, fb, key, locale, vars);
}

export function listAvailableLocales(): LocaleCode[] { return Array.from(REQUIRED_LOCALES); }

export { t as tImpl } from './t.js';
export * from './types.js';
export const I18N_VERSION = '0.1.0';
