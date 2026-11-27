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

// Tab visit history must not reset when nested stacks remount on farm switch.
assert.doesNotMatch(layout, /useFarmScopeKey/);
for (const rel of [
  'app/(tabs)/livestock/_layout.tsx',
  'app/(tabs)/more/_layout.tsx',
  'app/(tabs)/more/breeding/_layout.tsx',
]) {
  assert.match(readFileSync(join(root, rel), 'utf8'), /useFarmScopeKey/);
}

console.log('assert-tab-back: ok');