import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  preferLocalRows,
  shouldRouteToCreateFarm,
  shouldShowReplicaLoading,
} from '../lib/domain/offline-replica.ts';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: false,
    localRowCount: 3,
    localQueryLoading: true,
  }),
  false,
  'local rows show even when sync has not finished',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: undefined,
    localRowCount: 1,
    localQueryLoading: true,
    emptyBootstrapPending: true,
  }),
  false,
  'local rows show before sync status is known',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: true,
    localRowCount: 0,
    localQueryLoading: true,
    emptyBootstrapPending: true,
  }),
  false,
  'a device that has synced before does not stay on a loading screen',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: false,
    localRowCount: 0,
    localQueryLoading: true,
  }),
  true,
  'a brand-new install stays on the loading screen while the local read is outstanding',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: undefined,
    localRowCount: 0,
    localQueryLoading: true,
  }),
  true,
  'unknown sync state with no local rows stays on the loading screen',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: false,
    localRowCount: 0,
    localQueryLoading: false,
    emptyBootstrapPending: true,
  }),
  true,
  'a brand-new install waits for the empty-server bootstrap',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: false,
    localRowCount: 0,
    localQueryLoading: false,
    emptyBootstrapPending: false,
  }),
  false,
  'a brand-new install with an empty local database can leave the loading screen',
);

assert.equal(
  shouldShowReplicaLoading({
    hasSynced: true,
    localRowCount: 0,
    localQueryLoading: false,
    emptyBootstrapPending: true,
  }),
  false,
  'a synced device does not wait on the server bootstrap',
);

assert.equal(
  shouldRouteToCreateFarm({
    localFarmsResolved: false,
    farmCount: 0,
    hasActiveFarm: false,
  }),
  false,
);

assert.equal(
  shouldRouteToCreateFarm({
    localFarmsResolved: true,
    farmCount: 0,
    hasActiveFarm: false,
  }),
  true,
);

assert.equal(
  shouldRouteToCreateFarm({
    localFarmsResolved: true,
    farmCount: 1,
    hasActiveFarm: false,
  }),
  false,
);

assert.equal(
  shouldRouteToCreateFarm({
    localFarmsResolved: true,
    farmCount: 0,
    hasActiveFarm: true,
  }),
  false,
);

assert.deepEqual(preferLocalRows([{ id: 'q' }], [{ id: 'local' }]), [
  { id: 'q' },
]);
assert.deepEqual(preferLocalRows([], [{ id: 'local' }]), [{ id: 'local' }]);
assert.deepEqual(preferLocalRows([], null), []);
assert.deepEqual(preferLocalRows([], []), []);

const livestock = read('app/(tabs)/livestock/index.tsx');
assert.match(livestock, /shouldShowReplicaLoading/);
assert.match(livestock, /useLocalHerd/);
assert.doesNotMatch(
  livestock,
  /farmLoading \|\| \(activeFarm && animalsLoading\)/,
);

const weight = read('app/(tabs)/livestock/weight.tsx');
assert.match(weight, /shouldShowReplicaLoading/);
assert.match(weight, /useLocalHerd/);
assert.doesNotMatch(
  weight,
  /if \(isLoading\) \{\s*return <LoadingState message="Loading animals/,
);

const dashboard = read('app/(tabs)/dashboard.tsx');
assert.match(dashboard, /useLocalHerd/);
assert.match(dashboard, /preferLocalRows/);

const provider = read('providers/FarmProvider.tsx');
assert.match(provider, /shouldShowReplicaLoading/);
assert.match(provider, /getFarmsForUser\(userId\)/);
assert.match(provider, /waitForStream: false/);
assert.doesNotMatch(
  provider,
  /localFarms\.length === 0 && bootstrapFarms === null/,
);

const index = read('app/index.tsx');
assert.match(index, /shouldRouteToCreateFarm/);

const restore = read('scripts/restore-db.sh');
assert.match(
  restore,
  /re-check the powersync publication and the PowerSync connection/,
);

console.log('assert-offline-replica: ok');
