import type { BreedingStatus } from '@/lib/types/breeding';

export const BREEDING_STATUSES_OPEN_FOR_KIDDING: readonly BreedingStatus[] = [
  'bred',
  'confirmed',
];

export function isBreedingOpenForKidding(status: BreedingStatus): boolean {
  return BREEDING_STATUSES_OPEN_FOR_KIDDING.includes(status);
}

export function expectedKiddingTaskTitle(animalLabel: string): string {
  return `Expected kidding — ${animalLabel}`;
}

export function kidAnimalDefaultName(
  damLabel: string,
  index: number,
): string {
  return `${damLabel} kid ${index}`;
}

/** How many kid animals should exist in Livestock for a registered litter. */
export function targetRegisteredKidCount(
  kidsBorn: number,
  kidsSurviving?: number,
): number {
  return kidsSurviving ?? kidsBorn;
}

export function validateKiddingCounts(
  kidsBorn: number,
  kidsSurviving?: number,
): string | null {
  if (!Number.isFinite(kidsBorn) || kidsBorn < 0) {
    return 'Enter a valid number of kids born.';
  }
  if (kidsSurviving == null) {
    return null;
  }
  if (!Number.isFinite(kidsSurviving) || kidsSurviving < 0) {
    return 'Enter a valid surviving count.';
  }
  if (kidsSurviving > kidsBorn) {
    return 'Kids surviving cannot be more than kids born.';
  }
  return null;
}
