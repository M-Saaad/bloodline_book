import { parseIsoDate } from '@/lib/dates';
import { animalMatchesSearch } from '@/lib/domain/animals';
import type { Animal } from '@/lib/types/animals';
import { formatRegistrationBody, formatSex } from '@/lib/ui/animal-labels';

export const UNKNOWN_PARENT_LABEL = 'Unknown';

export const BREEDING_AGE_MONTHS = 7;

export type OutsideAnimal = {
  id: string;
  name: string;
  sex: Animal['sex'];
  registrationBody: Animal['registrationBody'];
  registrationNumber: string | null;
  breedName: string | null;
};

export type PickerBlock = {
  id: string;
  reason: string;
};

export type PickerSection = 'recent' | 'suggested' | 'on_farm' | 'former';

export type PickerRow =
  | { kind: 'header'; id: string; title: string }
  | { kind: 'animal'; animal: Animal; section: PickerSection }
  | { kind: 'excluded'; animal: Animal; reason: string }
  | { kind: 'outside'; outside: OutsideAnimal };

const SECTION_TITLES: Record<PickerSection, string> = {
  recent: 'Recent',
  suggested: 'Suggested',
  on_farm: 'On farm now',
  former: 'No longer on farm',
};

export function formatOutsideAnimalLabel(
  animal: Pick<OutsideAnimal, 'name' | 'registrationBody' | 'registrationNumber'>,
): string {
  const name = animal.name.trim();
  const body = formatRegistrationBody(animal.registrationBody);
  const number = animal.registrationNumber?.trim();
  if (body && number) {
    return `${name} · ${body} ${number}`;
  }
  if (number) {
    return `${name} · ${number}`;
  }
  return name;
}

export function ageInMonths(
  dateOfBirth: string,
  todayIso: string,
): number | null {
  const birth = parseIsoDate(dateOfBirth);
  const today = parseIsoDate(todayIso);
  if (!birth || !today) {
    return null;
  }

  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    return null;
  }
  return months;
}

export function isBreedingAgeDoe(
  animal: Pick<Animal, 'sex' | 'dateOfBirth' | 'lifecycleStage'>,
  todayIso: string,
): boolean {
  if (animal.sex !== 'female') {
    return false;
  }
  if (!animal.dateOfBirth) {
    return (
      animal.lifecycleStage === 'breeding' ||
      animal.lifecycleStage === 'adult' ||
      animal.lifecycleStage === 'yearling'
    );
  }
  const months = ageInMonths(animal.dateOfBirth, todayIso);
  if (months == null) {
    return false;
  }
  return months >= BREEDING_AGE_MONTHS;
}

export function compareHerdOrder(a: Animal, b: Animal): number {
  const tagCompare = compareTag(a.tagNumber, b.tagNumber);
  if (tagCompare !== 0) {
    return tagCompare;
  }
  const nameCompare = (a.name ?? '').localeCompare(b.name ?? '', undefined, {
    sensitivity: 'base',
  });
  if (nameCompare !== 0) {
    return nameCompare;
  }
  return a.id.localeCompare(b.id);
}

function compareTag(left: string | null, right: string | null): number {
  const a = left?.trim() ?? '';
  const b = right?.trim() ?? '';
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function searchRank(
  animal: Pick<Animal, 'tagNumber'>,
  query: string,
): number {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return 1;
  }
  const tag = animal.tagNumber?.trim().toLowerCase() ?? '';
  if (tag === normalized) {
    return 0;
  }
  if (/^\d+$/.test(normalized) && tag.startsWith(normalized)) {
    return 1;
  }
  return 2;
}

export function compareForQuery(a: Animal, b: Animal, query: string): number {
  const rank = searchRank(a, query) - searchRank(b, query);
  if (rank !== 0) {
    return rank;
  }
  return compareHerdOrder(a, b);
}

export function pedigreeBlockers(
  subjectId: string,
  herd: Pick<Animal, 'id' | 'damId' | 'sireId'>[],
): PickerBlock[] {
  const byId = new Map(herd.map((animal) => [animal.id, animal]));
  const reasons = new Map<string, string>();
  reasons.set(subjectId, "Can't be their own parent");

  const ancestors = new Set<string>();
  const up = [subjectId];
  while (up.length > 0) {
    const current = up.pop();
    if (!current) {
      continue;
    }
    const animal = byId.get(current);
    if (!animal) {
      continue;
    }
    for (const parentId of [animal.damId, animal.sireId]) {
      if (!parentId || ancestors.has(parentId)) {
        continue;
      }
      ancestors.add(parentId);
      reasons.set(parentId, 'Already an ancestor');
      up.push(parentId);
    }
  }

  for (const animal of herd) {
    if (animal.id === subjectId || reasons.has(animal.id)) {
      continue;
    }
    if (isDescendantOf(animal.id, subjectId, byId)) {
      reasons.set(animal.id, 'Already a descendant');
    }
  }

  return [...reasons.entries()].map(([id, reason]) => ({ id, reason }));
}

function isDescendantOf(
  animalId: string,
  ancestorId: string,
  byId: Map<string, Pick<Animal, 'id' | 'damId' | 'sireId'>>,
): boolean {
  const seen = new Set<string>();
  const stack = [animalId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    const animal = byId.get(current);
    if (!animal) {
      continue;
    }
    for (const parentId of [animal.damId, animal.sireId]) {
      if (!parentId) {
        continue;
      }
      if (parentId === ancestorId) {
        return true;
      }
      stack.push(parentId);
    }
  }
  return false;
}

