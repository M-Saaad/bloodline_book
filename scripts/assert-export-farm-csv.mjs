import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  farmScopedTablesFromMigrations,
  toCsv,
} from './export-farm-csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'export-farm-csv.mjs');
const FAKE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-role-key.test-signature';

function runExport(args, { env = {}, input } = {}) {
  const childEnv = { ...process.env, ...env };
  delete childEnv.SUPABASE_URL;
  delete childEnv.SUPABASE_SERVICE_ROLE_KEY;
  Object.assign(childEnv, env);
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: childEnv,
    input,
    encoding: 'utf8',
  });
}

const tables = await farmScopedTablesFromMigrations();
assert.deepEqual(tables, [
  'breeds',
  'animals',
  'weigh_sessions',
  'weight_logs',
  'kidding_events',
  'breeding_events',
  'health_records',
  'transactions',
  'documents',
  'tasks',
  'pastures',
  'grazing_records',
  'feed_logs',
]);
assert.ok(!tables.includes('farm_members'));
assert.ok(!tables.includes('farm_invites'));

const maps = {
  animals: new Map([
    ['a1', { name: 'Daisy', tag_number: 'T1' }],
  ]),
  breeds: new Map(),
  pastures: new Map(),
  sessions: new Map(),
  kidding: new Map(),
};
const csv = toCsv('health_records', [
  { id: 'h1', farm_id: 'f1', animal_id: 'a1', date: '2026-01-01' },
], maps);
assert.match(csv, /animal_id,animal_name,animal_tag/);
assert.match(csv, /a1,Daisy,T1/);

let result = runExport([]);
assert.equal(result.status, 1);
assert.match(result.stderr, /Usage: node scripts\/export-farm-csv\.mjs/);

result = runExport(['Demo Farm'], {
  env: {
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  },
});
assert.equal(result.status, 1);
assert.match(result.stderr, /Missing SUPABASE_URL/);

result = runExport(['Demo Farm'], {
  env: {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
  },
  input: 'no\n',
});
assert.equal(result.status, 1);
assert.match(result.stdout, /Supabase project URL: https:\/\/example\.supabase\.co/);
assert.match(result.stderr, /Aborted\./);
assert.doesNotMatch(`${result.stdout}${result.stderr}`, /FAKE|test-role-key/);

console.log('assert-export-farm-csv: ok');
