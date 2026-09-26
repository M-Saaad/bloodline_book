import assert from 'node:assert/strict';

import {
  buildPickerRows,
  compareHerdOrder,
  formatOutsideAnimalLabel,
  isBreedingAgeDoe,
  pedigreeBlockers,
  searchRank,
  visibleAnimalIds,
} from '../lib/ui/animal-picker.ts';

function goat(partial) {
  return {
    id: partial.id,
    farmId: 'farm',
    name: partial.name ?? null,
    tagNumber: partial.tagNumber ?? null,
    officialId: null,
    photoStoragePath: null,
    breedPrimaryId: null,
    breedPercentage: null,
    sex: partial.sex ?? 'female',
    dateOfBirth: partial.dateOfBirth ?? null,
    status: partial.status ?? 'active',
    lifecycleStage: partial.lifecycleStage ?? 'adult',
    purpose: null,
    damId: partial.damId ?? null,
    damExternalName: null,
    sireId: partial.sireId ?? null,
    sireExternalName: null,
    litterId: null,
    registrationBody: null,
    registrationNumber: null,
    tattoo: null,
    purchasePrice: null,
    soldPrice: null,
    purchasedFromId: null,
    outDate: null,
    notes: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const moonbeam = goat({ id: 'a', name: 'Moonbeam', tagNumber: '14', sex: 'female' });
const clover = goat({ id: 'b', name: 'Clover', tagNumber: '2', sex: 'female' });
const atlas = goat({
  id: 'c',
  name: 'Atlas',
  tagNumber: '8',
  sex: 'male',
  status: 'sold',
});
const kid = goat({
  id: 'd',
  name: 'Kid',
  tagNumber: '40',
  sex: 'female',
  damId: 'a',
  sireId: 'c',
  lifecycleStage: 'kid',
  dateOfBirth: '2026-03-01',
});

const ordered = [moonbeam, clover, atlas].sort(compareHerdOrder);
assert.deepEqual(
  ordered.map((animal) => animal.tagNumber),
  ['2', '8', '14'],
);

assert.equal(searchRank(moonbeam, '14'), 0);
assert.equal(searchRank(kid, '4'), 1);
assert.equal(searchRank(moonbeam, '4'), 2);

const rows = buildPickerRows({
  animals: [moonbeam, clover, atlas, kid],
  outsideAnimals: [
    {
      id: 'out-1',
      name: 'AI Buck',
      sex: 'male',
      registrationBody: 'adga',
      registrationNumber: 'N123',
      breedName: 'Nubian',
    },
  ],
  query: '',
  recentIds: ['b', 'outside:out-1'],
  suggestedIds: [],
  chip: null,
  exclude: [{ id: 'a', reason: "Can't be their own parent" }],
  disabled: [{ id: 'd', reason: 'Already on this pasture' }],
  includeOutside: true,
});

assert.equal(rows[0].kind, 'header');
assert.equal(rows[0].title, 'Recent');
assert.equal(rows[1].kind, 'animal');
assert.equal(rows[1].animal.id, 'b');
assert.equal(rows[2].kind, 'outside');
assert.equal(visibleAnimalIds(rows).includes('a'), false);
assert.equal(visibleAnimalIds(rows).includes('d'), false);
assert.ok(rows.some((row) => row.kind === 'excluded' && row.animal.id === 'd'));
assert.equal(
  rows.some((row) => row.kind === 'excluded' && row.animal.id === 'a'),
  false,
);

const searched = buildPickerRows({
  animals: [moonbeam, clover, atlas, kid],
  outsideAnimals: [],
  query: 'moon',
  recentIds: [],
  suggestedIds: [],
  chip: null,
  exclude: [{ id: 'a', reason: "Can't be their own parent" }],
  disabled: [],
  includeOutside: false,
});
assert.ok(searched.some((row) => row.kind === 'excluded' && row.reason.includes('parent')));

const blockers = pedigreeBlockers('a', [moonbeam, clover, atlas, kid]);
const reasons = new Map(blockers.map((item) => [item.id, item.reason]));
assert.match(reasons.get('a'), /own parent/);
assert.equal(reasons.has('b'), false);
assert.match(reasons.get('d') ?? '', /descendant/);

const grandkid = goat({ id: 'e', name: 'Grand', damId: 'd' });
const grandBlock = new Map(
  pedigreeBlockers('e', [moonbeam, kid, grandkid]).map((item) => [item.id, item.reason]),
);
assert.match(grandBlock.get('a') ?? '', /ancestor/);
assert.match(grandBlock.get('d') ?? '', /ancestor/);

assert.equal(
  isBreedingAgeDoe(
    goat({ id: 'young', sex: 'female', dateOfBirth: '2026-08-01', lifecycleStage: 'kid' }),
    '2026-09-26',
  ),
  false,
);
assert.equal(
  isBreedingAgeDoe(
    goat({ id: 'ready', sex: 'female', dateOfBirth: '2025-01-01', lifecycleStage: 'adult' }),
    '2026-09-26',
  ),
  true,
);

assert.equal(
  formatOutsideAnimalLabel({
    name: 'AI Buck',
    registrationBody: 'adga',
    registrationNumber: 'N123',
  }),
  'AI Buck · ADGA N123',
);

console.log('assert-animal-picker: ok');
