import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ANIMAL_NOT_ON_FARM, idsOnHerd } from '../lib/domain/same-farm.ts';
import {
  applyFastKidding,
  defaultKiddingSeasonStart,
  FAST_KIDDING_TAG_HISTORY_UNAVAILABLE,
  fastKidConfirmationLine,
  KIDDING_SEASON_MARKS_READY_SQL,
  kiddingSeasonMarksReady,
  loadSeasonMarks,
  notKiddedYet,
  notKiddedYetLabel,
  prepareFastKidding,
  resolveKiddingSeasonStart,
  undoFastKidding,
} from '../lib/domain/fast-kidding.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

const HERD_SQL = `
  CREATE TABLE animals (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    name TEXT,
    tag_number TEXT,
    official_id TEXT,
    sex TEXT NOT NULL,
    date_of_birth TEXT,
    status TEXT NOT NULL,
    lifecycle_stage TEXT NOT NULL,
    purpose TEXT,
    breed_primary_id TEXT,
    dam_id TEXT,
    sire_id TEXT,
    sire_external_name TEXT,
    litter_id TEXT,
    color TEXT,
    birth_order INTEGER,
    out_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE kidding_events (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    dam_id TEXT NOT NULL,
    sire_id TEXT,
    sire_external_name TEXT,
    kid_date TEXT NOT NULL,
    kids_born INTEGER NOT NULL,
    kids_surviving INTEGER,
    kidding_ease TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE breeding_events (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    dam_id TEXT NOT NULL,
    sire_id TEXT,
    sire_external_name TEXT,
    status TEXT NOT NULL,
    bred_date TEXT,
    kidding_event_id TEXT,
    updated_at TEXT
  );
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    farm_id TEXT,
    title TEXT,
    due_date TEXT,
    priority TEXT,
    source TEXT,
    source_id TEXT,
    completed INTEGER,
    created_at TEXT,
    updated_at TEXT
  );
  CREATE TABLE weight_logs (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    weigh_session_id TEXT,
    animal_id TEXT NOT NULL,
    weight_value REAL NOT NULL,
    weight_unit TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE tag_history (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    started_on TEXT,
    ended_on TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT
  );
`;

function sqlOf(database) {
  return {
    async execute(query, parameters = []) {
      database.prepare(query).run(...parameters);
    },
    async getOptional(query, parameters = []) {
      return database.prepare(query).get(...parameters) ?? null;
    },
    async getAll(query, parameters = []) {
      return database.prepare(query).all(...parameters);
    },
  };
}

function ids() {
  let n = 0;
  return () => {
    n += 1;
    return `id-${n}`;
  };
}

function seedDoe(database) {
  database.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, breed_primary_id,
      created_at, updated_at
    ) VALUES ('doe-1', 'farm-1', 'Daisy', 'D1', 'female', 'active', 'breeding', 'boer', 't', 't')`,
  ).run();
  database.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, breed_primary_id,
      created_at, updated_at
    ) VALUES ('buck-1', 'farm-1', 'Duke', 'S1', 'male', 'active', 'adult', 'boer', 't', 't')`,
  ).run();
  database.prepare(
    `INSERT INTO breeding_events (
      id, farm_id, dam_id, sire_id, status, bred_date, updated_at
    ) VALUES ('breed-1', 'farm-1', 'doe-1', 'buck-1', 'confirmed', '2026-08-01', 't')`,
  ).run();
  database.prepare(
    `INSERT INTO tasks (
      id, farm_id, title, due_date, priority, source, source_id, completed, created_at, updated_at
    ) VALUES ('task-1', 'farm-1', 'due', '2027-01-01', 'high', 'breeding', 'breed-1', 0, 't', 't')`,
  ).run();
}

const baseKids = [
  {
    sex: 'female',
    outcome: 'alive',
    color: 'red',
    birthWeight: '4.2',
    tagNumber: 'K1',
    birthOrder: '1',
  },
  {
    sex: 'male',
    outcome: 'dead',
    color: '',
    birthWeight: '',
    tagNumber: '',
    birthOrder: '2',
  },
  {
    sex: 'male',
    outcome: 'alive',
    color: 'red',
    birthWeight: '',
    tagNumber: '  ',
    birthOrder: '',
  },
];

