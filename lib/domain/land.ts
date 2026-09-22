import type { PastureStatus } from '@/lib/types/land';

export function isGrazingRangeValid(
  startDate: string,
  endDate: string | null,
): boolean {
  if (!endDate) {
    return true;
  }
  return endDate >= startDate;
}

export function pastureStatusAfterMoveIn(
  current: PastureStatus,
): PastureStatus {
  switch (current) {
    case 'resting':
      return 'grazing';
    case 'grazing':
    case 'hay':
    case 'overgrazed':
      return current;
    default: {
      const _exhaustive: never = current;
      return _exhaustive;
    }
  }
}

export function pastureStatusAfterLastMoveOut(
  current: PastureStatus,
): PastureStatus {
  switch (current) {
    case 'grazing':
      return 'resting';
    case 'resting':
    case 'hay':
    case 'overgrazed':
      return current;
    default: {
      const _exhaustive: never = current;
      return _exhaustive;
    }
  }
}
