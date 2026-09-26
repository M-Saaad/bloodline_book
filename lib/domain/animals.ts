import { parseIsoDate, todayIso } from '@/lib/dates';
import type { Animal } from '@/lib/types/animals';

export type HerdStatusFilter =
  | 'active'
  | 'sold'
  | 'died'
  | 'slaughtered'
  | 'transferred'
  | 'all';

export type HerdSexFilter = 'all' | Animal['sex'];

export type HerdLifecycleFilter = 'all' | Animal['lifecycleStage'];

export const BREED_PERCENTAGE_QUICK_PICKS = [50, 75, 88, 94, 100] as const;

export const REGISTRATION_BODY_OPTIONS: {
  value: NonNullable<Animal['registrationBody']>;
  label: string;
}[] = [
  { value: 'adga', label: 'ADGA' },
  { value: 'abga', label: 'ABGA' },
  { value: 'usbga', label: 'USBGA' },
  { value: 'other', label: 'Other' },
];

export function validateAnimalNameOrTag(
  name: string,
  tagNumber: string,
): string | null {
  if (!name.trim() && !tagNumber.trim()) {
    return 'Enter a name or a tag number.';
  }
  return null;
}

export function animalMatchesSearch(
  animal: Animal,
  query: string,
): boolean {
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

  return fields.some((value) =>
    value?.toLowerCase().includes(normalized),
  );
}

export function formatAnimalAge(
  dateOfBirth: string | null,
  referenceIso: string = todayIso(),
): string {
  if (!dateOfBirth) {
    return 'Age unknown';
  }

  const birth = parseIsoDate(dateOfBirth);
  const reference = parseIsoDate(referenceIso);
  if (!birth || !reference) {
    return 'Age unknown';
  }

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

/** How many goats a form picker paints before asking for a narrower search. */
export const ANIMAL_PICKER_WINDOW = 8;

/**
 * Keep a goat list on screen when a later query result is empty.
 * Offline reconnects can briefly emit an empty result after the herd has already loaded.
 */
export function rememberAnimals(
  previous: readonly Animal[],
  next: readonly Animal[],
): readonly Animal[] {
  if (next.length > 0) {
    return next;
  }
  return previous.length > 0 ? previous : next;
}

/**
 * Show selected goats plus a short slice of the rest, so the search field stays on screen.
 */
export function windowAnimalChoices(
  animals: readonly Animal[],
  selectedIds: readonly string[],
  limit: number = ANIMAL_PICKER_WINDOW,
): { shown: Animal[]; hiddenCount: number } {
  const selected = animals.filter((animal) => selectedIds.includes(animal.id));
  const rest = animals.filter((animal) => !selectedIds.includes(animal.id));
  const extra = Math.max(0, limit - selected.length);
  const shown = [...selected, ...rest.slice(0, extra)];
  return {
    shown,
    hiddenCount: Math.max(0, animals.length - shown.length),
  };
}

export function formatLivestockRowTitle(animal: Animal): string {
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

export function parseHerdStatusFilter(
  value: string | string[] | undefined,
): HerdStatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  switch (raw) {
    case 'active':
    case 'sold':
    case 'died':
    case 'slaughtered':
    case 'transferred':
    case 'all':
      return raw;
    default:
      return 'active';
  }
}
