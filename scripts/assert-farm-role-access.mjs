import assert from 'node:assert/strict';

import {
  VIEW_ONLY_FARM_MESSAGE,
  farmRoleCanWrite,
  farmRoleIsHand,
  parseFarmMemberRole,
  resolveFarmRoleCapabilities,
} from '../lib/domain/farm-role-access.ts';

assert.equal(farmRoleCanWrite('owner'), true);
assert.equal(farmRoleCanWrite('manager'), true);
assert.equal(farmRoleCanWrite('hand'), false);
assert.equal(farmRoleCanWrite(null), false);
assert.equal(farmRoleIsHand('hand'), true);
assert.equal(farmRoleIsHand('manager'), false);
assert.equal(farmRoleIsHand(null), false);
assert.match(VIEW_ONLY_FARM_MESSAGE, /manager access/);

assert.equal(parseFarmMemberRole('owner'), 'owner');
assert.equal(parseFarmMemberRole('bogus'), null);

const ownerLoaded = resolveFarmRoleCapabilities('owner', {
  localLoading: false,
  fallbackLoading: false,
});
assert.equal(ownerLoaded.canWrite, true);
assert.equal(ownerLoaded.isRolePending, false);
assert.equal(ownerLoaded.showReadOnlyBanner, false);

const ownerWhileLocalQueryLoading = resolveFarmRoleCapabilities('owner', {
  localLoading: true,
  fallbackLoading: false,
});
assert.equal(ownerWhileLocalQueryLoading.canWrite, true);
assert.equal(ownerWhileLocalQueryLoading.isRolePending, false);

const managerLoaded = resolveFarmRoleCapabilities('manager', {
  localLoading: false,
  fallbackLoading: false,
});
assert.equal(managerLoaded.canWrite, true);
assert.equal(managerLoaded.isRolePending, false);

const handLoaded = resolveFarmRoleCapabilities('hand', {
  localLoading: false,
  fallbackLoading: false,
});
assert.equal(handLoaded.canWrite, false);
assert.equal(handLoaded.isHand, true);
assert.equal(handLoaded.showReadOnlyBanner, true);

const pendingUnknown = resolveFarmRoleCapabilities(null, {
  localLoading: true,
  fallbackLoading: false,
});
assert.equal(pendingUnknown.canWrite, false);
assert.equal(pendingUnknown.isRolePending, true);
assert.equal(pendingUnknown.showReadOnlyBanner, false);

const pendingFallback = resolveFarmRoleCapabilities(null, {
  localLoading: false,
  fallbackLoading: true,
});
assert.equal(pendingFallback.canWrite, false);
assert.equal(pendingFallback.isRolePending, true);
assert.equal(pendingFallback.showReadOnlyBanner, false);

const unknownAfterLoad = resolveFarmRoleCapabilities(null, {
  localLoading: false,
  fallbackLoading: false,
});
assert.equal(unknownAfterLoad.canWrite, false);
assert.equal(unknownAfterLoad.showReadOnlyBanner, true);

console.log('assert-farm-role-access: ok');