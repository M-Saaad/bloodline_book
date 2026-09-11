import type { LedgerCategory, Transaction } from "../types";

export type DateRangeFilter = {
  month?: string;
  from?: string;
  to?: string;
};

export function transactionInFilter(
  date: string | null | undefined,
  filter?: DateRangeFilter
): boolean {
  if (!filter) return true;
  if (!date?.trim()) return false;
  const iso = date.trim().slice(0, 10);
  if (filter.month) return iso.startsWith(filter.month);
  if (filter.from && filter.to) return iso >= filter.from && iso <= filter.to;
  return true;
}

export const INVESTED_CATEGORY_ORDER: LedgerCategory[] = [
  "Feed",
  "Delivery",
  "Vet/Medicine",
  "Labor",
  "Infrastructure",
  "Livestock Purchase",
  "Other",
];

export const RECEIVED_CATEGORY_ORDER: LedgerCategory[] = ["Livestock Sale"];

export type CategoryBreakdown = {
  investedByCategory: Record<string, number>;
  receivedByCategory: Record<string, number>;
  transfersByCategory: Record<string, number>;
  totalInvested: number;
  totalReceived: number;
  totalTransfers: number;
};

export function computeCategoryBreakdown(input: {
  transactions: Transaction[];
  month?: string;
  from?: string;
  to?: string;
}): CategoryBreakdown {
  const filter: DateRangeFilter | undefined = input.from && input.to
    ? { from: input.from, to: input.to }
    : input.month
      ? { month: input.month }
      : undefined;
  const investedByCategory: Record<string, number> = {};
  const receivedByCategory: Record<string, number> = {};
  const transfersByCategory: Record<string, number> = {};
  let totalInvested = 0;
  let totalReceived = 0;
  const totalTransfers = 0;

  for (const tx of input.transactions) {
    if (!transactionInFilter(tx.date, filter)) continue;

    if (tx.kind === "cost") {
      investedByCategory[tx.category] = (investedByCategory[tx.category] || 0) + tx.amount;
      totalInvested += tx.amount;
    } else if (tx.kind === "income") {
      receivedByCategory[tx.category] = (receivedByCategory[tx.category] || 0) + tx.amount;
      totalReceived += tx.amount;
    }
  }

  return {
    investedByCategory,
    receivedByCategory,
    transfersByCategory,
    totalInvested,
    totalReceived,
    totalTransfers,
  };
}
