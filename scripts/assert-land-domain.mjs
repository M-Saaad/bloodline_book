import assert from 'node:assert/strict';

function isGrazingRangeValid(startDate, endDate) {
  if (!endDate) {
    return true;
  }
  return endDate >= startDate;
}

function pastureStatusAfterMoveIn(current) {
  switch (current) {
    case 'resting':
      return 'grazing';
    case 'grazing':
    case 'hay':
    case 'overgrazed':
      return current;
    default:
      throw new Error(`unhandled pasture status: ${current}`);
  }
}

function pastureStatusAfterLastMoveOut(current) {
  switch (current) {
    case 'grazing':
      return 'resting';
    case 'resting':
    case 'hay':
    case 'overgrazed':
      return current;
    default:
      throw new Error(`unhandled pasture status: ${current}`);
  }
}

assert.equal(isGrazingRangeValid('2026-04-01', null), true);
assert.equal(isGrazingRangeValid('2026-04-01', '2026-04-01'), true);
assert.equal(isGrazingRangeValid('2026-04-01', '2026-03-31'), false);
assert.equal(pastureStatusAfterMoveIn('resting'), 'grazing');
assert.equal(pastureStatusAfterMoveIn('hay'), 'hay');
assert.equal(pastureStatusAfterLastMoveOut('grazing'), 'resting');
assert.equal(pastureStatusAfterLastMoveOut('overgrazed'), 'overgrazed');
console.log('assert-land-domain: ok');