export function buildPickerRows(input: {
  animals: Animal[];
  outsideAnimals: OutsideAnimal[];
  query: string;
  recentIds: string[];
  suggestedIds: string[];
  chip: ((animal: Animal) => boolean) | null;
  exclude: PickerBlock[];
  disabled: PickerBlock[];
  includeOutside: boolean;
}): PickerRow[] {
  const query = input.query.trim();
  const chip = input.chip ?? (() => true);
  const excludeIds = new Set(input.exclude.map((item) => item.id));
  const disabledIds = new Set(input.disabled.map((item) => item.id));
  const reasonById = new Map<string, string>();
  for (const item of [...input.disabled, ...input.exclude]) {
    reasonById.set(item.id, item.reason);
  }

  const eligible = input.animals.filter(
    (animal) =>
      !excludeIds.has(animal.id) &&
      !disabledIds.has(animal.id) &&
      chip(animal) &&
      animalMatchesSearch(animal, query),
  );
  const eligibleById = new Map(eligible.map((animal) => [animal.id, animal]));
  const used = new Set<string>();
  const rows: PickerRow[] = [];

  const recentRows: PickerRow[] = [];
  for (const recentId of input.recentIds) {
    if (recentId.startsWith('outside:')) {
      continue;
    }
    const animal = eligibleById.get(recentId);
    if (!animal || used.has(animal.id)) {
      continue;
    }
    used.add(animal.id);
    recentRows.push({ kind: 'animal', animal, section: 'recent' });
  }

  const outsideMatches = input.includeOutside
    ? input.outsideAnimals.filter((animal) => outsideMatchesQuery(animal, query))
    : [];
  const outsideByRecentId = new Map(
    outsideMatches.map((animal) => [`outside:${animal.id}`, animal]),
  );
  const recentOutsideIds = new Set<string>();
  for (const recentId of input.recentIds) {
    const outside = outsideByRecentId.get(recentId);
    if (!outside) {
      continue;
    }
    recentOutsideIds.add(outside.id);
    recentRows.push({ kind: 'outside', outside });
  }

  if (recentRows.length > 0) {
    rows.push({ kind: 'header', id: 'header-recent', title: SECTION_TITLES.recent });
    rows.push(...recentRows);
  }

  const suggested = input.suggestedIds
    .map((id) => eligibleById.get(id))
    .filter((animal): animal is Animal => animal != null && !used.has(animal.id));
  pushAnimals(rows, used, 'suggested', suggested, query);

  pushAnimals(
    rows,
    used,
    'on_farm',
    eligible.filter((animal) => animal.status === 'active' && !used.has(animal.id)),
    query,
  );
  pushAnimals(
    rows,
    used,
    'former',
    eligible.filter((animal) => animal.status !== 'active' && !used.has(animal.id)),
    query,
  );

  const remainingOutside = outsideMatches.filter(
    (animal) => !recentOutsideIds.has(animal.id),
  );
  if (remainingOutside.length > 0) {
    rows.push({
      kind: 'header',
      id: 'header-outside',
      title: 'Not in herd',
    });
    for (const outside of remainingOutside) {
      rows.push({ kind: 'outside', outside });
    }
  }

  const unavailableSeen = new Set<string>();
  const unavailable = [
    ...input.animals.filter(
      (animal) =>
        disabledIds.has(animal.id) &&
        chip(animal) &&
        animalMatchesSearch(animal, query),
    ),
    ...(query
      ? input.animals.filter(
          (animal) =>
            excludeIds.has(animal.id) && animalMatchesSearch(animal, query),
        )
      : []),
  ].filter((animal) => {
    if (unavailableSeen.has(animal.id)) {
      return false;
    }
    unavailableSeen.add(animal.id);
    return true;
  });
  if (unavailable.length > 0) {
    rows.push({
      kind: 'header',
      id: 'header-unavailable',
      title: 'Unavailable',
    });
    for (const animal of unavailable) {
      rows.push({
        kind: 'excluded',
        animal,
        reason: reasonById.get(animal.id) ?? 'Unavailable',
      });
    }
  }

  return rows;
}

function pushAnimals(
  rows: PickerRow[],
  used: Set<string>,
  section: PickerSection,
  animals: Animal[],
  query: string,
) {
  const sorted = [...animals]
    .filter((animal) => !used.has(animal.id))
    .sort((a, b) => compareForQuery(a, b, query));
  if (sorted.length === 0) {
    return;
  }
  rows.push({
    kind: 'header',
    id: `header-${section}`,
    title: SECTION_TITLES[section],
  });
  for (const animal of sorted) {
    used.add(animal.id);
    rows.push({ kind: 'animal', animal, section });
  }
}

function outsideMatchesQuery(animal: OutsideAnimal, query: string): boolean {
  if (!query) {
    return true;
  }
  const normalized = query.toLowerCase();
  const fields = [animal.name, animal.registrationNumber, animal.breedName];
  return fields.some((value) => value?.toLowerCase().includes(normalized));
}

export function visibleAnimalIds(rows: PickerRow[]): string[] {
  return rows
    .filter((row): row is Extract<PickerRow, { kind: 'animal' }> => row.kind === 'animal')
    .map((row) => row.animal.id);
}

export function herdRowSubtitle(
  animal: Animal,
  extras?: { breed?: string | null; pasture?: string | null },
): string {
  const age = animal.dateOfBirth
    ? formatAgeShort(animal.dateOfBirth)
    : null;
  const parts = [formatSex(animal.sex), extras?.breed?.trim() || null, age, extras?.pasture?.trim() || null].filter(
    (part): part is string => Boolean(part),
  );
  return parts.join(' · ');
}

function formatAgeShort(dateOfBirth: string): string | null {
  const months = ageInMonths(dateOfBirth, todayStamp());
  if (months == null) {
    return null;
  }
  if (months < 12) {
    return `${months} mo`;
  }
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) {
    return `${years} yr`;
  }
  return `${years} yr ${remaining} mo`;
}

function todayStamp(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
