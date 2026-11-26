import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatBirthOrder,
  parseBirthOrder,
  validateAnimalNameOrTag,
} from '../lib/domain/animals.ts';
import {
  backfillTagHistory,
  currentTagDuplicateMessage,
  pastTagSearchHint,
  planTagChange,
  sortTagHistory,
  TAG_HISTORY_READY_SQL,
  tagHistoryTableReady,
} from '../lib/domain/tag-history.ts';
import {
  isDuplicateKeyError,
  isFatalUploadError,
} from '../lib/powersync/errors.ts';
import { buildPickerRows } from '../lib/ui/animal-picker.ts';
import {
  animalDisplayLabel,
  UNNAMED_ANIMAL_LABEL,
} from '../lib/ui/animal-labels.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sql = readFileSync(join(root, 'supabase/migrations/0018_tag_history.sql'), 'utf8');
const connector = readFileSync(join(root, 'lib/powersync/connector.ts'), 'utf8');
assert.equal((sql.match(/insert into tag_history/gi) ?? []).length, 3);
assert.equal((sql.match(/ended_on is null/gi) ?? []).length >= 3, true);
assert.match(sql, /not exists/i);
assert.doesNotMatch(sql, /\bdrop\b/i);
assert.doesNotMatch(sql, /\brename\b/i);
assert.doesNotMatch(sql, /raise exception/i);
assert.match(sql, /tag_history_one_current_per_kind/);
for (const removed of [
  'animals_current_farm_tag_unique',
  'animals_current_official_id_unique',
  'animals_current_tattoo_unique',
  'tag_history_current_value_per_farm',
]) {
  assert.equal(sql.includes(removed), false, removed);
}
assert.match(sql, /animals add column if not exists color/i);
assert.match(sql, /animals add column if not exists birth_order/i);

const goat = {
  id: 'goat-1',
  farmId: 'farm-1',
  tagNumber: '24B',
  officialId: 'USDA-1',
  tattoo: 'L1',
};
const blank = {
  id: 'goat-2',
  farmId: 'farm-1',
  tagNumber: '   ',
  officialId: null,
  tattoo: '',
};

const first = backfillTagHistory([goat, blank], []);
assert.deepEqual(
  first.map((row) => row.kind),
  ['farm_tag', 'official_id', 'tattoo'],
);
assert.equal(first[0].value, '24B');
const second = backfillTagHistory(
  [goat, blank],
  first.map((row) => ({ animalId: row.animalId, kind: row.kind })),
);
assert.deepEqual(second, []);
const partial = backfillTagHistory([goat], [{ animalId: 'goat-1', kind: 'farm_tag' }]);
assert.deepEqual(
  partial.map((row) => row.kind),
  ['official_id', 'tattoo'],
);

const holders = [{ animalId: 'other', value: '24A', label: 'Clover' }];

const replaced = planTagChange({
  action: 'replace',
  kind: 'farm_tag',
  currentValue: '24A',
  nextValue: '24B',
  note: ' lost ',
  today: '2026-11-26',
  openHistoryId: 'open-1',
  holders,
  animalId: 'goat-1',
});
assert.equal(replaced.ok, true);
if (replaced.ok) {
  assert.equal(replaced.closeOpenId, 'open-1');
  assert.equal(replaced.insertOpen?.value, '24B');
  assert.equal(replaced.insertOpen?.note, 'lost');
  assert.equal(replaced.insertOpen?.startedOn, '2026-11-26');
  assert.equal(replaced.nextValue, '24B');
}

const replacedWithoutHistory = planTagChange({
  action: 'replace',
  kind: 'farm_tag',
  currentValue: '24A',
  nextValue: '24B',
  note: null,
  today: '2026-11-26',
  openHistoryId: null,
  holders: [],
  animalId: 'goat-1',
});
assert.equal(replacedWithoutHistory.ok, false);
if (!replacedWithoutHistory.ok) {
  assert.match(replacedWithoutHistory.message, /not on this phone yet/);
}

const added = planTagChange({
  action: 'add',
  kind: 'farm_tag',
  currentValue: null,
  nextValue: ' 9 ',
  note: null,
  today: '2026-11-26',
  openHistoryId: null,
  holders,
  animalId: 'goat-2',
});
assert.equal(added.ok, true);
if (added.ok) {
  assert.equal(added.closeOpenId, null);
  assert.equal(added.insertOpen?.value, '9');
}

