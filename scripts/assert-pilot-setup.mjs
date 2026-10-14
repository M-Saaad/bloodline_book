import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const install = read('app/install.tsx');
const guide = read('app/guide.tsx');
const data = read('app/data.tsx');
const signIn = read('app/(auth)/sign-in.tsx');
const help = read('app/(tabs)/more/help.tsx');
const layout = read('app/_layout.tsx');
const iosWeb = read('lib/pilot/ios-web.ts');
const persist = read('lib/pilot/web-storage-persist.ts');

assert.match(install, /WEB_APP_URL/);
assert.match(read('lib/config/app.ts'), /app\.bloodlinebookapp\.com/);
assert.match(install, /Add to Home screen|Install app/i);
assert.match(install, /SUPPORT_EMAIL/);

assert.match(guide, /Your first 10 goats/);
assert.match(guide, /name or a tag number/);
assert.match(guide, /href="\/data"/);

assert.match(data, /DATA_PAGE_TITLE/);
assert.match(read('lib/pilot/data-page-sections.ts'), /Your herd data/);
assert.match(read('lib/pilot/data-page-sections.ts'), /PowerSync/);
assert.match(read('lib/pilot/data-page-sections.ts'), /Backblaze/);
assert.match(read('lib/config/data-storage.ts'), /BACKUP_B2_REGION/);
assert.match(read('lib/config/data-storage.ts'), /POWERSYNC_CLOUD_REGION_PLACE/);

assert.match(signIn, /How to get started/);
assert.match(signIn, /href="\/install"/);
assert.match(help, /href="\/install"/);
assert.match(help, /href="\/guide"/);
assert.match(help, /href="\/data"/);

const signUp = read('app/(auth)/sign-up.tsx');
assert.match(signUp, /href="\/data"/);
assert.match(signUp, /Read more/);

assert.match(install, /href="\/data"/);

assert.match(layout, /name="install"/);
assert.match(layout, /name="guide"/);
assert.match(layout, /name="data"/);

assert.match(iosWeb, /isIosSafariBrowser/);
assert.match(iosWeb, /isStandaloneWebApp/);
assert.match(iosWeb, /pathname === '\/install'/);
assert.match(iosWeb, /pathname === '\/data'/);

assert.match(persist, /navigator\.storage/);
assert.match(persist, /persist\(/);

const iosGate = read('components/pilot/IosAddToHomeScreenGate.tsx');
assert.match(iosGate, /Continue in browser anyway/);

assert.doesNotMatch(
  read('package.json'),
  /"playwright"|"sharp"/,
  'playwright/sharp must live under tools/pilot-guide-capture only',
);

const guideDir = path.join(root, 'assets/pilot-guide');
const expectedShots = [
  'sign-up.webp',
  'create-farm.webp',
  'add-goat.webp',
  'herd-list.webp',
  'family-tree.webp',
  'record-weight.webp',
];
for (const file of expectedShots) {
  const full = path.join(guideDir, file);
  assert.ok(fs.existsSync(full), `missing ${file}`);
  const size = fs.statSync(full).size;
  assert.ok(size > 0, `${file} is empty`);
  assert.ok(
    size < 150 * 1024,
    `${file} should be under 150 KB (got ${size})`,
  );
}

console.log('assert-pilot-setup: ok');
