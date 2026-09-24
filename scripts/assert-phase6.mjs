import assert from 'node:assert/strict';

function animalDeleteBlockedMessage(blockers) {
  if (blockers.includes('breeding')) {
    return 'This goat has breeding records — mark her Sold or Dead instead.';
  }
  if (blockers.includes('kidding')) {
    return 'This goat has kidding records — mark her Sold or Dead instead.';
  }
  if (blockers.includes('offspring')) {
    return 'This goat is listed as a parent on other animals — mark her Sold or Dead instead.';
  }
  return 'This goat cannot be deleted.';
}

function kiddingDeleteKidsPrompt(kids) {
  if (kids.length === 0) {
    return '';
  }
  const withRecords = kids.filter((kid) => kid.hasWeights || kid.hasHealth);
  let message = `Also delete the ${kids.length} kid${kids.length === 1 ? '' : 's'} registered from this kidding?`;
  if (withRecords.length > 0) {
    const names = withRecords
      .map((kid) => kid.name ?? kid.tagNumber ?? 'Unnamed kid')
      .join(', ');
    message += ` ${names} already have weights or health records.`;
  }
  return message;
}

assert.match(animalDeleteBlockedMessage(['breeding']), /breeding records/);
assert.match(kiddingDeleteKidsPrompt([{ hasWeights: true, hasHealth: false, name: 'Kid 1' }]), /Kid 1/);
console.log('assert-phase6: ok');