const cleared = planTagChange({
  action: 'clear',
  kind: 'official_id',
  currentValue: 'USDA-1',
  nextValue: 'ignored',
  note: 'fell off',
  today: '2026-11-26',
  openHistoryId: 'open-2',
  holders: [],
  animalId: 'goat-1',
});
assert.equal(cleared.ok, true);
if (cleared.ok) {
  assert.equal(cleared.nextValue, null);
  assert.equal(cleared.insertOpen, null);
  assert.equal(cleared.closeOpenId, 'open-2');
  assert.equal(cleared.closeNote, 'fell off');
}

assert.equal(
  planTagChange({
    action: 'replace',
    kind: 'farm_tag',
    currentValue: null,
    nextValue: '1',
    note: null,
    today: '2026-11-26',
    openHistoryId: null,
    holders: [],
    animalId: 'goat-2',
  }).ok,
  false,
);
assert.equal(
  planTagChange({
    action: 'add',
    kind: 'farm_tag',
    currentValue: '1',
    nextValue: '2',
    note: null,
    today: '2026-11-26',
    openHistoryId: 'x',
    holders: [],
    animalId: 'goat-1',
  }).ok,
  false,
);
assert.equal(
  planTagChange({
    action: 'clear',
    kind: 'tattoo',
    currentValue: ' ',
    nextValue: null,
    note: null,
    today: '2026-11-26',
    openHistoryId: null,
    holders: [],
    animalId: 'goat-2',
  }).ok,
  false,
);

const duplicate = planTagChange({
  action: 'replace',
  kind: 'farm_tag',
  currentValue: '24B',
  nextValue: '24a',
  note: null,
  today: '2026-11-26',
  openHistoryId: 'open-1',
  holders,
  animalId: 'goat-1',
});
assert.equal(duplicate.ok, false);
if (!duplicate.ok) {
  assert.equal(duplicate.message, currentTagDuplicateMessage('farm_tag', '24a', 'Clover'));
  assert.match(duplicate.message, /Clover/);
  assert.match(duplicate.message, /cannot share/);
}

const pastRepeat = planTagChange({
  action: 'add',
  kind: 'farm_tag',
  currentValue: null,
  nextValue: '24A',
  note: null,
  today: '2026-11-26',
  openHistoryId: null,
  holders: [],
  animalId: 'goat-2',
});
assert.equal(pastRepeat.ok, true);

const spelling = planTagChange({
  action: 'replace',
  kind: 'farm_tag',
  currentValue: '24a',
  nextValue: '24A',
  note: null,
  today: '2026-11-26',
  openHistoryId: 'open-1',
  holders: [],
  animalId: 'goat-1',
});
assert.equal(spelling.ok, true);
if (spelling.ok) {
  assert.equal(spelling.reviseValue, '24A');
  assert.equal(spelling.closeOpenId, null);
}

const sorted = sortTagHistory([
  {
    id: 'past',
    endedOn: '2026-01-01',
    startedOn: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'current',
    endedOn: null,
    startedOn: '2026-02-01',
    createdAt: '2026-02-01T00:00:00Z',
  },
]);
assert.deepEqual(
  sorted.map((row) => row.id),
  ['current', 'past'],
);

const searched = {
  name: 'Nanny',
  tagNumber: '24B',
  officialId: null,
  registrationNumber: null,
  tattoo: null,
};
assert.equal(pastTagSearchHint(searched, '24A', ['24A', '99']), 'was 24A');
assert.equal(pastTagSearchHint(searched, '24B', ['24A']), null);
assert.equal(animalDisplayLabel(searched), 'Nanny');
assert.equal(animalDisplayLabel({ name: null, tagNumber: null, officialId: null }), UNNAMED_ANIMAL_LABEL);
assert.equal(validateAnimalNameOrTag('', ''), null);

