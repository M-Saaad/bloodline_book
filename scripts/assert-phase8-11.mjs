import assert from 'node:assert/strict';

import { addDaysToIso, formatMonthDay } from '../lib/dates.ts';
import {
  computeBreedingWindow,
  dueWindowForExposure,
  dueWindowForHandBred,
  formatDueWindowPhrase,
  isBreedingOpenForKidding,
  isCalendarBreeding,
  kiddingDueTaskTitle,
  kiddingSoonCategory,
} from '../lib/domain/breeding.ts';
import {
  activeWithdrawalsByAnimal,
  famachaHerdFlag,
  meatSaleWarning,
  meatWithdrawalTaskTitle,
  milkWithdrawalTaskTitle,
  needsFamachaFollowUp,
  rememberedProducts,
  showsMilkWithdrawal,
  withdrawalClearDate,
} from '../lib/domain/health.ts';
import {
  aliveKidCount,
  kidInheritsBreed,
  litterSummaryLabel,
  weaningTaskTitle,
} from '../lib/domain/kidding.ts';
import { hideOldCompletedTask, partitionOpenTasks } from '../lib/domain/today.ts';

const bred = '2026-09-01';
const hand = dueWindowForHandBred(bred, 150);
assert.ok(hand);
assert.equal(hand.windowStart, addDaysToIso(bred, 145));
assert.equal(hand.windowEnd, addDaysToIso(bred, 155));
assert.equal(hand.dueDate, addDaysToIso(bred, 150));
assert.equal(
  kiddingDueTaskTitle('Daisy', hand.windowStart, hand.windowEnd).startsWith(
    'Kidding due — Daisy (',
  ),
  true,
);

const exposure = dueWindowForExposure('2026-09-01', '2026-09-30', 150);
assert.ok(exposure);
assert.equal(exposure.windowStart, addDaysToIso('2026-09-01', 145));
assert.equal(exposure.windowEnd, addDaysToIso('2026-09-30', 155));
assert.equal(computeBreedingWindow({ bredDate: '2026-09-30', exposureEndDate: '2026-09-01', gestationDays: 150 }), null);

assert.equal(isCalendarBreeding('bred'), true);
assert.equal(isCalendarBreeding('confirmed'), true);
assert.equal(isCalendarBreeding('open'), false);
assert.equal(isCalendarBreeding('lost'), false);
assert.equal(isBreedingOpenForKidding('open'), false);
assert.equal(isBreedingOpenForKidding('lost'), false);

assert.equal(formatMonthDay('2026-02-14'), 'Feb 14');
assert.match(
  formatDueWindowPhrase('2026-02-14', '2026-02-24'),
  /Due between Feb 14 and Feb 24/,
);

assert.equal(kiddingSoonCategory('2026-02-01', '2026-02-10', '2026-02-20'), 'past_due');
assert.equal(kiddingSoonCategory('2026-02-20', '2026-03-01', '2026-02-01'), 'soon');
assert.equal(kiddingSoonCategory('2026-04-01', '2026-04-10', '2026-02-01'), null);

assert.equal(aliveKidCount([{ outcome: 'alive' }, { outcome: 'dead' }, { outcome: 'alive' }]), 2);
assert.equal(litterSummaryLabel(2, 2), 'Twin (2 born, 2 alive)');
assert.equal(litterSummaryLabel(3, 2), 'Triplet (3 born, 2 alive)');
assert.equal(kidInheritsBreed('boer', 'boer'), 'boer');
assert.equal(kidInheritsBreed('boer', null), 'boer');
assert.equal(kidInheritsBreed('boer', 'kiko'), null);
assert.equal(weaningTaskTitle('Daisy'), "Wean — Daisy's kids");

assert.equal(showsMilkWithdrawal('meat'), false);
assert.equal(showsMilkWithdrawal('dairy'), true);
assert.equal(showsMilkWithdrawal('both'), true);
assert.equal(needsFamachaFollowUp(3), false);
assert.equal(needsFamachaFollowUp(5), true);
assert.equal(withdrawalClearDate('2026-09-24', 16), '2026-10-10');
assert.equal(
  meatWithdrawalTaskTitle('Buttercup', 'Safe-Guard'),
  'Meat withdrawal clears — Buttercup (Safe-Guard)',
);
assert.equal(
  milkWithdrawalTaskTitle('Buttercup', 'Safe-Guard'),
  'Milk withdrawal clears — Buttercup (Safe-Guard)',
);

