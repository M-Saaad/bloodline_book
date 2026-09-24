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
