import type { MilkRecord, MilkUnit } from "../types";

/** Convert entered amount to pounds for normalized storage. */
export function normalizeMilkToLb(amount: number, unit: MilkUnit): number {
  if (unit === "lb") return amount;
  if (unit === "oz") return amount / 16;
  // fl-oz treated as weight-oz for volume entries (breeder workflow)
  return amount / 16;
}

export function formatMilkAmount(lb: number, unit: MilkUnit = "lb"): string {
  if (unit === "lb") return `${lb.toFixed(2)} lb`;
  const oz = lb * 16;
  return `${oz.toFixed(1)} oz`;
}

export type LactationStats = {
  daysInMilk: number;
  totalLb: number;
  peakLb: number;
  peakDate: string | null;
  projection305: number | null;
};

export function computeLactationStats(
  records: MilkRecord[],
  fresheningDate: string,
  dryOffDate: string | null,
  today: string
): LactationStats {
  const end = dryOffDate ?? today;
  const inWindow = records.filter((r) => r.date >= fresheningDate && r.date <= end);
  const byDate = new Map<string, number>();
  for (const r of inWindow) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.amount_lb_normalized);
  }
  let peakLb = 0;
  let peakDate: string | null = null;
  let totalLb = 0;
  for (const [date, daily] of byDate) {
    totalLb += daily;
    if (daily > peakLb) {
      peakLb = daily;
      peakDate = date;
    }
  }
  const start = new Date(fresheningDate.slice(0, 10));
  const endD = new Date(end.slice(0, 10));
  const daysInMilk = Math.max(
    0,
    Math.round((endD.getTime() - start.getTime()) / 86_400_000)
  );
  const projection305 =
    daysInMilk > 0 ? Math.round((totalLb / daysInMilk) * 305) : null;
  return { daysInMilk, totalLb, peakLb, peakDate, projection305 };
}
