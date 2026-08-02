#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '../locales');
const REQUIRED_LOCALES = ['en', 'pt-BR', 'es', 'fr', 'zh-CN', 'hi', 'ar'];
const SOURCE_LOCALE = 'en';

// Metadata: any key starting with `_` at any level (e.g. `_reviewNote`,
// `_meta.reviewedBy`) is skipped - it is an operational sentinel, not visible text.
function loadKeys(locale) {
  const file = path.join(LOCALES_DIR, `${locale}.json`);
  if (!fs.existsSync(file)) { console.error(`missing locale: ${locale}`); process.exitCode = 1; return new Set(); }
  const keys = new Set();
  const stack = [{ node: JSON.parse(fs.readFileSync(file, 'utf-8')), prefix: '' }];
  while (stack.length > 0) {
    const { node, prefix } = stack.pop();
    if (typeof node === 'string') { keys.add(prefix); continue; }
    if (node && typeof node === 'object' && 'plural' in node) { keys.add(prefix); continue; }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('_')) continue;
        stack.push({ node: v, prefix: prefix ? `${prefix}.${k}` : k });
      }
    }
  }
  return keys;
}
let ok = true;
const sourceKeys = loadKeys(SOURCE_LOCALE);
for (const locale of REQUIRED_LOCALES) {
  if (locale === SOURCE_LOCALE) continue;
  const target = loadKeys(locale);
  for (const k of sourceKeys) if (!target.has(k)) { console.error(`${locale}: missing key ${k}`); ok = false; }
  for (const k of target) if (!sourceKeys.has(k)) { console.error(`${locale}: extra key ${k}`); ok = false; }
}
if (ok) console.log(`i18n parity OK across ${REQUIRED_LOCALES.length} locales`);
else { console.error('i18n parity FAIL'); process.exit(1); }
