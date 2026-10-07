import type { Farm } from '@/lib/types/tenancy';

export function formatFarmOperationType(segment: Farm['segment']): string {
  switch (segment) {
    case 'dairy':
      return 'Dairy goats';
    case 'meat':
      return 'Meat goats';
    case 'both':
      return 'Dairy and meat goats';
    default: {
      const _exhaustive: never = segment;
      return _exhaustive;
    }
  }
}
