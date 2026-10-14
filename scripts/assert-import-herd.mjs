import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  guessColumnMapping,
  mergeColumnMapping,
  pickMappedRow,
} from './herd-import/column-map.mjs';
import { buildImportPlan } from './herd-import/plan.mjs';
import {
  excelSerialToIso,
  normalizeDateOfBirth,
  normalizeSex,
  parseRegistrationBody,
} from './herd-import/normalize.mjs';
import { resolveParentReference, buildAnimalLookup } from './herd-import/pedigree.mjs';
import { parseImportArgv } from './import-herd.mjs';
import { readSpreadsheet } from './herd-import/read-spreadsheet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'import-herd.mjs');
const FIXTURE = join(ROOT, 'scripts', 'fixtures', 'messy-herd-import.xlsx');
const FAKE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-role-key.test-signature';

function runImport(args, { env = {}, input } = {}) {
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

// Sex normalization
assert.deepEqual(normalizeSex('Doe'), { sex: 'female', wetherNote: false, problem: null });
assert.deepEqual(normalizeSex('Buck'), { sex: 'male', wetherNote: false, problem: null });
assert.deepEqual(normalizeSex('Wether'), { sex: 'male', wetherNote: true, problem: null });
assert.deepEqual(normalizeSex('f'), { sex: 'female', wetherNote: false, problem: null });

// Dates
assert.equal(normalizeDateOfBirth('3/15/2019').iso, '2019-03-15');
assert.equal(normalizeDateOfBirth('5/18/22').iso, '2022-05-18');
assert.equal(normalizeDateOfBirth('2020-08-01').iso, '2020-08-01');
assert.equal(excelSerialToIso(43465), '2018-12-31');

// Registration body
assert.equal(parseRegistrationBody('ABGA registry').body, 'abga');
assert.equal(parseRegistrationBody('ADGA').body, 'adga');

// Column guess
const headers = ['Goat Name', 'Ear Tag', 'Sex', 'Birth Date', 'Breed', '%', 'Dam', 'Sire'];
const guessed = guessColumnMapping(headers);
assert.equal(guessed.name, 'Goat Name');
assert.equal(guessed.tag, 'Ear Tag');
assert.equal(guessed.dam, 'Dam');

const merged = mergeColumnMapping(guessed, { mother: 'Dam' });
assert.equal(merged.dam, 'Dam');

// Pedigree resolution
const lookup = buildAnimalLookup([
  { id: 'a1', name: 'Big Mama', tag_number: '101' },
  { id: 'a2', name: 'Ace', tag_number: 'B02' },
]);
const damByTag = resolveParentReference('101', lookup);
assert.equal(damByTag.id, 'a1');
const sireByName = resolveParentReference('Ace', lookup);
assert.equal(sireByName.id, 'a2');
const outside = resolveParentReference('Outside Buck', lookup);
assert.equal(outside.externalName, 'Outside Buck');

// Plan dry-run on fixture (no DB)
const { rows, headers: fixtureHeaders } = await readSpreadsheet(FIXTURE);
assert.ok(rows.length >= 38);
const mapping = guessColumnMapping(fixtureHeaders);
const plan = buildImportPlan({
  rows,
  headers: fixtureHeaders,
  mapping,
  existingAnimals: [],
  breeds: [
    { id: 'boer', name: 'Boer', farm_id: null },
    { id: 'kiko', name: 'Kiko', farm_id: null },
    { id: 'spanish', name: 'Spanish', farm_id: null },
    { id: 'sav', name: 'Savanna', farm_id: null },
  ],
  referenceIso: '2026-10-14',
});
assert.ok(plan.toInsert.length >= 35);
assert.equal(plan.skipped.length, 0);
assert.equal(plan.problems.length, 0);

const rex = plan.toInsert.find((r) => r.record.name === 'Rex Jr');
assert.ok(rex);
assert.equal(
  rex.record.dam_id,
  plan.toInsert.find((r) => r.record.name === 'Big Mama')?.record.id,
);
assert.equal(rex.record.sire_external_name, 'Thunder');

const waldo = plan.toInsert.find((r) => r.record.name === 'Waldo');
assert.ok(waldo);
assert.match(waldo.record.notes ?? '', /wether/i);

// CLI guards
let result = runImport([]);
assert.equal(result.status, 1);
assert.match(result.stderr, /Usage: node scripts\/import-herd\.mjs/);

result = runImport(['Farm', 'missing.xlsx'], {
  env: {
    SUPABASE_URL: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  },
});
assert.equal(result.status, 1);
assert.match(result.stderr, /Missing SUPABASE_URL/);

result = runImport(['Farm', FIXTURE], {
  env: {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: FAKE_KEY,
  },
  input: 'no\n',
});
assert.equal(result.status, 1);
assert.match(result.stdout, /Supabase project URL: https:\/\/example\.supabase\.co/);
assert.doesNotMatch(`${result.stdout}${result.stderr}`, /test-role-key/);

const argv = parseImportArgv([
  'node',
  'import-herd.mjs',
  'My Farm',
  'sheet.xlsx',
  '--map',
  'map.json',
  '--sheet',
  'Herd',
  '--apply',
]);
assert.equal(argv.farmQuery, 'My Farm');
assert.equal(argv.filePath, 'sheet.xlsx');
assert.equal(argv.mapPath, 'map.json');
assert.equal(argv.sheet, 'Herd');
assert.equal(argv.apply, true);

console.log('assert-import-herd: ok');
