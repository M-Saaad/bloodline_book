import {
  addDaysToIso,
  formatMonthDay,
  GOAT_GESTATION_DAYS,
  parseIsoDate,
} from '@/lib/dates';
import type { BreedingStatus } from '@/lib/types/breeding';

export const DEFAULT_GESTATION_DAYS = GOAT_GESTATION_DAYS;
export const DUE_WINDOW_MARGIN_DAYS = 5;

export const BREEDING_STATUSES_OPEN_FOR_KIDDING: readonly BreedingStatus[] = [
  'bred',
  'confirmed',
];

export const CALENDAR_BREEDING_STATUSES: readonly BreedingStatus[] = [
  'bred',
  'confirmed',
];

export function isBreedingOpenForKidding(status: BreedingStatus): boolean {
  return BREEDING_STATUSES_OPEN_FOR_KIDDING.includes(status);
}

export function expectedKiddingTaskTitle(animalLabel: string): string {
  return `Expected kidding — ${animalLabel}`;
}

export function kidAnimalDefaultName(
  damLabel: string,
  index: number,
  kidDate?: string | null,
): string {
  const year =
    kidDate && /^\d{4}/.test(kidDate) ? kidDate.slice(2, 4) : '';
  if (year) {
    return `${damLabel} ${year} kid ${index}`;
  }
  return `${damLabel} kid ${index}`;
}

export function gestationOrDefault(days: number | null | undefined): number {
  if (days == null || !Number.isFinite(days) || days <= 0) {
    return DEFAULT_GESTATION_DAYS;
  }
  return Math.round(days);
}

export type DueWindow = {
  dueDate: string;
  windowStart: string;
  windowEnd: string;
};

export function dueWindowForHandBred(
  bredDate: string,
  gestationDays: number,
): DueWindow | null {
  const gestation = gestationOrDefault(gestationDays);
  const dueDate = addDaysToIso(bredDate, gestation);
  const windowStart = addDaysToIso(
    bredDate,
    gestation - DUE_WINDOW_MARGIN_DAYS,
  );
  const windowEnd = addDaysToIso(bredDate, gestation + DUE_WINDOW_MARGIN_DAYS);
  if (!dueDate || !windowStart || !windowEnd) {
    return null;
  }
  return { dueDate, windowStart, windowEnd };
}

export function dueWindowForExposure(
  startDate: string,
  endDate: string,
  gestationDays: number,
): DueWindow | null {
  if (endDate < startDate) {
    return null;
  }
  const gestation = gestationOrDefault(gestationDays);
  const dueDate = addDaysToIso(startDate, gestation);
  const windowStart = addDaysToIso(
    startDate,
    gestation - DUE_WINDOW_MARGIN_DAYS,
  );
  const windowEnd = addDaysToIso(endDate, gestation + DUE_WINDOW_MARGIN_DAYS);
  if (!dueDate || !windowStart || !windowEnd) {
    return null;
  }
  return { dueDate, windowStart, windowEnd };
}

export function computeBreedingWindow(input: {
  bredDate: string;
  exposureEndDate?: string | null;
  gestationDays: number;
}): DueWindow | null {
  if (input.exposureEndDate) {
    return dueWindowForExposure(
      input.bredDate,
      input.exposureEndDate,
      input.gestationDays,
    );
  }
  return dueWindowForHandBred(input.bredDate, input.gestationDays);
}

export function resolveBreedingWindow(
  event: {
    bredDate: string;
    dueDate: string | null;
    dueWindowStart: string | null;
    dueWindowEnd: string | null;
    exposureEndDate: string | null;
  },
  gestationDays: number,
): DueWindow | null {
  if (event.dueWindowStart && event.dueWindowEnd) {
    const dueDate =
      event.dueDate ??
      addDaysToIso(event.bredDate, gestationOrDefault(gestationDays));
    if (!dueDate) {
      return null;
    }
    return {
      dueDate,
      windowStart: event.dueWindowStart,
      windowEnd: event.dueWindowEnd,
    };
  }
  return computeBreedingWindow({
    bredDate: event.bredDate,
    exposureEndDate: event.exposureEndDate,
    gestationDays,
  });
}

export function formatDueWindowPhrase(start: string, end: string): string {
  return `Due between ${formatMonthDay(start)} and ${formatMonthDay(end)}`;
}

export function formatWindowCompact(start: string, end: string): string {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  if (!startDate || !endDate) {
    return `${formatMonthDay(start)}–${formatMonthDay(end)}`;
  }
  if (
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()
  ) {
    return `${formatMonthDay(start)}–${endDate.getDate()}`;
  }
  return `${formatMonthDay(start)}–${formatMonthDay(end)}`;
}

export function kiddingDueTaskTitle(
  doeLabel: string,
  windowStart: string,
  windowEnd: string,
): string {
  return `Kidding due — ${doeLabel} (${formatWindowCompact(windowStart, windowEnd)})`;
}

export function isCalendarBreeding(status: BreedingStatus): boolean {
  return CALENDAR_BREEDING_STATUSES.includes(status);
}

export function kiddingSoonCategory(
  windowStart: string,
  windowEnd: string,
  today: string,
): 'past_due' | 'soon' | null {
  if (windowEnd < today) {
    return 'past_due';
  }
  const horizon = addDaysToIso(today, 21);
  if (!horizon) {
    return null;
  }
  if (windowStart <= horizon && windowEnd >= today) {
    return 'soon';
  }
  return null;
}

/** How many kid animals should exist in Livestock for a registered litter. */
export function targetRegisteredKidCount(
  kidsBorn: number,
  kidsSurviving?: number,
): number {
  return kidsSurviving ?? kidsBorn;
}

export function validateKiddingCounts(
  kidsBorn: number,
  kidsSurviving?: number,
): string | null {
  if (!Number.isFinite(kidsBorn) || kidsBorn < 0) {
    return 'Enter a valid number of kids born.';
  }
  if (kidsSurviving == null) {
    return null;
  }
  if (!Number.isFinite(kidsSurviving) || kidsSurviving < 0) {
    return 'Enter a valid surviving count.';
  }
  if (kidsSurviving > kidsBorn) {
    return 'Kids surviving cannot be more than kids born.';
  }
  return null;
}
