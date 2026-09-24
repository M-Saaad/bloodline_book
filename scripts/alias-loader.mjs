import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = path.join(root, specifier.slice(2));
    if (!path.extname(target)) {
      target += '.ts';
    }
    return nextResolve(pathToFileURL(target).href, context);
  }
  return nextResolve(specifier, context);
}
