import assert from 'node:assert/strict';

import {
  VIEW_ONLY_FARM_MESSAGE,
  farmRoleCanWrite,
  farmRoleIsHand,
} from '../lib/domain/farm-role-access.ts';

assert.equal(farmRoleCanWrite('owner', false), true);
assert.equal(farmRoleCanWrite('manager', false), true);
assert.equal(farmRoleCanWrite('hand', false), false);
assert.equal(farmRoleCanWrite(null, false), false);
assert.equal(farmRoleCanWrite('hand', true), false);
assert.equal(farmRoleCanWrite('manager', true), false);
assert.equal(farmRoleIsHand('hand'), true);
assert.equal(farmRoleIsHand('manager'), false);
assert.equal(farmRoleIsHand(null), false);
assert.match(VIEW_ONLY_FARM_MESSAGE, /manager access/);

console.log('assert-farm-role-access: ok');