const badges = activeWithdrawalsByAnimal(
  [
    {
      animalId: 'a1',
      date: '2026-09-24',
      productName: 'Safe-Guard',
      meatDays: 16,
      milkDays: 4,
    },
  ],
  '2026-09-24',
);
assert.equal(badges.get('a1')?.meat?.clearDate, '2026-10-10');
assert.equal(badges.get('a1')?.milk?.clearDate, '2026-09-28');
assert.match(meatSaleWarning('Buttercup', '2026-10-12', 'Safe-Guard'), /Safe-Guard/);
assert.match(meatSaleWarning('Buttercup', '2026-10-12', 'Safe-Guard'), /Oct 12/);

const flag = famachaHerdFlag(
  [
    { animalId: 'a', date: '2026-09-20', score: 5 },
    { animalId: 'b', date: '2026-09-20', score: 2 },
    { animalId: 'c', date: '2026-09-20', score: 1 },
    { animalId: 'd', date: '2026-09-20', score: 4 },
  ],
  '2026-09-24',
);
assert.deepEqual(flag, { high: 2, scored: 4 });
assert.equal(
  famachaHerdFlag(
    [
      { animalId: 'a', date: '2026-09-20', score: 5 },
      { animalId: 'b', date: '2026-09-20', score: 1 },
      { animalId: 'c', date: '2026-09-20', score: 1 },
      { animalId: 'd', date: '2026-09-20', score: 1 },
      { animalId: 'e', date: '2026-09-20', score: 1 },
      { animalId: 'f', date: '2026-09-20', score: 1 },
      { animalId: 'g', date: '2026-09-20', score: 1 },
      { animalId: 'h', date: '2026-09-20', score: 1 },
      { animalId: 'i', date: '2026-09-20', score: 1 },
      { animalId: 'j', date: '2026-09-20', score: 1 },
    ],
    '2026-09-24',
  ),
  null,
);

const products = rememberedProducts([
  {
    productName: 'Safe-Guard',
    dosage: 'old',
    route: 'oral',
    meatDays: 10,
    milkDays: 2,
    date: '2026-01-01',
  },
  {
    productName: 'Safe-Guard',
    dosage: 'new',
    route: 'oral',
    meatDays: 16,
    milkDays: 4,
    date: '2026-08-01',
  },
]);
assert.equal(products.length, 1);
assert.equal(products[0].dosage, 'new');
assert.equal(products[0].meatDays, 16);

const parts = partitionOpenTasks(
  [
    { id: '1', dueDate: '2026-09-20', source: 'manual', completed: false },
    { id: '2', dueDate: '2026-09-24', source: 'famacha_check', completed: false },
    { id: '3', dueDate: '2026-09-26', source: 'famacha_check', completed: false },
    { id: '4', dueDate: '2026-09-28', source: 'manual', completed: false },
    { id: '5', dueDate: '2026-10-20', source: 'manual', completed: false },
    { id: '6', dueDate: null, source: 'manual', completed: false },
    { id: '7', dueDate: null, source: 'manual', completed: true },
  ],
  '2026-09-24',
);
assert.deepEqual(parts.dueNow.map((task) => task.id), ['1']);
assert.deepEqual(parts.famachaSoon.map((task) => task.id), ['2', '3']);
assert.deepEqual(parts.comingWeek.map((task) => task.id), ['4']);
assert.deepEqual(parts.undated.map((task) => task.id), ['6']);
assert.equal(hideOldCompletedTask(true, '2026-08-01T00:00:00.000Z', '2026-09-24'), true);
assert.equal(hideOldCompletedTask(true, '2026-09-20T00:00:00.000Z', '2026-09-24'), false);

console.log('assert-phase8-11: ok');
