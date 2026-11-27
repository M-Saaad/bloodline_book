import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { VIEW_ONLY_FARM_MESSAGE } from '../lib/domain/farm-role-access.ts';
import {
  decideFarmWrite,
  FarmWriteForbiddenError,
  LOCAL_FARM_MEMBER_ROLE_SQL,
  readLocalFarmMemberRoleFrom,
} from '../lib/domain/farm-write-access.ts';

const FARM_ID = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
const USER_ID = '11111111-2222-3333-4444-555555555555';

function membershipDb(role) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE farm_members (
    farm_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    equity_share REAL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (farm_id, user_id)
  )`);
  if (role) {
    db.prepare(
      `INSERT INTO farm_members (farm_id, user_id, role, equity_share, created_at)
       VALUES (?, ?, ?, NULL, ?)`,
    ).run(FARM_ID.toUpperCase(), USER_ID.toUpperCase(), role, '2026-01-01T00:00:00Z');
  }
  return {
    async getOptional(sql, parameters = []) {
      assert.equal(sql, LOCAL_FARM_MEMBER_ROLE_SQL);
      const row = db.prepare(sql).get(...parameters);
      return row ?? null;
    },
  };
}

function readLocal(db) {
  return () => readLocalFarmMemberRoleFrom(db, FARM_ID.toLowerCase(), USER_ID.toLowerCase());
}

async function expectAllowed(db, readRemote) {
  await decideFarmWrite({ readLocal: readLocal(db), readRemote });
}

async function expectViewOnly(db, readRemote) {
  await assert.rejects(
    () => decideFarmWrite({ readLocal: readLocal(db), readRemote }),
    (error) => {
      assert.ok(error instanceof FarmWriteForbiddenError);
      assert.equal(error.message, VIEW_ONLY_FARM_MESSAGE);
      return true;
    },
  );
}

let remoteCalls = 0;
const onlineOwner = async () => {
  remoteCalls += 1;
  return 'owner';
};
const offlineRemote = async () => {
  remoteCalls += 1;
  throw new Error('offline');
};

remoteCalls = 0;
await expectAllowed(membershipDb('owner'), offlineRemote);
assert.equal(remoteCalls, 0);

remoteCalls = 0;
await expectAllowed(membershipDb('owner'), onlineOwner);
assert.equal(remoteCalls, 0);

remoteCalls = 0;
await expectAllowed(membershipDb('manager'), onlineOwner);
assert.equal(remoteCalls, 0);

remoteCalls = 0;
await expectAllowed(membershipDb(null), onlineOwner);
assert.equal(remoteCalls, 1);

remoteCalls = 0;
await expectViewOnly(membershipDb('hand'), offlineRemote);
assert.equal(remoteCalls, 0);

remoteCalls = 0;
await expectViewOnly(membershipDb(null), offlineRemote);
assert.equal(remoteCalls, 1);

const rules = readFileSync('powersync/sync-rules.yaml', 'utf8');
const config = readFileSync('powersync/sync-config.yaml', 'utf8');
const memberQuery =
  "SELECT *, farm_id || '/' || user_id AS id FROM farm_members WHERE farm_id IN (";
assert.match(rules, /edition: 3/);
assert.match(config, /edition: 3/);
assert.ok(rules.includes(memberQuery));
assert.ok(config.includes(memberQuery));
assert.equal(rules.includes('SELECT * FROM farm_members WHERE'), false);
assert.equal(config.includes('SELECT * FROM farm_members WHERE'), false);

const schema = readFileSync('lib/powersync/schema.ts', 'utf8');
const membersStart = schema.indexOf('const farmMembers = new Table');
const membersBlock = schema.slice(membersStart, schema.indexOf('const breeds'));
for (const column of ['farm_id', 'user_id', 'role', 'equity_share', 'created_at']) {
  assert.match(membersBlock, new RegExp(`${column}:`));
}
assert.equal(/^\s*id:/m.test(membersBlock), false);

const connector = readFileSync('lib/powersync/connector.ts', 'utf8');
const applyCrud = connector.slice(connector.indexOf('private async applyCrud'));
const skipAt = applyCrud.indexOf('SERVER_MANAGED_UPLOAD_TABLES.has(op.table)');
const uploadAt = applyCrud.indexOf('supabase.from(table)');
assert.ok(skipAt !== -1 && uploadAt !== -1 && skipAt < uploadAt);
assert.match(
  readFileSync('lib/powersync/errors.ts', 'utf8'),
  /SERVER_MANAGED_UPLOAD_TABLES = new Set\(\['farm_members'\]\)/,
);

const guard = readFileSync('lib/db/farm-write-guard.ts', 'utf8');
assert.match(guard, /decideFarmWrite/);
assert.match(guard, /getFarmMemberRoleFromSupabase/);

const farmsSql = readFileSync('lib/db/farms.ts', 'utf8');
assert.match(farmsSql, /lower\(fm\.farm_id\) = lower\(f\.id\)/);
assert.match(farmsSql, /lower\(fm\.user_id\) = lower\(\?\)/);
assert.match(
  readFileSync('hooks/useFarmRole.ts', 'utf8'),
  /LOCAL_FARM_MEMBER_ROLE_SQL/,
);

console.log('assert-farm-write-guard: ok');
