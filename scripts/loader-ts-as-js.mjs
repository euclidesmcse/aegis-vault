import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
    return nextResolve(specifier, context);
  }
  let baseDir = null;
  if (context.parentURL) {
    try { baseDir = dirname(fileURLToPath(context.parentURL)); } catch {}
  }
  if (baseDir && specifier.endsWith('.js')) {
    const tsSpec = specifier.slice(0, -3) + '.ts';
    const tsPath = join(baseDir, tsSpec);
    if (existsSync(tsPath)) {
      return nextResolve(tsSpec, context);
    }
  }
  return nextResolve(specifier, context);
}
