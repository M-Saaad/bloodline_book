import assert from 'node:assert/strict';

import {
  animalMatchesSearch,
  formatLivestockRowTitle,
} from '../lib/domain/animals.ts';
import { pastTagSearchHint } from '../lib/domain/tag-history.ts';
import {
  animalDisplayLabel,
  animalTitleParts,
  kidColorLabel,
  UNNAMED_ANIMAL_LABEL,
} from '../lib/ui/animal-labels.ts';
import { searchRank } from '../lib/ui/animal-picker.ts';

const scrapieOnly = {
  name: null,
  tagNumber: null,
  officialId: '0027',
};

assert.equal(
  animalDisplayLabel({ name: ' Daisy ', tagNumber: '4', officialId: '0027' }),
  'Daisy',
);
assert.equal(
  animalDisplayLabel({ name: '  ', tagNumber: ' 14 ', officialId: '0027' }),
  '#14',
);
assert.equal(animalDisplayLabel(scrapieOnly), '0027');
assert.equal(
  animalDisplayLabel({ name: null, tagNumber: null, officialId: '  ' }),
  UNNAMED_ANIMAL_LABEL,
);
assert.equal(
  animalDisplayLabel({ name: null, tagNumber: null, officialId: null }),
  UNNAMED_ANIMAL_LABEL,
);

assert.deepEqual(animalTitleParts(scrapieOnly), { primary: '0027', tag: null });
assert.deepEqual(
  animalTitleParts({ name: 'Daisy', tagNumber: '4', officialId: '0027' }),
  { primary: 'Daisy', tag: '#4' },
);
assert.deepEqual(animalTitleParts({ name: null, tagNumber: '4', officialId: '0027' }), {
  primary: '',
  tag: '#4',
});

assert.equal(formatLivestockRowTitle(scrapieOnly), '0027');
assert.equal(
  formatLivestockRowTitle({ name: 'Daisy', tagNumber: 'A-101', officialId: '0027' }),
  '#A-101 · Daisy',
);
assert.equal(
  formatLivestockRowTitle({ name: null, tagNumber: null, officialId: null }),
  UNNAMED_ANIMAL_LABEL,
);

assert.equal(
  animalMatchesSearch(
    {
      name: null,
      tagNumber: null,
      officialId: '0027',
      registrationNumber: null,
      tattoo: null,
    },
    '0027',
  ),
  true,
);
assert.equal(
  animalMatchesSearch(
    {
      name: null,
      tagNumber: null,
      officialId: '0027',
      registrationNumber: null,
      tattoo: null,
    },
    '99',
  ),
  false,
);
assert.equal(searchRank({ tagNumber: null, officialId: '0027' }, '0027'), 0);
assert.equal(searchRank({ tagNumber: '14', officialId: '0027' }, '002'), 1);
assert.equal(searchRank({ tagNumber: '14', officialId: null }, '0027'), 2);

const daisy = { name: 'Daisy', tagNumber: '24B', officialId: null };
assert.equal(animalDisplayLabel(daisy), 'Daisy');
assert.equal(animalTitleParts(daisy).tag, '#24B');
assert.equal(pastTagSearchHint(daisy, '24A', ['24A']), 'was 24A');
assert.equal(animalDisplayLabel(daisy), 'Daisy');
assert.equal(formatLivestockRowTitle(daisy), '#24B · Daisy');
assert.equal(pastTagSearchHint(daisy, '24B', ['24A']), null);
assert.equal(kidColorLabel({ lifecycleStage: 'kid', color: ' red ' }), 'red');
assert.equal(kidColorLabel({ lifecycleStage: 'adult', color: 'red' }), null);
assert.equal(kidColorLabel({ lifecycleStage: 'kid', color: '  ' }), null);

console.log('assert-animal-labels: ok');
