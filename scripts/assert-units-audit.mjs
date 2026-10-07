import assert from 'node:assert/strict';

import {
  activeWithdrawalsByAnimal,
  meatSaleWarning,
  withdrawalBadgeLabel,
  withdrawalClearDate,
} from '../lib/domain/health.ts';
import { formatFarmCurrency } from '../lib/format/money.ts';

const clearDate = withdrawalClearDate('2026-01-01', 14);
assert.equal(clearDate, '2026-01-15');

const records = [
  {
    animalId: 'a1',
    date: '2026-01-01',
    productName: 'Safe-Guard',
    meatDays: 14,
    milkDays: null,
  },
];

const dayBeforeClear = activeWithdrawalsByAnimal(records, '2026-01-14');
assert.ok(dayBeforeClear.get('a1')?.meat, 'withdrawal active the day before clear date');

const onClearDate = activeWithdrawalsByAnimal(records, '2026-01-15');
assert.equal(
  onClearDate.get('a1')?.meat,
  undefined,
  'clear date is the first allowed day — no active meat withdrawal',
);

assert.match(withdrawalBadgeLabel('meat', '2026-03-05'), /^Safe to sell from /);
assert.match(withdrawalBadgeLabel('milk', '2026-03-05'), /^Safe to milk from /);
assert.match(
  meatSaleWarning('Daisy', '2026-03-05', 'Safe-Guard'),
  /not safe for meat before/,
);
assert.match(meatSaleWarning('Daisy', '2026-03-05', null), /Daisy/);

assert.match(formatFarmCurrency(12.5, 'USD'), /12\.50/);
assert.equal(formatFarmCurrency(10, 'NOTREAL'), 'NOTREAL 10.00');

console.log('assert-units-audit: ok');
