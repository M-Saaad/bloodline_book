import type { Farm, FarmMember } from '@/lib/types/tenancy';

export function formatFarmRole(role: FarmMember['role']): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'manager':
      return 'Manager';
    case 'hand':
      return 'Hand';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

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
