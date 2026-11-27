import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  uploadFailurePlainReason,
  uploadFailureSummary,
} from '../lib/domain/upload-failures.ts';
import {
  formatUploadError,
  isCheckViolationError,
  isFatalUploadError,
} from '../lib/powersync/errors.ts';
import { applyUploadBatch } from '../lib/powersync/upload-batch.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const postgrest = {
  code: '42501',
  message: 'new row violates row-level security policy for table "farms"',
};

assert.equal(
  formatUploadError(postgrest),
  'new row violates row-level security policy for table "farms" — (code 42501)',
);
assert.notEqual(formatUploadError(postgrest), '[object Object]');

const sameFarm = {
  code: '23514',
  message: 'Kidding dam must be a goat on the same farm',
};

assert.equal(isCheckViolationError(sameFarm), true);
assert.equal(
  isFatalUploadError(sameFarm),
  true,
  '23514 must not be retried forever',
);
assert.equal(isCheckViolationError({ message: 'check_violation 23514' }), true);
assert.equal(isCheckViolationError({ code: '23505' }), false);
assert.equal(isFatalUploadError({ code: '08006', message: 'connection failure' }), false);

assert.equal(
  uploadFailurePlainReason('23514', sameFarm.message),
  'The dam or sire is a goat on another farm.',
);
assert.equal(
  uploadFailureSummary({
    tableName: 'kidding_events',
    errorCode: '23514',
    errorMessage: sameFarm.message,
  }),
  'Kidding: The dam or sire is a goat on another farm.',
);

const sent = [];
const skipped = [];
await applyUploadBatch({
  ops: [
    { id: 'kidding-ok', table: 'kidding_events' },
    { id: 'kidding-cross-farm', table: 'kidding_events' },
    { id: 'kid-after', table: 'animals' },
  ],
  apply: async (op) => {
    if (op.id === 'kidding-cross-farm') {
      throw sameFarm;
    }
    sent.push(op.id);
  },
  isPermanentSkip: isCheckViolationError,
  onPermanentSkip: async (op, error) => {
    skipped.push({ id: op.id, code: error.code, message: error.message });
  },
});
assert.deepEqual(sent, ['kidding-ok', 'kid-after']);
assert.deepEqual(skipped, [
  {
    id: 'kidding-cross-farm',
    code: '23514',
    message: sameFarm.message,
  },
]);

const queuedAfter = [];
await applyUploadBatch({
  ops: [{ id: 'next-transaction', table: 'weight_logs' }],
  apply: async (op) => {
    queuedAfter.push(op.id);
  },
  isPermanentSkip: isCheckViolationError,
  onPermanentSkip: async () => {
    throw new Error('should not skip');
  },
});
assert.deepEqual(queuedAfter, ['next-transaction']);

let stopped = false;
try {
  await applyUploadBatch({
    ops: [
      { id: 'before' },
      { id: 'offline' },
      { id: 'after' },
    ],
    apply: async (op) => {
      if (op.id === 'offline') {
        throw { code: '08006', message: 'connection failure' };
      }
      sent.push(op.id);
    },
    isPermanentSkip: isCheckViolationError,
    onPermanentSkip: async () => {
      throw new Error('a connection failure is not a permanent skip');
    },
  });
} catch (error) {
  stopped = true;
  assert.equal(error.opIndex, 1);
  assert.equal(error.original.code, '08006');
  assert.equal(isFatalUploadError(error.original), false);
}
assert.equal(stopped, true);

const connector = readFileSync(join(root, 'lib/powersync/connector.ts'), 'utf8');
assert.match(connector, /isPermanentSkip: isCheckViolationError/);
assert.match(connector, /transaction\.complete\(\)/);
assert.match(connector, /isFatalUploadError\(cause\)/);

console.log('assert-upload-errors: ok');
