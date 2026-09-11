import type { Transaction } from "../types";
import { currentMonthIso, formatDate, todayIso } from "../format";
import { lastDayOfMonth } from "../livestock/period-headcount";
import type { Animal } from "../types";
import {
  computeCategoryBreakdown,
  transactionInFilter,
  type DateRangeFilter,
} from "./category-breakdown";

export type FinanceReportMode = "month" | "custom" | "alltime";

export type MonthlyLedgerRow = {
  id: string;
  date: string;
  category: string;
  kind: Transaction["kind"];
  amount: number;
  displayAmount: number;
  notes: string | null;
};

export type MonthlyCategoryReport = {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
  periodLabel: string;
  byCategory: Record<string, number>;
  investedByCategory: Record<string, number>;
  receivedByCategory: Record<string, number>;
  transfersByCategory: Record<string, number>;
  total: number;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
  transactionCount: number;
  ledgerRows: MonthlyLedgerRow[];
};

const monthLabelFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function parseIsoDate(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim().slice(0, 10));
  if (!match) return null;
  const [, year, month, day] = match;
  const monthNum = Number(month);
  const dayNum = Number(day);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  const parsed = new Date(Number(year), monthNum - 1, dayNum);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${year}-${month}-${day}`;
}

function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

function orderedRange(from: string, to: string): { from: string; to: string } {
  return from <= to ? { from, to } : { from: to, to: from };
}

function normalizeServiceMonth(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed.slice(0, 7);
  throw new Error(`Invalid month: ${value}`);
}

function formatServiceMonth(month: string): string {
  const normalized = normalizeServiceMonth(month);
  const [year, m] = normalized.split("-");
  const label = monthLabelFormatter.format(new Date(Number(year), Number(m) - 1, 1));
  return label;
}

/** Transactions dated in the given month (YYYY-MM). */
export function transactionsDatedInMonth(
  transactions: Transaction[],
  month: string
): Transaction[] {
  const ym = parseFinanceMonth(month);
  return transactions.filter((tx) => tx.date?.startsWith(ym));
}

function displayAmount(tx: Transaction): number {
  return Math.abs(tx.amount);
}

export function parseFinanceMonth(value: string | undefined): string {
  if (!value?.trim()) return currentMonthIso();
  try {
    return normalizeServiceMonth(value);
  } catch {
    return currentMonthIso();
  }
}

export function earliestFarmDate(animals: Animal[], transactions: Transaction[]): string {
  let earliest = todayIso();
  for (const animal of animals) {
    const date = animal.date_of_purchase?.trim().slice(0, 10);
    if (date && date < earliest) earliest = date;
  }
  for (const tx of transactions) {
    const date = tx.date?.trim().slice(0, 10);
    if (date && date < earliest) earliest = date;
  }
  return earliest;
}

export function parseFinanceReport(searchParams: {
  month?: string;
  from?: string;
  to?: string;
  range?: string;
}): {
  mode: FinanceReportMode;
  month: string;
  from?: string;
  to?: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  filter?: DateRangeFilter;
} {
  if (searchParams.range === "alltime") {
    const today = todayIso();
    return {
      mode: "alltime",
      month: parseFinanceMonth(searchParams.month),
      periodStart: today,
      periodEnd: today,
      periodLabel: "All time",
      filter: undefined,
    };
  }

  if (searchParams.range === "custom") {
    const month = parseFinanceMonth(searchParams.month);
    const defaultFrom = firstDayOfMonth(month);
    const defaultTo = todayIso();
    const fromRaw = parseIsoDate(searchParams.from) ?? defaultFrom;
    const toRaw = parseIsoDate(searchParams.to) ?? defaultTo;
    const { from, to } = orderedRange(fromRaw, toRaw);
    return {
      mode: "custom",
      month: from.slice(0, 7),
      from,
      to,
      periodStart: from,
      periodEnd: to,
      periodLabel: `${formatDate(from)} – ${formatDate(to)}`,
      filter: { from, to },
    };
  }

  const month = parseFinanceMonth(searchParams.month);
  const periodStart = firstDayOfMonth(month);
  const periodEnd = lastDayOfMonth(month);
  return {
    mode: "month",
    month,
    from: periodStart,
    to: periodEnd,
    periodStart,
    periodEnd,
    periodLabel: formatServiceMonth(month),
    filter: { month },
  };
}

export function computeMonthlyCategoryReport(input: {
  transactions: Transaction[];
  month?: string;
  from?: string;
  to?: string;
  mode?: FinanceReportMode;
  periodLabel?: string;
}): MonthlyCategoryReport {
  const filter: DateRangeFilter | undefined =
    input.mode === "alltime"
      ? undefined
      : input.from && input.to
        ? { from: input.from, to: input.to }
        : { month: parseFinanceMonth(input.month) };

  const mode: FinanceReportMode =
    input.mode ?? (input.from && input.to ? "custom" : "month");
  const month =
    filter?.month ?? (input.from ? input.from.slice(0, 7) : parseFinanceMonth(input.month));
  const from = filter?.from ?? input.from;
  const to = filter?.to ?? input.to;
  const periodLabel =
    input.periodLabel ??
    (mode === "alltime"
      ? "All time"
      : mode === "custom" && from && to
        ? `${formatDate(from)} – ${formatDate(to)}`
        : formatServiceMonth(month));

  const breakdown = computeCategoryBreakdown({
    transactions: input.transactions,
    month: filter?.month,
    from: filter?.from,
    to: filter?.to,
  });

  const byCategory: Record<string, number> = {};
  let transactionCount = 0;

  for (const tx of input.transactions) {
    if (filter && !transactionInFilter(tx.date, filter)) continue;
    const amount = displayAmount(tx);
    byCategory[tx.category] = (byCategory[tx.category] || 0) + amount;
    transactionCount++;
  }

  const ledgerRows = input.transactions
    .filter((tx) => !filter || transactionInFilter(tx.date, filter))
    .map((tx) => ({
      id: tx.id,
      date: tx.date,
      category: tx.category,
      kind: tx.kind,
      amount: tx.amount,
      displayAmount: displayAmount(tx),
      notes: tx.notes,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = Object.values(byCategory).reduce((sum, n) => sum + (n || 0), 0);

  return {
    mode,
    month,
    from,
    to,
    periodLabel,
    byCategory,
    investedByCategory: breakdown.investedByCategory,
    receivedByCategory: breakdown.receivedByCategory,
    transfersByCategory: breakdown.transfersByCategory,
    total,
    totalInvested: breakdown.totalInvested,
    totalReceived: breakdown.totalReceived,
    totalTransfers: breakdown.totalTransfers,
    transactionCount,
    ledgerRows,
  };
}
