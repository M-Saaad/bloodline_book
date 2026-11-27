import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  canSwitchFarm,
  mergeFarmLists,
  parseRememberedFarm,
  resolveActiveFarmId,
  savedFarmIdForUser,
} from '../lib/domain/active-farm.ts';

const root = path.resolve(import.meta.dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const alpha = { id: 'farm-alpha' };
const bravo = { id: 'farm-bravo' };
const charlie = { id: 'farm-charlie' };
const farms = [alpha, bravo, charlie];

assert.equal(canSwitchFarm(0), false);
assert.equal(canSwitchFarm(1), false);
assert.equal(canSwitchFarm(2), true);
assert.equal(canSwitchFarm(3), true);

const named = (id, name) => ({ id, name });
const alphaFarm = named('farm-alpha', 'Alpha');
const bravoFarm = named('farm-bravo', 'Bravo');
const charlieFarm = named('farm-charlie', 'Charlie');
const localOrder = [charlieFarm, alphaFarm, bravoFarm];

const sameSetDifferentOrder = mergeFarmLists(localOrder, [
  bravoFarm,
  { id: 'farm-alpha', name: 'Alpha from server' },
  charlieFarm,
]);
assert.deepEqual(
  sameSetDifferentOrder.map((farm) => farm.id),
  ['farm-charlie', 'farm-alpha', 'farm-bravo'],
);
assert.equal(sameSetDifferentOrder[1], alphaFarm);
assert.equal(sameSetDifferentOrder[1].name, 'Alpha');

const shortLocal = mergeFarmLists([alphaFarm], [
  charlieFarm,
  alphaFarm,
  bravoFarm,
  charlieFarm,
]);
assert.deepEqual(
  shortLocal.map((farm) => farm.name),
  ['Alpha', 'Bravo', 'Charlie'],
);
assert.equal(shortLocal[0], alphaFarm);
assert.equal(canSwitchFarm(shortLocal.length), true);

assert.deepEqual(mergeFarmLists(localOrder, null), localOrder);
assert.deepEqual(mergeFarmLists(localOrder, []), localOrder);
assert.deepEqual(mergeFarmLists([], null), []);

const serverOnly = mergeFarmLists(
  [],
  [bravoFarm, alphaFarm],
);
assert.deepEqual(
  serverOnly.map((farm) => farm.id),
  ['farm-alpha', 'farm-bravo'],
);
assert.equal(
  resolveActiveFarmId({
    farms: serverOnly,
    preferredFarmId: 'farm-bravo',
  }),
  'farm-bravo',
);
assert.equal(
  serverOnly.find((farm) => farm.id === 'farm-bravo')?.name,
  'Bravo',
);

assert.equal(
  resolveActiveFarmId({ farms: [alpha], preferredFarmId: null }),
  'farm-alpha',
);
assert.equal(
  resolveActiveFarmId({ farms, preferredFarmId: null }),
  'farm-alpha',
);
assert.equal(
  resolveActiveFarmId({ farms, preferredFarmId: 'farm-charlie' }),
  'farm-charlie',
);
assert.equal(
  resolveActiveFarmId({ farms, preferredFarmId: 'farm-left' }),
  'farm-alpha',
);
assert.equal(
  resolveActiveFarmId({ farms: [], preferredFarmId: 'farm-charlie' }),
  'farm-charlie',
);
assert.equal(
  resolveActiveFarmId({ farms: [], preferredFarmId: null }),
  null,
);

const remembered = { userId: 'user-a', farmId: 'farm-charlie' };
assert.equal(savedFarmIdForUser(remembered, 'user-a'), 'farm-charlie');
assert.equal(savedFarmIdForUser(remembered, 'user-b'), null);
assert.equal(savedFarmIdForUser(remembered, null), null);
assert.equal(savedFarmIdForUser(null, 'user-a'), null);

assert.deepEqual(
  parseRememberedFarm(
    JSON.stringify({ userId: 'user-a', farmId: 'farm-bravo' }),
  ),
  { userId: 'user-a', farmId: 'farm-bravo' },
);
assert.equal(parseRememberedFarm(null), null);
assert.equal(parseRememberedFarm(''), null);
assert.equal(parseRememberedFarm('farm-bravo'), null);
assert.equal(parseRememberedFarm('{"farmId":"farm-bravo"}'), null);
assert.equal(parseRememberedFarm('{"userId":"user-a"}'), null);

assert.equal(
  resolveActiveFarmId({
    farms,
    preferredFarmId: savedFarmIdForUser(remembered, 'user-b'),
  }),
  'farm-alpha',
);

const more = read('app/(tabs)/more/index.tsx');
assert.match(more, /canSwitchFarm\(farms\.length\)/);
assert.match(more, /activeFarm && !canSwitch/);
assert.match(more, /FarmSwitcherSheet/);
assert.match(
  read('components/FarmSwitcherSheet.tsx'),
  /SELECT farm_id, role FROM farm_members WHERE lower\(user_id\) = lower\(\?\)/,
);

const provider = read('providers/FarmProvider.tsx');
assert.match(provider, /resolveActiveFarmId/);
assert.match(provider, /savedFarmIdForUser/);
assert.match(provider, /member_user_id/);
assert.match(provider, /mergeFarmLists\(localFarms, serverFarms\)/);
assert.match(provider, /deviceOnline !== true/);
assert.match(provider, /setReadLocalFarms\(null\)/);
assert.match(provider, /setBootstrapFarms\(null\)/);
assert.doesNotMatch(
  provider,
  /if \(localFarms\.length > 0\) \{\s*setBootstrapFarms\(null\)/,
);
assert.match(provider, /useFarmScopeKey/);

const store = read('lib/store/ui.ts');
assert.match(store, /ACTIVE_FARM_STORAGE_KEY = 'bloodline\.activeFarmId'/);
assert.match(store, /AsyncStorage\.setItem/);
assert.match(store, /AsyncStorage\.removeItem/);

const auth = read('providers/AuthProvider.tsx');
const signOutStart = auth.indexOf('const signOut = useCallback');
assert.notEqual(signOutStart, -1);
const signOutBody = auth.slice(signOutStart, auth.indexOf('const value = useMemo'));
assert.match(signOutBody, /clearRememberedFarmId/);
assert.ok(
  signOutBody.indexOf('supabase.auth.signOut') <
    signOutBody.indexOf('clearRememberedFarmId'),
);

for (const rel of [
  'app/(tabs)/dashboard.tsx',
  'app/(tabs)/livestock/_layout.tsx',
  'app/(tabs)/more/_layout.tsx',
  'app/(tabs)/more/breeding/_layout.tsx',
  'app/(tabs)/land/_layout.tsx',
  'app/(tabs)/finances/_layout.tsx',
]) {
  assert.match(read(rel), /useFarmScopeKey/, rel);
}

for (const rel of [
  'app/(tabs)/dashboard.tsx',
  'app/(tabs)/livestock/index.tsx',
  'app/(tabs)/more/breeding/index.tsx',
]) {
  const source = read(rel);
  assert.match(source, /farm_id = \?/, rel);
  assert.match(source, /activeFarm\.id/, rel);
}

console.log('assert-active-farm: ok');
