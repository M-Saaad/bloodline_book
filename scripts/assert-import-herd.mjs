import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

import {
  guessColumnMapping,
  mergeColumnMapping,
  pickMappedRow,
} from './herd-import/column-map.mjs';
import { buildImportPlan } from './herd-import/plan.mjs';
import {
  asTagText,
  excelSerialToIso,
  normalizeDateOfBirth,
  normalizeSex,
  parseRegistrationBody,
} from './herd-import/normalize.mjs';
import { resolveParentReference, buildAnimalLookup } from './herd-import/pedigree.mjs';
import { parseImportArgv, runImport as runImportPlan } from './import-herd.mjs';
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
assert.equal(argv.offline, false);
assert.equal(argv.sex, null);

// Tags stay text, including leading zeros. Official ID is the scrapie tag.
assert.equal(asTagText('0001'), '0001');
assert.equal(asTagText('0042'), '0042');
assert.equal(asTagText(58), '58');
assert.equal(asTagText('  244A  '), '244A');
assert.equal(asTagText(''), null);

const idHeaders = ['name', 'tag_number', 'official_id', 'sex'];
const idMapping = guessColumnMapping(idHeaders);
assert.equal(idMapping.name, 'name');
assert.equal(idMapping.tag, 'tag_number');
assert.equal(idMapping.official_id, 'official_id');
assert.equal(idMapping.sex, 'sex');

const scrapieHeaders = guessColumnMapping(['Scrapie tag', 'Ear Tag', 'Sex']);
assert.equal(scrapieHeaders.official_id, 'Scrapie tag');
assert.equal(scrapieHeaders.tag, 'Ear Tag');

const identityRows = [
  { name: '', tag_number: 'T100', official_id: '', sex: 'doe' },
  { name: '', tag_number: '', official_id: '0001', sex: 'female' },
  { name: 'Nanny', tag_number: '', official_id: '', sex: 'f' },
  { name: 'Clover', tag_number: '', official_id: '', sex: 'Doe' },
  { name: '', tag_number: 'T10A', official_id: '0042', sex: 'female' },
  { name: '', tag_number: '', official_id: '0001', sex: 'female' },
  { name: '', tag_number: 'T100', official_id: '', sex: 'female' },
  { name: '', tag_number: '', official_id: '', sex: 'female' },
];
const identityPlan = buildImportPlan({
  rows: identityRows,
  headers: idHeaders,
  mapping: idMapping,
  existingAnimals: [],
  breeds: [],
  referenceIso: '2026-11-26',
});
assert.equal(identityPlan.toInsert.length, 5);
assert.equal(identityPlan.problems.length, 3);
const scrapie = identityPlan.toInsert.find((row) => row.record.official_id === '0001');
assert.ok(scrapie);
assert.equal(scrapie.record.tag_number, null);
assert.equal(scrapie.record.name, null);
assert.equal(scrapie.record.sex, 'female');
assert.equal(scrapie.record.status, 'active');
assert.equal(scrapie.record.lifecycle_stage, 'breeding');
assert.equal(scrapie.record.date_of_birth, null);
assert.equal(scrapie.record.breed_primary_id, null);
const nanny = identityPlan.toInsert.find((row) => row.record.name === 'Nanny');
assert.ok(nanny);
assert.equal(nanny.record.tag_number, null);
assert.equal(nanny.record.official_id, null);
assert.equal(nanny.record.lifecycle_stage, 'breeding');
const tagged = identityPlan.toInsert.find((row) => row.record.tag_number === 'T10A');
assert.equal(tagged.record.official_id, '0042');
assert.ok(
  identityPlan.problems.some((problem) => problem.reason.includes('Duplicate official ID')),
);
assert.ok(
  identityPlan.problems.some((problem) => problem.reason.includes('Duplicate tag')),
);
assert.ok(
  identityPlan.problems.some((problem) => problem.reason.includes('Need a name, tag number, or official ID')),
);

const alreadyThere = buildImportPlan({
  rows: [
    { name: '', tag_number: 'T100', official_id: '', sex: 'doe' },
    { name: '', tag_number: 'T4', official_id: '0001', sex: 'doe' },
  ],
  headers: idHeaders,
  mapping: idMapping,
  existingAnimals: [
    { id: 'have-tag', name: null, tag_number: 'T100', official_id: null },
    { id: 'have-official', name: null, tag_number: null, official_id: '0001' },
  ],
  breeds: [],
  referenceIso: '2026-11-26',
});
assert.equal(alreadyThere.toInsert.length, 0);
assert.equal(alreadyThere.skipped.length, 2);
assert.equal(alreadyThere.problems.length, 0);