function pickerGoat(partial) {
  return {
    id: partial.id,
    farmId: 'farm-1',
    name: partial.name ?? null,
    tagNumber: partial.tagNumber ?? null,
    officialId: null,
    photoStoragePath: null,
    breedPrimaryId: null,
    breedPercentage: null,
    sex: 'female',
    dateOfBirth: null,
    status: 'active',
    lifecycleStage: 'adult',
    purpose: null,
    damId: null,
    damExternalName: null,
    sireId: null,
    sireExternalName: null,
    litterId: null,
    registrationBody: null,
    registrationNumber: null,
    tattoo: null,
    color: null,
    birthOrder: null,
    purchasePrice: null,
    soldPrice: null,
    purchasedFromId: null,
    outDate: null,
    notes: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const rows = buildPickerRows({
  animals: [
    pickerGoat({ id: 'a', name: 'Nanny', tagNumber: '24B' }),
    pickerGoat({ id: 'b', name: 'Clover', tagNumber: '2' }),
  ],
  outsideAnimals: [],
  query: '24A',
  recentIds: [],
  suggestedIds: [],
  chip: null,
  exclude: [],
  disabled: [],
  includeOutside: false,
  pastTagsByAnimalId: { a: ['24A'] },
});
assert.equal(
  rows.some((row) => row.kind === 'animal' && row.animal.id === 'a'),
  true,
);
assert.equal(
  rows.some((row) => row.kind === 'animal' && row.animal.id === 'b'),
  false,
);

assert.equal(parseBirthOrder('').value, null);
assert.equal(parseBirthOrder('1').value, 1);
assert.equal(parseBirthOrder('0').error?.includes('starts at 1'), true);
assert.equal(formatBirthOrder(1), '1 · first born');
assert.equal(formatBirthOrder(2), '2');
assert.equal(formatBirthOrder(null), null);

const uniqueViolation = {
  code: '23505',
  message:
    'duplicate key value violates unique constraint "tag_history_one_current_per_kind"',
};
assert.equal(isDuplicateKeyError(uniqueViolation), true);
assert.equal(
  isFatalUploadError(uniqueViolation),
  true,
  'a unique violation must not be retried forever',
);
assert.equal(
  isDuplicateKeyError({
    message: 'duplicate key value violates unique constraint "tag_history_one_current_per_kind"',
  }),
  true,
);
const uploadOps = connector.slice(
  connector.indexOf('case UpdateType.PUT'),
  connector.indexOf('case UpdateType.DELETE'),
);
assert.equal(
  (uploadOps.match(/isDuplicateKeyError/g) ?? []).length,
  2,
  'insert and update both skip a unique violation instead of retrying it',
);

const dbSource = readFileSync(join(root, 'lib/db/tag-history.ts'), 'utf8');
assert.match(dbSource, /tagHistoryTableReady/);
assert.doesNotMatch(dbSource, /type = 'table' AND name = 'tag_history'/);
assert.doesNotMatch(dbSource, /sqlite_master/);

const OLD_TABLE_ONLY_SQL =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tag_history'";

function sqliteReader(database) {
  return {
    async getOptional(sql, parameters = []) {
      const row = database.prepare(sql).get(...parameters);
      return row ?? null;
    },
  };
}

const powersyncShape = new DatabaseSync(':memory:');
try {
  powersyncShape.exec(`
    CREATE TABLE ps_data__tag_history (
      id TEXT PRIMARY KEY,
      farm_id TEXT,
      animal_id TEXT,
      kind TEXT,
      value TEXT,
      started_on TEXT,
      ended_on TEXT,
      note TEXT,
      created_at TEXT,
      created_by TEXT
    );
    INSERT INTO ps_data__tag_history (
      id, farm_id, animal_id, kind, value, started_on, ended_on, note, created_at, created_by
    ) VALUES (
      'hist-1', 'farm-alyumn', '7de727df-76ec-4cf5-afee-366738e8b9ed',
      'farm_tag', 'A-001', NULL, NULL, NULL, '2026-01-01T00:00:00Z', NULL
    );
    CREATE VIEW tag_history AS SELECT * FROM ps_data__tag_history;
  `);
  const reader = sqliteReader(powersyncShape);
  const oldHit = await reader.getOptional(OLD_TABLE_ONLY_SQL);
  assert.equal(oldHit, null, 'the old table-only check must miss a PowerSync view');
  assert.equal(await tagHistoryTableReady(reader), true);
  const openRow = await reader.getOptional(
    `SELECT id, value, started_on FROM tag_history
     WHERE animal_id = ? AND kind = ? AND ended_on IS NULL
     LIMIT 1`,
    ['7de727df-76ec-4cf5-afee-366738e8b9ed', 'farm_tag'],
  );
  assert.equal(openRow.id, 'hist-1');
  assert.equal(openRow.value, 'A-001');
  assert.equal(openRow.started_on, null);
} finally {
  powersyncShape.close();
}

const plainTable = new DatabaseSync(':memory:');
try {
  plainTable.exec(`
    CREATE TABLE tag_history (
      id TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  assert.equal(await tagHistoryTableReady(sqliteReader(plainTable)), true);
} finally {
  plainTable.close();
}

const missing = new DatabaseSync(':memory:');
try {
  assert.equal(await tagHistoryTableReady(sqliteReader(missing)), false);
} finally {
  missing.close();
}

assert.match(TAG_HISTORY_READY_SQL, /type IN \('table', 'view'\)/);

console.log('assert-tag-history: ok');
