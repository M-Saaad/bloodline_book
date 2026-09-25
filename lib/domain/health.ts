import { addDaysToIso, formatMonthDay } from '@/lib/dates';
import type { HealthRecordKind, TreatmentRoute } from '@/lib/types/health';

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

export const DEFAULT_FAMACHA_RECHECK_DAYS = 14;
export const FAMACHA_SCORE_3_HINT =
  'Consider deworming 3s that are kids, pregnant or nursing does, or thin.';
export const WITHDRAWAL_VET_HINT =
  'Goat withdrawal times usually come from your vet — most goat drug use is extra-label.';

export function showsMilkWithdrawal(
  segment: 'dairy' | 'meat' | 'both',
): boolean {
  return segment === 'dairy' || segment === 'both';
}

export function productLabel(productName: string | null): string {
  return productName?.trim() ? productName.trim() : 'treatment';
}

export function meatWithdrawalTaskTitle(
  animalLabel: string,
  productName: string | null,
): string {
  return `Meat withdrawal clears — ${animalLabel} (${productLabel(productName)})`;
}

export function milkWithdrawalTaskTitle(
  animalLabel: string,
  productName: string | null,
): string {
  return `Milk withdrawal clears — ${animalLabel} (${productLabel(productName)})`;
}

export function dewormTaskTitle(animalLabel: string, score: number): string {
  return `Deworm — ${animalLabel} (FAMACHA ${score})`;
}

/** Replace a stored "Animal" placeholder with the goat's name. */
export function taskTitleWithGoatName(
  title: string,
  goatName: string | null | undefined,
): string {
  const name = goatName?.trim();
  if (!name) {
    return title;
  }
  return title.replace(/ — Animal(?= \(|$)/g, ` — ${name}`);
}

export function withdrawalBadgeLabel(
  kind: 'meat' | 'milk',
  clearDate: string,
): string {
  const label = kind === 'meat' ? 'Meat' : 'Milk';
  return `${label} withdrawal until ${formatMonthDay(clearDate)}`;
}

export function meatSaleWarning(
  animalName: string,
  clearDate: string,
  productName: string | null,
): string {
  const product = productName?.trim() ? ` (${productName.trim()})` : '';
  return `${animalName} is in meat withdrawal until ${formatMonthDay(clearDate)}${product}. Continue?`;
}

export type WithdrawalSource = {
  animalId: string;
  date: string;
  productName: string | null;
  meatDays: number | null;
  milkDays: number | null;
  legacyDays?: number | null;
};

export type WithdrawalBadge = {
  kind: 'meat' | 'milk';
  clearDate: string;
  productName: string | null;
};

function positiveDays(days: number | null | undefined): number | null {
  if (days == null || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  return days;
}

export function withdrawalDaysForRecord(record: WithdrawalSource): {
  meat: number | null;
  milk: number | null;
} {
  const meat = positiveDays(record.meatDays);
  const milk = positiveDays(record.milkDays);
  if (meat != null || milk != null) {
    return { meat, milk };
  }
  const legacy = positiveDays(record.legacyDays);
  return { meat: legacy, milk: legacy };
}

export function activeWithdrawalsByAnimal(
  records: WithdrawalSource[],
  today: string,
): Map<string, { meat?: WithdrawalBadge; milk?: WithdrawalBadge }> {
  const result = new Map<
    string,
    { meat?: WithdrawalBadge; milk?: WithdrawalBadge }
  >();

  for (const record of records) {
    const days = withdrawalDaysForRecord(record);
    const current = result.get(record.animalId) ?? {};
    const meatClear =
      days.meat != null ? withdrawalClearDate(record.date, days.meat) : null;
    const milkClear =
      days.milk != null ? withdrawalClearDate(record.date, days.milk) : null;

    if (meatClear && meatClear > today) {
      if (!current.meat || meatClear > current.meat.clearDate) {
        current.meat = {
          kind: 'meat',
          clearDate: meatClear,
          productName: record.productName,
        };
      }
    }
    if (milkClear && milkClear > today) {
      if (!current.milk || milkClear > current.milk.clearDate) {
        current.milk = {
          kind: 'milk',
          clearDate: milkClear,
          productName: record.productName,
        };
      }
    }
    if (current.meat || current.milk) {
      result.set(record.animalId, current);
    }
  }

  return result;
}

export type FamachaScoreRow = {
  animalId: string;
  date: string;
  score: number;
};

export function famachaHerdFlag(
  scores: FamachaScoreRow[],
  today: string,
): { high: number; scored: number } | null {
  const start = addDaysToIso(today, -14);
  if (!start) {
    return null;
  }

  const latest = new Map<string, { date: string; score: number }>();
  for (const row of scores) {
    if (row.date < start || row.date > today || row.score < 1) {
      continue;
    }
    const current = latest.get(row.animalId);
    if (!current || row.date >= current.date) {
      latest.set(row.animalId, { date: row.date, score: row.score });
    }
  }

  const scored = latest.size;
  if (scored === 0) {
    return null;
  }
  let high = 0;
  for (const row of latest.values()) {
    if (row.score >= 4) {
      high += 1;
    }
  }
  if (high / scored <= 0.1) {
    return null;
  }
  return { high, scored };
}

export function famachaHerdFlagMessage(high: number, scored: number): string {
  return `${high} of ${scored} goats scored 4–5 in the last 2 weeks — recheck weekly.`;
}

export type RememberedProduct = {
  productName: string;
  dosage: string | null;
  route: TreatmentRoute | null;
  meatDays: number | null;
  milkDays: number | null;
};

export function rememberedProducts(
  rows: {
    productName: string | null;
    dosage: string | null;
    route: TreatmentRoute | null;
    meatDays: number | null;
    milkDays: number | null;
    legacyDays?: number | null;
    date: string;
  }[],
): RememberedProduct[] {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const products: RememberedProduct[] = [];

  for (const row of sorted) {
    const name = row.productName?.trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const split =
      row.meatDays != null || row.milkDays != null
        ? { meat: row.meatDays, milk: row.milkDays }
        : { meat: row.legacyDays ?? null, milk: row.legacyDays ?? null };
    products.push({
      productName: name,
      dosage: row.dosage,
      route: row.route,
      meatDays: split.meat,
      milkDays: split.milk,
    });
  }

  return products;
}