const prepared = prepareFastKidding({
  damId: 'doe-1',
  kidDate: '2027-01-18',
  kids: baseKids,
});
assert.equal(prepared.ok, true);
if (!prepared.ok) {
  throw new Error('prepare failed');
}
assert.equal(prepared.kids[2].birthOrder, 3);
assert.equal(prepared.kids[2].tagNumber, null);
assert.equal(prepared.kids[1].color, null);
assert.equal(prepared.kids[0].birthWeight, 4.2);
assert.equal(
  fastKidConfirmationLine(prepared.kids[1]),
  '2. Buck, stillborn',
);

assert.equal(prepareFastKidding({ damId: null, kidDate: '2027-01-18', kids: baseKids }).ok, false);
assert.equal(
  prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [{ ...baseKids[0], sex: null }],
  }).ok,
  false,
);
assert.match(
  prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [{ ...baseKids[0], birthWeight: '0' }],
  }).message ?? '',
  /birth weight/,
);

const savedDb = new DatabaseSync(':memory:');
try {
  savedDb.exec(HERD_SQL);
  seedDoe(savedDb);
  savedDb.exec('BEGIN');
  const result = await applyFastKidding(sqlOf(savedDb), {
    farmId: 'farm-1',
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: prepared.kids,
    breedingEventId: 'breed-1',
    weaningDays: 90,
    weightUnit: 'lb',
    damLabel: 'Daisy',
    createdBy: 'user-1',
    now: '2027-01-18T12:00:00.000Z',
    newId: ids(),
  });
  savedDb.exec('COMMIT');

  const event = savedDb.prepare('SELECT * FROM kidding_events').get();
  assert.equal(event.id, result.kiddingId);
  assert.equal(event.dam_id, 'doe-1');
  assert.equal(event.kid_date, '2027-01-18');
  assert.equal(event.kids_born, 3);
  assert.equal(event.kids_surviving, 2);
  assert.equal(event.sire_id, 'buck-1');

  const kids = savedDb
    .prepare('SELECT * FROM animals WHERE litter_id = ? ORDER BY birth_order')
    .all(result.kiddingId);
  assert.equal(kids.length, 3);
  assert.equal(kids[0].name, null);
  assert.equal(kids[0].tag_number, 'K1');
  assert.equal(kids[0].sex, 'female');
  assert.equal(kids[0].status, 'active');
  assert.equal(kids[0].lifecycle_stage, 'kid');
  assert.equal(kids[0].dam_id, 'doe-1');
  assert.equal(kids[0].color, 'red');
  assert.equal(kids[0].birth_order, 1);
  assert.equal(kids[0].breed_primary_id, 'boer');
  assert.equal(kids[1].name, null);
  assert.equal(kids[1].tag_number, null);
  assert.equal(kids[1].status, 'died');
  assert.equal(kids[1].out_date, '2027-01-18');
  assert.equal(kids[1].birth_order, 2);
  assert.equal(kids[2].tag_number, null);
  assert.equal(kids[2].birth_order, 3);
  assert.equal(kids[2].status, 'active');

  const tags = savedDb.prepare('SELECT * FROM tag_history').all();
  assert.equal(tags.length, 1);
  assert.equal(tags[0].animal_id, kids[0].id);
  assert.equal(tags[0].kind, 'farm_tag');
  assert.equal(tags[0].value, 'K1');
  assert.equal(tags[0].ended_on, null);
  assert.equal(tags[0].started_on, '2027-01-18');

  const weights = savedDb.prepare('SELECT * FROM weight_logs').all();
  assert.equal(weights.length, 1);
  assert.equal(weights[0].animal_id, kids[0].id);
  assert.equal(weights[0].weigh_session_id, null);
  assert.equal(weights[0].weight_value, 4.2);
  assert.equal(weights[0].weight_unit, 'lb');
  assert.equal(
    savedDb.prepare(
      "SELECT name FROM sqlite_master WHERE name = 'weigh_sessions'",
    ).get(),
    undefined,
  );

  const breeding = savedDb.prepare('SELECT * FROM breeding_events').get();
  assert.equal(breeding.status, 'kidded');
  assert.equal(breeding.kidding_event_id, result.kiddingId);
  assert.equal(
    savedDb.prepare('SELECT completed FROM tasks WHERE id = ?').get('task-1').completed,
    1,
  );
  const wean = savedDb.prepare("SELECT * FROM tasks WHERE source = 'weaning'").get();
  assert.equal(wean.source_id, result.kiddingId);
  assert.match(wean.title, /Daisy/);

  savedDb.exec('BEGIN');
  await undoFastKidding(sqlOf(savedDb), {
    kiddingId: result.kiddingId,
    now: '2027-01-18T12:05:00.000Z',
  });
  savedDb.exec('COMMIT');
  assert.equal(savedDb.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
  assert.equal(savedDb.prepare('SELECT COUNT(*) AS c FROM animals WHERE litter_id IS NOT NULL').get().c, 0);
  assert.equal(savedDb.prepare('SELECT COUNT(*) AS c FROM tag_history').get().c, 0);
  assert.equal(savedDb.prepare('SELECT COUNT(*) AS c FROM weight_logs').get().c, 0);
  assert.equal(savedDb.prepare('SELECT status FROM breeding_events').get().status, 'bred');
} finally {
  savedDb.close();
}

const rollbackDb = new DatabaseSync(':memory:');
try {
  rollbackDb.exec(HERD_SQL);
  seedDoe(rollbackDb);
  rollbackDb.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, created_at, updated_at
    ) VALUES ('other', 'farm-1', 'Clover', 'K1', 'female', 'active', 'adult', 't', 't')`,
  ).run();
  const duplicate = prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [baseKids[0]],
  });
  assert.equal(duplicate.ok, true);
  rollbackDb.exec('BEGIN');
  let thrown = false;
  try {
    await applyFastKidding(sqlOf(rollbackDb), {
      farmId: 'farm-1',
      damId: 'doe-1',
      kidDate: '2027-01-18',
      kids: duplicate.ok ? duplicate.kids : [],
      weaningDays: null,
      weightUnit: 'kg',
      damLabel: 'Daisy',
      createdBy: null,
      now: '2027-01-18T12:00:00.000Z',
      newId: ids(),
    });
    rollbackDb.exec('COMMIT');
  } catch (error) {
    thrown = true;
    rollbackDb.exec('ROLLBACK');
    assert.match(error.message, /already on Clover/);
  }
  assert.equal(thrown, true);
  assert.equal(rollbackDb.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
  assert.equal(
    rollbackDb.prepare("SELECT COUNT(*) AS c FROM animals WHERE dam_id = 'doe-1'").get().c,
    0,
  );
  assert.equal(rollbackDb.prepare('SELECT COUNT(*) AS c FROM tag_history').get().c, 0);
  assert.equal(rollbackDb.prepare('SELECT COUNT(*) AS c FROM weight_logs').get().c, 0);
} finally {
  rollbackDb.close();
}

const weightFailDb = new DatabaseSync(':memory:');
try {
  weightFailDb.exec(HERD_SQL);
  seedDoe(weightFailDb);
  const base = sqlOf(weightFailDb);
  const failing = {
    ...base,
    async execute(query, parameters = []) {
      if (query.includes('INSERT INTO weight_logs')) {
        throw new Error('weight write failed');
      }
      return base.execute(query, parameters);
    },
  };
  const one = prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [baseKids[0]],
  });
  weightFailDb.exec('BEGIN');
  let thrown = false;
  try {
    await applyFastKidding(failing, {
      farmId: 'farm-1',
      damId: 'doe-1',
      kidDate: '2027-01-18',
      kids: one.ok ? one.kids : [],
      weaningDays: null,
      weightUnit: 'lb',
      damLabel: 'Daisy',
      createdBy: null,
      now: '2027-01-18T12:00:00.000Z',
      newId: ids(),
    });
    weightFailDb.exec('COMMIT');
  } catch (error) {
    thrown = true;
    weightFailDb.exec('ROLLBACK');
    assert.match(error.message, /weight write failed/);
  }
  assert.equal(thrown, true);
  assert.equal(weightFailDb.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
  assert.equal(weightFailDb.prepare('SELECT COUNT(*) AS c FROM weight_logs').get().c, 0);
  assert.equal(
    weightFailDb.prepare("SELECT COUNT(*) AS c FROM animals WHERE lifecycle_stage = 'kid'").get().c,
    0,
  );
} finally {
  weightFailDb.close();
}

const order = prepareFastKidding({
  damId: 'doe-1',
  kidDate: '2027-01-18',
  kids: [
    { ...baseKids[0], birthOrder: '3', tagNumber: '' },
    { ...baseKids[1], birthOrder: '1', sex: 'female', outcome: 'alive' },
  ],
});
assert.equal(order.ok, true);
assert.deepEqual(
  order.ok ? order.kids.map((kid) => kid.birthOrder) : [],
  [3, 1],
);

assert.equal(defaultKiddingSeasonStart('2026-11-26'), '2025-12-01');
assert.equal(defaultKiddingSeasonStart('2026-12-01'), '2026-12-01');
assert.equal(defaultKiddingSeasonStart('2027-01-15'), '2026-12-01');
assert.equal(resolveKiddingSeasonStart(null, '2027-01-15'), '2026-12-01');
assert.equal(resolveKiddingSeasonStart('2026-12-15', '2026-11-26'), '2026-12-15');

const seasonDoes = [
  { id: 'a', sex: 'female', status: 'active', lifecycleStage: 'breeding' },
  { id: 'b', sex: 'female', status: 'active', lifecycleStage: 'adult' },
  { id: 'c', sex: 'female', status: 'active', lifecycleStage: 'adult' },
  { id: 'kid', sex: 'female', status: 'active', lifecycleStage: 'kid' },
  { id: 'buck', sex: 'male', status: 'active', lifecycleStage: 'adult' },
  { id: 'sold', sex: 'female', status: 'sold', lifecycleStage: 'adult' },
  { id: 'yearling', sex: 'female', status: 'active', lifecycleStage: 'yearling' },
];
const seasonStart = '2026-12-01';
let remaining = notKiddedYet(
  seasonDoes,
  [
    { damId: 'a', kidDate: '2026-11-30' },
    { damId: 'b', kidDate: '2027-01-20' },
  ],
  [{ animalId: 'c', seasonStart }],
  seasonStart,
);
assert.deepEqual(remaining.map((doe) => doe.id), ['a']);
assert.equal(notKiddedYetLabel(remaining.length), '1 doe not kidded yet');

remaining = notKiddedYet(
  seasonDoes,
  [
    { damId: 'a', kidDate: '2026-11-30' },
    { damId: 'b', kidDate: '2027-01-20' },
    { damId: 'a', kidDate: '2027-02-02' },
  ],
  [{ animalId: 'c', seasonStart }],
  seasonStart,
);
assert.deepEqual(remaining, []);
assert.equal(notKiddedYetLabel(0), '0 does not kidded yet');
assert.equal(notKiddedYetLabel(23), '23 does not kidded yet');

const OLD_TABLE_ONLY_SQL =
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'kidding_season_marks'";

const viewDb = new DatabaseSync(':memory:');
try {
  viewDb.exec(`
    CREATE TABLE ps_data__kidding_season_marks (
      id TEXT PRIMARY KEY,
      farm_id TEXT,
      animal_id TEXT,
      season_start TEXT,
      kind TEXT,
      created_at TEXT,
      created_by TEXT
    );
    INSERT INTO ps_data__kidding_season_marks (
      id, farm_id, animal_id, season_start, kind, created_at, created_by
    ) VALUES (
      'mark-1', 'farm-1', 'a', '2026-12-01', 'open', '2026-12-02T00:00:00Z', NULL
    );
    CREATE VIEW kidding_season_marks AS SELECT * FROM ps_data__kidding_season_marks;
  `);
  const reader = sqlOf(viewDb);
  assert.equal(await reader.getOptional(OLD_TABLE_ONLY_SQL), null);
  assert.equal(await kiddingSeasonMarksReady(reader), true);
  const marks = await loadSeasonMarks(reader, 'farm-1', '2026-12-01');
  assert.deepEqual(marks, [{ animalId: 'a', seasonStart: '2026-12-01' }]);
  assert.deepEqual(
    notKiddedYet(seasonDoes, [], marks, '2026-12-01').map((doe) => doe.id),
    ['b', 'c'],
  );
} finally {
  viewDb.close();
}

const missingMarks = new DatabaseSync(':memory:');
try {
  assert.equal(await kiddingSeasonMarksReady(sqlOf(missingMarks)), false);
  assert.deepEqual(await loadSeasonMarks(sqlOf(missingMarks), 'farm-1', '2026-12-01'), []);
  assert.equal(
    notKiddedYet(seasonDoes, [], [], '2026-12-01').length,
    3,
  );
} finally {
  missingMarks.close();
}

const viewTags = new DatabaseSync(':memory:');
try {
  viewTags.exec(HERD_SQL.replace(
    `CREATE TABLE tag_history (
    id TEXT PRIMARY KEY,
    farm_id TEXT NOT NULL,
    animal_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    value TEXT NOT NULL,
    started_on TEXT,
    ended_on TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT
  );`,
    `CREATE TABLE ps_data__tag_history (
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
    CREATE VIEW tag_history AS SELECT * FROM ps_data__tag_history;
    CREATE TRIGGER tag_history_insert INSTEAD OF INSERT ON tag_history
    BEGIN
      INSERT INTO ps_data__tag_history (
        id, farm_id, animal_id, kind, value, started_on, ended_on, note, created_at, created_by
      ) VALUES (
        NEW.id, NEW.farm_id, NEW.animal_id, NEW.kind, NEW.value,
        NEW.started_on, NEW.ended_on, NEW.note, NEW.created_at, NEW.created_by
      );
    END;`,
  ));
  seedDoe(viewTags);
  const tagged = prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [{ ...baseKids[0], birthWeight: '' }],
  });
  assert.equal(
    await viewTags.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tag_history'",
    ).get(),
    undefined,
  );
  viewTags.exec('BEGIN');
  await applyFastKidding(sqlOf(viewTags), {
    farmId: 'farm-1',
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: tagged.ok ? tagged.kids : [],
    weaningDays: null,
    weightUnit: 'lb',
    damLabel: 'Daisy',
    createdBy: null,
    now: '2027-01-18T12:00:00.000Z',
    newId: ids(),
  });
  viewTags.exec('COMMIT');
  const tag = viewTags.prepare('SELECT value FROM tag_history').get();
  assert.equal(tag.value, 'K1');
  assert.equal(
    viewTags.prepare('SELECT value FROM ps_data__tag_history').get().value,
    'K1',
  );
} finally {
  viewTags.close();
}

const noHistory = new DatabaseSync(':memory:');
try {
  noHistory.exec(HERD_SQL.replace(/CREATE TABLE tag_history \([\s\S]*?\);/, ''));
  seedDoe(noHistory);
  const tagged = prepareFastKidding({
    damId: 'doe-1',
    kidDate: '2027-01-18',
    kids: [baseKids[0]],
  });
  noHistory.exec('BEGIN');
  let thrown = false;
  try {
    await applyFastKidding(sqlOf(noHistory), {
      farmId: 'farm-1',
      damId: 'doe-1',
      kidDate: '2027-01-18',
      kids: tagged.ok ? tagged.kids : [],
      weaningDays: null,
      weightUnit: 'lb',
      damLabel: 'Daisy',
      createdBy: null,
      now: '2027-01-18T12:00:00.000Z',
      newId: ids(),
    });
    noHistory.exec('COMMIT');
  } catch (error) {
    thrown = true;
    noHistory.exec('ROLLBACK');
    assert.equal(error.message, FAST_KIDDING_TAG_HISTORY_UNAVAILABLE);
  }
  assert.equal(thrown, true);
  assert.equal(noHistory.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
} finally {
  noHistory.close();
}

const switched = new DatabaseSync(':memory:');
try {
  switched.exec(HERD_SQL);
  switched.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, created_at, updated_at
    ) VALUES ('doe-prev', 'farm-prev', 'Salt', '104', 'female', 'active', 'adult', 't', 't')`,
  ).run();
  switched.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, created_at, updated_at
    ) VALUES ('doe-here', 'farm-now', 'Clover', '2', 'female', 'active', 'adult', 't', 't')`,
  ).run();
  const beforeAnimals = switched.prepare('SELECT COUNT(*) AS c FROM animals').get().c;
  const cross = prepareFastKidding({
    damId: 'doe-prev',
    kidDate: '2027-01-18',
    kids: [{ ...baseKids[0], tagNumber: '', birthWeight: '' }],
  });
  assert.equal(cross.ok, true);
  let thrown = false;
  try {
    await applyFastKidding(sqlOf(switched), {
      farmId: 'farm-now',
      damId: 'doe-prev',
      kidDate: '2027-01-18',
      kids: cross.ok ? cross.kids : [],
      breedingEventId: null,
      weaningDays: 90,
      weightUnit: 'lb',
      damLabel: 'Salt',
      createdBy: null,
      now: '2027-01-18T12:00:00.000Z',
      newId: ids(),
    });
  } catch (error) {
    thrown = true;
    assert.equal(error.message, ANIMAL_NOT_ON_FARM);
  }
  assert.equal(thrown, true);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM animals').get().c, beforeAnimals);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM weight_logs').get().c, 0);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM tasks').get().c, 0);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM tag_history').get().c, 0);

  switched.prepare(
    `INSERT INTO animals (
      id, farm_id, name, tag_number, sex, status, lifecycle_stage, created_at, updated_at
    ) VALUES ('buck-prev', 'farm-prev', 'Duke', '9', 'male', 'active', 'adult', 't', 't')`,
  ).run();
  switched.prepare(
    `INSERT INTO breeding_events (
      id, farm_id, dam_id, sire_id, status, bred_date, updated_at
    ) VALUES ('breed-cross', 'farm-now', 'doe-here', 'buck-prev', 'bred', '2026-08-01', 't')`,
  ).run();
  const sireKids = prepareFastKidding({
    damId: 'doe-here',
    kidDate: '2027-01-18',
    kids: [{ ...baseKids[0], tagNumber: '', birthWeight: '' }],
  });
  thrown = false;
  try {
    await applyFastKidding(sqlOf(switched), {
      farmId: 'farm-now',
      damId: 'doe-here',
      kidDate: '2027-01-18',
      kids: sireKids.ok ? sireKids.kids : [],
      breedingEventId: 'breed-cross',
      weaningDays: null,
      weightUnit: 'lb',
      damLabel: 'Clover',
      createdBy: null,
      now: '2027-01-18T12:00:00.000Z',
      newId: ids(),
    });
  } catch (error) {
    thrown = true;
    assert.equal(error.message, ANIMAL_NOT_ON_FARM);
  }
  assert.equal(thrown, true);
  assert.equal(switched.prepare('SELECT COUNT(*) AS c FROM kidding_events').get().c, 0);
  assert.equal(
    switched.prepare("SELECT status FROM breeding_events WHERE id = 'breed-cross'").get().status,
    'bred',
  );
} finally {
  switched.close();
}

assert.deepEqual(
  idsOnHerd(['doe-prev', 'doe-here', null], [{ id: 'doe-here' }]),
  ['doe-here'],
);

const migration = read('supabase/migrations/0019_fast_kidding.sql');
assert.match(migration, /alter column weigh_session_id drop not null/i);
assert.match(migration, /add column if not exists kidding_season_start/i);
assert.match(migration, /create table if not exists kidding_season_marks/i);
assert.match(migration, /kidding_season_marks_animal_season/);
assert.doesNotMatch(migration, /\bdrop\s+table\b/i);
assert.doesNotMatch(migration, /drop column/i);
assert.doesNotMatch(migration, /\brename\b/i);
assert.match(KIDDING_SEASON_MARKS_READY_SQL, /type IN \('table', 'view'\)/);

const rules = read('powersync/sync-rules.yaml');
assert.match(rules, /SELECT \* FROM kidding_season_marks/);
assert.match(read('powersync/sync-config.yaml'), /SELECT \* FROM kidding_season_marks/);
assert.match(read('lib/powersync/schema.ts'), /kidding_season_marks: kiddingSeasonMarks/);
assert.match(read('lib/powersync/schema.ts'), /kidding_season_start: column.text/);
assert.match(read('lib/db/fast-kidding.ts'), /writeTransaction/);
assert.match(read('app/(tabs)/more/breeding/add-kidding.tsx'), /dam\.id/);
assert.match(
  read('app/(tabs)/more/breeding/add-kidding.tsx'),
  /farm_id = \? AND status = 'active'/,
);
assert.match(
  read('app/(tabs)/livestock/[id].tsx'),
  /SELECT \* FROM animals WHERE id = \? AND farm_id = \?/,
);
const sameFarmMigration = read('supabase/migrations/0020_same_farm_parents.sql');
assert.match(sameFarmMigration, /kidding_events_same_farm_parents/);
assert.match(sameFarmMigration, /animals_same_farm_parents/);
assert.match(sameFarmMigration, /assert_referenced_animal_same_farm/);
assert.doesNotMatch(sameFarmMigration, /\bdrop\s+table\b/i);
assert.doesNotMatch(sameFarmMigration, /drop column/i);
assert.match(read('app/(tabs)/livestock/[id].tsx'), /LEFT JOIN weigh_sessions/);
assert.match(
  read('app/(tabs)/more/breeding/kidding/[id].tsx'),
  /COALESCE\(ws\.weigh_point, 'birth'\)/,
);
assert.doesNotMatch(
  read('app/(tabs)/more/breeding/add-kidding.tsx'),
  /from 'react-native'[^;]*\bText\b/,
);

console.log('assert-fast-kidding: ok');
