import type { Animal } from '@/lib/types/animals';

export function formatLifecycleStage(stage: Animal['lifecycleStage']): string {
  return stage.replace(/_/g, ' ');
}

export function formatAnimalStatus(status: Animal['status']): string {
  switch (status) {
    case 'died':
      return 'deceased';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function statusBadgeTone(
  status: Animal['status'],
): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'sold':
      return 'warning';
    case 'died':
    case 'slaughtered':
      return 'danger';
    case 'transferred':
      return 'default';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
