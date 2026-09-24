/** Calendar date as `YYYY-MM-DD` (farm-local, no time component). */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(): string {
  return formatIsoDate(new Date());
}

export function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Approximate goat gestation (days) for breeding due-date estimates. */
export const GOAT_GESTATION_DAYS = 150;

export function addDaysToIso(iso: string, days: number): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return null;
  }
  parsed.setDate(parsed.getDate() + days);
  return formatIsoDate(parsed);
}

export function formatDisplayDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return iso;
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** US short date without a year, e.g. "Feb 14". */
export function formatMonthDay(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) {
    return iso;
  }
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
