import assert from 'node:assert/strict';

function validateAnimalNameOrTag(name, tagNumber) {
  if (!name.trim() && !tagNumber.trim()) {
    return 'Enter a name or a tag number.';
  }
  return null;
}

function animalMatchesSearch(animal, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const fields = [
    animal.name,
    animal.tagNumber,
    animal.officialId,
    animal.registrationNumber,
    animal.tattoo,
  ];

  return fields.some((value) => value?.toLowerCase().includes(normalized));
}

function formatLivestockRowTitle(animal) {
  const tag = animal.tagNumber?.trim();
  const name = animal.name?.trim();

  if (tag && name) {
    return `#${tag} · ${name}`;
  }
  if (name) {
    return name;
  }
  if (tag) {
    return `#${tag}`;
  }
  return 'Unnamed';
}

function parseHerdStatusFilter(value) {
  switch (value) {
    case 'active':
    case 'sold':
    case 'died':
    case 'slaughtered':
    case 'transferred':
    case 'all':
      return value;
    default:
      return 'active';
  }
}

function parseIsoDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatAnimalAge(dateOfBirth, referenceIso) {
  if (!dateOfBirth) {
    return 'Age unknown';
  }

  const birth = parseIsoDate(dateOfBirth);
  const reference = parseIsoDate(referenceIso);

  let months =
    (reference.getFullYear() - birth.getFullYear()) * 12 +
    (reference.getMonth() - birth.getMonth());
  if (reference.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    return 'Age unknown';
  }
  if (months < 12) {
    return `${months} mo`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) {
    return `${years} yr`;
  }
  return `${years} yr ${remainingMonths} mo`;
}

assert.equal(validateAnimalNameOrTag('', ''), 'Enter a name or a tag number.');
assert.equal(validateAnimalNameOrTag('Daisy', ''), null);
assert.equal(validateAnimalNameOrTag('', 'A-1'), null);

const sampleAnimal = {
  name: 'Daisy',
  tagNumber: 'A-101',
  officialId: 'USDA-9',
  registrationNumber: 'D-123',
  tattoo: 'L1 / R2',
};

assert.equal(animalMatchesSearch(sampleAnimal, 'daisy'), true);
assert.equal(animalMatchesSearch(sampleAnimal, 'r2'), true);
assert.equal(animalMatchesSearch(sampleAnimal, 'missing'), false);
assert.equal(formatLivestockRowTitle(sampleAnimal), '#A-101 · Daisy');
assert.equal(parseHerdStatusFilter('all'), 'all');
assert.equal(parseHerdStatusFilter(undefined), 'active');
assert.match(formatAnimalAge('2024-01-15', '2025-03-15'), /yr|mo/);

console.log('assert-phase7: ok');
