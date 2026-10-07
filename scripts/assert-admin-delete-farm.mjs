import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  DELETE_TABLE_ORDER,
  exportDirForFarm,
  FARM_SCOPED_TABLES,
  isFarmNameConfirmed,
  maskEmail,
  parseArgv,
  parseDeleteAuthUsersAnswer,
  slugify,
} from './admin-delete-farm.mjs';

assert.equal(maskEmail('jane@gmail.com'), 'j***@gmail.com');
assert.equal(maskEmail(''), '(unknown)');
assert.equal(maskEmail('not-an-email'), '(unknown)');

assert.equal(slugify('Willow Creek'), 'willow-creek');
assert.equal(exportDirForFarm('Willow Creek', '2026-10-07'), resolve('exports', 'willow-creek-2026-10-07'));

const parsed = parseArgv(['node', 'script', 'Farm A', '--no-export-check']);
assert.equal(parsed.query, 'Farm A');
assert.equal(parsed.noExportCheck, true);
assert.deepEqual(parsed.extras, []);

const parsedId = parseArgv(['node', 'script', '550e8400-e29b-41d4-a716-446655440000']);
assert.equal(parsedId.noExportCheck, false);

assert.equal(isFarmNameConfirmed('Exact Name', 'Exact Name'), true);
assert.equal(isFarmNameConfirmed(' Exact Name ', 'Exact Name'), false);
assert.equal(isFarmNameConfirmed('wrong', 'Exact Name'), false);

assert.equal(parseDeleteAuthUsersAnswer(''), false);
assert.equal(parseDeleteAuthUsersAnswer('n'), false);
assert.equal(parseDeleteAuthUsersAnswer('no'), false);
assert.equal(parseDeleteAuthUsersAnswer('N'), false);
assert.equal(parseDeleteAuthUsersAnswer('y'), true);
assert.equal(parseDeleteAuthUsersAnswer('yes'), true);

assert.ok(DELETE_TABLE_ORDER.includes('breeding_events'));
assert.ok(DELETE_TABLE_ORDER.indexOf('kidding_events') > DELETE_TABLE_ORDER.indexOf('breeding_events'));
assert.ok(DELETE_TABLE_ORDER.indexOf('animals') > DELETE_TABLE_ORDER.indexOf('kidding_events'));
assert.ok(FARM_SCOPED_TABLES.includes('farm_members'));

console.log('assert-admin-delete-farm: ok');