const blankSex = buildImportPlan({
  rows: [{ name: '', tag_number: '6', official_id: '' }],
  headers: ['name', 'tag_number', 'official_id'],
  mapping: guessColumnMapping(['name', 'tag_number', 'official_id']),
  existingAnimals: [],
  breeds: [],
  referenceIso: '2026-11-26',
  defaultSex: 'female',
});
assert.equal(blankSex.problems.length, 0);
assert.equal(blankSex.toInsert.length, 1);
assert.equal(blankSex.toInsert[0].record.sex, 'female');
assert.equal(blankSex.toInsert[0].record.tag_number, '6');
assert.equal(blankSex.toInsert[0].record.lifecycle_stage, 'breeding');

const distinctZeros = buildImportPlan({
  rows: [
    { name: '', tag_number: '58', official_id: '', sex: 'doe' },
    { name: '', tag_number: '', official_id: '0001', sex: 'doe' },
  ],
  headers: idHeaders,
  mapping: idMapping,
  existingAnimals: [],
  breeds: [],
  referenceIso: '2026-11-26',
});
assert.equal(distinctZeros.problems.length, 0);
assert.equal(distinctZeros.toInsert.length, 2);
assert.equal(distinctZeros.toInsert[1].record.official_id, '0001');

const tempDir = await mkdtemp(join(tmpdir(), 'herd-import-'));
try {
  const csvPath = join(tempDir, 'leading.csv');
  await writeFile(
    csvPath,
    'name,tag_number,official_id\n,,0001\nNanny,,\n',
    'utf8',
  );
  const csvRead = await readSpreadsheet(csvPath);
  assert.equal(csvRead.rows[0].official_id, '0001');
  assert.equal(csvRead.rows[1].name, 'Nanny');

  const xlsxPath = join(tempDir, 'leading.xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = {};
  sheet.A1 = { t: 's', v: 'tag_number' };
  sheet.B1 = { t: 's', v: 'official_id' };
  sheet.C1 = { t: 's', v: 'sex' };
  sheet.A2 = { t: 's', v: '007' };
  sheet.B2 = { t: 'n', v: 42, z: '0000' };
  sheet.C2 = { t: 's', v: 'doe' };
  sheet['!ref'] = 'A1:C2';
  XLSX.utils.book_append_sheet(workbook, sheet, 'Herd');
  XLSX.writeFile(workbook, xlsxPath);
  const xlsxRead = await readSpreadsheet(xlsxPath);
  assert.equal(xlsxRead.rows[0].tag_number, '007');
  assert.equal(xlsxRead.rows[0].official_id, '0042');

  const dupPath = join(tempDir, 'dup.csv');
  await writeFile(dupPath, 'name,tag_number,sex\n,1,doe\n,1,doe\n', 'utf8');
  let inserted = false;
  const admin = {
    from() {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        range() {
          return builder;
        },
        insert() {
          inserted = true;
          return Promise.resolve({ error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  await assert.rejects(
    () =>
      runImportPlan({
        admin,
        farmId: '00000000-0000-4000-8000-000000000001',
        filePath: dupPath,
        apply: true,
        referenceIso: '2026-11-26',
      }),
    /Refusing --apply while problem rows exist/,
  );
  assert.equal(inserted, false);

  const offline = runImport(['Example Farm', csvPath, '--offline', '--sex', 'female']);
  assert.equal(offline.status, 0, offline.stderr);
  assert.match(offline.stdout, /DRY RUN \(no writes\)/);
  assert.match(offline.stdout, /official_id 0001/);
  assert.match(offline.stdout, /To insert: 2/);
  assert.match(offline.stdout, /Problems: 0/);
  assert.match(offline.stdout, /stage=breeding/);
  assert.doesNotMatch(`${offline.stdout}${offline.stderr}`, /supabase/i);

  const refused = runImport(['Farm', csvPath, '--offline', '--apply', '--sex', 'female']);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /--offline cannot be combined with --apply/);

  const badSex = runImport(['Farm', csvPath, '--offline', '--sex', 'goat']);
  assert.equal(badSex.status, 1);
  assert.match(badSex.stderr, /--sex must be female or male/);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log('assert-import-herd: ok');
