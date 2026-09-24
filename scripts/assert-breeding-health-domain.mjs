import assert from 'node:assert/strict';

function isBreedingOpenForKidding(status) {
  return ['bred', 'confirmed'].includes(status);
}

function needsFamachaFollowUp(score) {
  return score >= 4;
}

function withdrawalClearDate(recordDate, withdrawalDays) {
  if (withdrawalDays <= 0) {
    return null;
  }
  const [y, m, d] = recordDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + withdrawalDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

assert.equal(isBreedingOpenForKidding('bred'), true);
assert.equal(isBreedingOpenForKidding('open'), false);
assert.equal(isBreedingOpenForKidding('kidded'), false);
assert.equal(needsFamachaFollowUp(3), false);
assert.equal(needsFamachaFollowUp(4), true);
assert.equal(withdrawalClearDate('2026-01-01', 14), '2026-01-15');
assert.equal(withdrawalClearDate('2026-01-01', 0), null);

function validateKiddingCounts(kidsBorn, kidsSurviving) {
  if (!Number.isFinite(kidsBorn) || kidsBorn < 0) {
    return 'Enter a valid number of kids born.';
  }
  if (kidsSurviving == null) {
    return null;
  }
  if (!Number.isFinite(kidsSurviving) || kidsSurviving < 0) {
    return 'Enter a valid surviving count.';
  }
  if (kidsSurviving > kidsBorn) {
    return 'Kids surviving cannot be more than kids born.';
  }
  return null;
}

assert.match(validateKiddingCounts(3, 4) ?? '', /cannot be more/);
assert.equal(validateKiddingCounts(3, 3), null);

console.log('assert-breeding-health-domain: ok');
