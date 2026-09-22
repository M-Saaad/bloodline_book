import type { HealthRecordKind } from '@/lib/types/health';

export function formatHealthRecordKind(kind: HealthRecordKind): string {
  switch (kind) {
    case 'vaccination':
      return 'Vaccination';
    case 'famacha':
      return 'FAMACHA';
    case 'deworming':
      return 'Deworming';
    case 'treatment':
      return 'Treatment';
    case 'injury':
      return 'Injury';
    case 'hoof_trim':
      return 'Hoof trim';
    case 'other':
      return 'Other';
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
