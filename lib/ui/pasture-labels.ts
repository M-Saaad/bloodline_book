import type { ForageType, PastureStatus } from '@/lib/types/land';

export function formatPastureStatus(status: PastureStatus): string {
  switch (status) {
    case 'grazing':
      return 'grazing';
    case 'resting':
      return 'resting';
    case 'hay':
      return 'hay';
    case 'overgrazed':
      return 'overgrazed';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function pastureStatusTone(
  status: PastureStatus,
): 'default' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'grazing':
      return 'success';
    case 'resting':
      return 'default';
    case 'hay':
      return 'warning';
    case 'overgrazed':
      return 'danger';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function formatForageType(type: ForageType): string {
  switch (type) {
    case 'mixed':
      return 'mixed';
    case 'bermuda':
      return 'bermuda';
    case 'clover':
      return 'clover';
    case 'browse':
      return 'browse';
    case 'hayfield':
      return 'hayfield';
    case 'other':
      return 'other';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
