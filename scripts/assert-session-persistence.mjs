import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { selectAuthStorageKind } from '../lib/supabase/auth-storage.ts';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`unclosed ${name}`);
}

assert.equal(selectAuthStorageKind('android', false), 'async-storage');
assert.equal(selectAuthStorageKind('ios', false), 'async-storage');
assert.equal(selectAuthStorageKind('android', true), 'async-storage');
assert.equal(selectAuthStorageKind('ios', true), 'async-storage');
assert.equal(selectAuthStorageKind('web', false), 'memory');
assert.equal(selectAuthStorageKind('web', true), 'async-storage');

const client = read('lib/supabase/client.ts');
assert.match(client, /selectAuthStorageKind\(Platform\.OS,/);
assert.doesNotMatch(client, /typeof window === 'undefined'\s*\?/);
assert.match(client, /persistSession:\s*true/);
assert.match(client, /storage:\s*authStorage/);

const provider = read('providers/PowerSyncProvider.tsx');
assert.doesNotMatch(provider, /disconnectAndClear/);
const loadingGuard = provider.indexOf('if (isLoading)');
const disconnectCall = provider.indexOf('disconnectPowerSync()');
assert.ok(loadingGuard !== -1 && disconnectCall !== -1 && loadingGuard < disconnectCall);

for (const file of [
  'lib/powersync/system.native.ts',
  'lib/powersync/system.web.ts',
]) {
  const source = read(file);
  assert.match(source, /dbFilename: 'bloodline\.db'/);
  assert.doesNotMatch(source, /:memory:|location:\s*'memory'|dbFilename:\s*`/);
  const reconnect = functionBody(source, 'reconnectPowerSync');
  assert.doesNotMatch(reconnect, /disconnectAndClear/);
  assert.match(reconnect, /disconnect\(/);
}

const more = read('app/(tabs)/more/index.tsx');
const discard = functionBody(more, 'handleSignOutAndDiscard');
const confirmAt = discard.indexOf('confirmAction');
const clearAt = discard.indexOf('disconnectAndClearPowerSync');
assert.ok(confirmAt !== -1 && clearAt !== -1 && confirmAt < clearAt);
assert.doesNotMatch(functionBody(more, 'handleSignOut'), /disconnectAndClear/);

const clearCallFiles = walk(root)
  .filter((file) => read(path.relative(root, file)).includes('disconnectAndClear'))
  .map((file) => path.relative(root, file))
  .sort();

assert.deepEqual(clearCallFiles, [
  'app/(tabs)/more/index.tsx',
  'lib/powersync/system.native.ts',
  'lib/powersync/system.web.ts',
]);

console.log('assert-session-persistence: ok');
