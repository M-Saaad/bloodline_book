import assert from 'node:assert/strict';

import {
  addAnimalDraftFromDuplicateSource,
  createEmptyAddAnimalDraft,
  shouldResetAddAnimalDraftOnFocus,
} from '../lib/domain/add-animal-form.ts';

const empty = createEmptyAddAnimalDraft();
assert.equal(empty.name, '');
assert.equal(empty.tagNumber, '');
assert.equal(empty.sex, 'female');
assert.equal(empty.breedId, null);

assert.equal(
  shouldResetAddAnimalDraftOnFocus(0, {}, null),
  false,
  'first focus keeps initial defaults',
);
assert.equal(
  shouldResetAddAnimalDraftOnFocus(1, {}, null),
  true,
  'second focus clears stale draft',
);
assert.equal(
  shouldResetAddAnimalDraftOnFocus(2, {}, null),
  true,
);

assert.equal(
  shouldResetAddAnimalDraftOnFocus(
    1,
    { duplicateFrom: 'animal-1', prefill: 'session-2' },
    'session-1',
  ),
  false,
  'new duplicate prefill should not be cleared before loader runs',
);
assert.equal(
  shouldResetAddAnimalDraftOnFocus(
    1,
    { duplicateFrom: 'animal-1', prefill: 'session-1' },
    'session-1',
  ),
  true,
  're-open add without duplicate params still clears',
);

const duplicate = addAnimalDraftFromDuplicateSource({
  id: 'a1',
  farmId: 'f1',
  name: 'Buttercup',
  tagNumber: '101',
  officialId: 'OID',
  photoStoragePath: null,
  breedPrimaryId: 'breed-1',
  breedPercentage: 75,
  sex: 'male',
  dateOfBirth: '2024-01-01',
  status: 'active',
  lifecycleStage: 'adult',
  purpose: null,
  damId: 'dam-1',
  damExternalName: null,
  sireId: null,
  sireExternalName: 'Outside buck',
  litterId: null,
  registrationBody: 'adga',
  registrationNumber: 'REG-1',
  tattoo: 'L1',
  purchasePrice: null,
  soldPrice: null,
  purchasedFromId: null,
  outDate: null,
  notes: null,
  createdAt: '',
  updatedAt: '',
});

assert.equal(duplicate.name, '');
assert.equal(duplicate.tagNumber, '');
assert.equal(duplicate.sex, 'male');
assert.equal(duplicate.breedId, 'breed-1');
assert.equal(duplicate.breedPercentage, '75');
assert.equal(duplicate.sireExternalName, 'Outside buck');
assert.equal(duplicate.registrationNumber, 'REG-1');

console.log('assert-add-animal-form: ok');
