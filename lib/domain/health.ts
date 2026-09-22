import { addDaysToIso } from '@/lib/dates';
import type { HealthRecordKind } from '@/lib/types/health';

export function needsFamachaFollowUp(famachaScore: number): boolean {
  return famachaScore >= 4;
}

export function withdrawalClearDate(
  recordDate: string,
  withdrawalDays: number,
): string | null {
  if (withdrawalDays <= 0) {
    return null;
  }
  return addDaysToIso(recordDate, withdrawalDays);
}

export function healthKindSupportsWithdrawal(kind: HealthRecordKind): boolean {
  switch (kind) {
    case 'vaccination':
    case 'deworming':
    case 'treatment':
      return true;
    case 'famacha':
    case 'injury':
    case 'hoof_trim':
    case 'other':
      return false;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function famachaFollowUpTaskTitle(animalLabel: string): string {
  return `Recheck FAMACHA — ${animalLabel}`;
}

export function withdrawalTaskTitle(
  animalLabel: string,
  productName: string | null,
): string {
  const product = productName?.trim() ? productName.trim() : 'treatment';
  return `Meat/milk withdrawal clear — ${animalLabel} (${product})`;
}
