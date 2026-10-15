import assert from 'node:assert/strict';

import {
  addAnimalDraftFromDuplicateSource,
  createEmptyAddAnimalDraft,
  isAddAnimalDraftDirty,
  shouldApplyDuplicatePrefillLoad,
  shouldResetAddAnimalDraftForSession,
} from '../lib/domain/add-animal-form.ts';
import { isOnAddGoatScreen } from '../lib/navigation/add-animal-unsaved-guard.ts';

const empty = createEmptyAddAnimalDraft();
assert.equal(empty.name, '');
assert.equal(empty.tagNumber, '');
assert.equal(empty.sex, 'female');
assert.equal(empty.breedId, null);

assert.equal(
  shouldResetAddAnimalDraftForSession('s1', 's1', {}, null),
  false,
  'same session keeps draft',
);
assert.equal(
  shouldResetAddAnimalDraftForSession('s2', 's1', {}, null),
  true,
  'new session clears stale draft',
);
assert.equal(
  shouldResetAddAnimalDraftForSession(
    'dup-1',
    's1',
    { duplicateFrom: 'animal-1', prefill: 'session-2' },
    'session-1',
  ),
  false,
  'new duplicate prefill should not be cleared before loader runs',
);
assert.equal(
  shouldResetAddAnimalDraftForSession(
    'dup-1',
    's1',
    { duplicateFrom: 'animal-1', prefill: 'session-1' },
    'session-1',
  ),
  true,
  'new add session still clears even when duplicate prefill was already applied',
);

assert.equal(shouldApplyDuplicatePrefillLoad(0, 0), true);
assert.equal(shouldApplyDuplicatePrefillLoad(0, 1), false, 'stale duplicate callback');

assert.equal(
  isAddAnimalDraftDirty(
    { ...empty, name: 'Daisy' },
    empty,
  ),
  true,
);
assert.equal(isAddAnimalDraftDirty(empty, empty), false);
assert.equal(isOnAddGoatScreen('/livestock/add'), true);
assert.equal(isOnAddGoatScreen('/livestock/add?session=abc'), true);
assert.equal(isOnAddGoatScreen('/livestock'), false);
assert.equal(
  isAddAnimalDraftDirty(
    { ...empty, sex: 'male' },
    empty,
  ),
  true,
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
