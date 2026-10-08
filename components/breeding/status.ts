import type { BreedingStatus } from '@/lib/types/breeding';

export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/** Symbol, word and color come from Badge. Lost is black with a warning symbol. */
export function breedingStatusTone(status: BreedingStatus): BadgeTone {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'kidded':
      return 'info';
    case 'lost':
      return 'danger';
    default:
      return 'default';
  }
}
