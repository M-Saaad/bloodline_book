import type { BreedingStatus } from '@/lib/types/breeding';

export const BREEDING_STATUSES_OPEN_FOR_KIDDING: readonly BreedingStatus[] = [
  'bred',
  'confirmed',
  'open',
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
