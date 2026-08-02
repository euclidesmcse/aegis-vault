import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function shouldRemap(parentURL) {
  if (!parentURL) return false;
  try {
    const parent = fileURLToPath(parentURL);
    // Substring check avoids any platform-path escape issues.
    return parent.includes('packages');
  } catch {
    return false;
  }
}

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
