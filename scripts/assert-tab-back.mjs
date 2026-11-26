import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const layout = readFileSync(join(root, 'app/(tabs)/_layout.tsx'), 'utf8');
const tabBack = readFileSync(join(root, 'lib/navigation/tab-back.ts'), 'utf8');

assert.match(layout, /backBehavior=\{tabLayoutBackBehavior\(\)\}/);
assert.match(tabBack, /fullHistory/);
assert.match(tabBack, /history/);

console.log('assert-tab-back: ok');