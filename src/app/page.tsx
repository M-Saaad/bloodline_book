import Link from "next/link";
import { Suspense } from "react";
import { loadHomeData, loadHerdHealthData } from "@/lib/db/queries";
import { computePeriodHeadcount } from "@/lib/livestock/period-headcount";
import { todayIso } from "@/lib/format";
import { investedCategoryOrder } from "@/lib/transactions/expense-categories";
import {
  computeMonthlyCategoryReport,
  earliestFarmDate,
  parseFinanceReport,
} from "@/lib/transactions/monthly-report";
import { animalLinkFromHealth, healthTabForActionKind } from "@/lib/livestock/health-nav";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { FinanceCategoryBreakdown } from "@/components/FinanceCategoryBreakdown";
import { FinanceMonthlyTransactions } from "@/components/FinanceMonthlyTransactions";
import { FinanceReportPicker } from "@/components/FinanceReportPicker";
import { FinancePeriodHeadcount } from "@/components/FinancePeriodHeadcount";
import { QuickEntryLoader } from "@/components/QuickEntryLoader";
import { SignOutButton } from "@/components/SignOutButton";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { getWriteAccess } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string; range?: string }>;
}) {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent searchParams={searchParams} />
    </Suspense>
  );
}

function HomePageFallback() {
  return (
    <main className="px-4 pt-6">
      <div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />
      <div className="mb-4 h-32 animate-pulse rounded-xl bg-stone-200" />
      <BottomNav active="finance" />
    </main>
  );
}

function urgencyDot(urgency: "overdue" | "due_soon") {
  return (
    <span
      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgency === "overdue" ? "bg-red-500" : "bg-amber-500"}`}
    />
  );
}

async function HomePageContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; from?: string; to?: string; range?: string }>;
}) {
  const sp = await searchParams;
  const reportRange = parseFinanceReport(sp);
  const canWrite = await getWriteAccess();
  const [data, healthData] = await Promise.all([loadHomeData(), loadHerdHealthData()]);
  const { herd } = healthData;
  const { summary } = herd;

  const headcountStart =
    reportRange.mode === "alltime"
      ? earliestFarmDate(data.animals, data.transactions)
      : reportRange.periodStart;
  const headcountEnd =
    reportRange.mode === "alltime" ? todayIso() : reportRange.periodEnd;

  const periodReport = computeMonthlyCategoryReport({
    transactions: data.transactions,
    mode: reportRange.mode,
    periodLabel: reportRange.periodLabel,
    month: reportRange.mode === "month" ? reportRange.month : undefined,
    from: reportRange.mode === "custom" ? reportRange.from : undefined,
    to: reportRange.mode === "custom" ? reportRange.to : undefined,
  });

  const headcount = computePeriodHeadcount(data.animals, headcountStart, headcountEnd);

  const viewAllHref =
    reportRange.mode === "alltime"
      ? "/transactions"
      : `/transactions?from=${headcountStart}&to=${headcountEnd}`;

  const attentionCount = herd.actions.length;

  return (
    <main className="px-4 pt-6">
      <AppHeader
        eyebrow="Farm"
        title="Today"
        subtitle={`${summary.activeCount} active goats`}
        action={isSupabaseConfigured() ? <SignOutButton /> : undefined}
      />

      {!canWrite && <ViewOnlyBanner />}

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-stone-800">What needs attention</h2>
          <Link href="/health" className="text-xs font-semibold text-emerald-700">
            Herd health →
          </Link>
        </div>
        {attentionCount === 0 ? (
          <p className="text-sm text-stone-500">No overdue or due-soon herd tasks today.</p>
        ) : (
          <ul className="space-y-2">
            {herd.actions.slice(0, 8).map((a, i) => (
              <li key={`${a.kind}-${a.animalId}-${i}`}>
                <Link
                  href={animalLinkFromHealth(a.animalId, healthTabForActionKind(a.kind))}
                  className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm ring-1 ring-stone-100"
                >
                  {urgencyDot(a.urgency)}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{a.label}</p>
                    <p className="text-stone-600">
                      {a.kind === "vaccine" && "Vaccination · "}
                      {a.kind === "deworm" && "Deworming · "}
                      {a.kind === "famacha" && "FAMACHA · "}
                      {a.kind === "withdrawal" && "Withdrawal · "}
                      {a.kind === "breeding" && "Kidding due · "}
                      {a.detail}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.urgency === "overdue"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {a.urgency === "overdue" ? "Overdue" : "Due soon"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {attentionCount > 8 && (
          <p className="mt-2 text-xs text-stone-500">
            +{attentionCount - 8} more on the{" "}
            <Link href="/health" className="font-semibold text-emerald-700">health page</Link>
          </p>
        )}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3">
        <StatCard label="Vaccine overdue" value={String(summary.overdueVaccines)} warn={summary.overdueVaccines > 0} />
        <StatCard label="FAMACHA overdue" value={String(summary.overdueFamacha)} warn={summary.overdueFamacha > 0} />
        <StatCard label="Deworm overdue" value={String(summary.overdueDeworm)} warn={summary.overdueDeworm > 0} />
        <StatCard label="Active withdrawals" value={String(summary.activeWithdrawals)} warn={summary.activeWithdrawals > 0} />
      </section>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        <div className="mb-3">
          <h2 className="mb-1 text-sm font-bold text-stone-800">Finance report</h2>
          <p className="mb-2 text-xs text-stone-500">{periodReport.periodLabel}</p>
          <Suspense fallback={<div className="h-8 animate-pulse rounded-lg bg-stone-100" />}>
            <FinanceReportPicker
              mode={reportRange.mode}
              month={reportRange.month}
              from={reportRange.from}
              to={reportRange.to}
            />
          </Suspense>
        </div>
        <FinancePeriodHeadcount headcount={headcount} />
        {periodReport.transactionCount === 0 ? (
          <p className="text-sm text-stone-500">No transactions in this period.</p>
        ) : (
          <>
            <FinanceCategoryBreakdown
              investedByCategory={periodReport.investedByCategory}
              receivedByCategory={periodReport.receivedByCategory}
              transfersByCategory={periodReport.transfersByCategory}
              totalInvested={periodReport.totalInvested}
              totalReceived={periodReport.totalReceived}
              totalTransfers={periodReport.totalTransfers}
              investedOrder={investedCategoryOrder(data.transactions.map((t) => t.category))}
            />
            <FinanceMonthlyTransactions report={periodReport} viewAllHref={viewAllHref} />
          </>
        )}
      </section>

      <QuickEntryLoader {...data.quickEntry} canWrite={canWrite} />
      <BottomNav active="finance" />
    </main>
  );
}

function StatCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-sm ring-1 ${
        warn ? "bg-red-50 ring-red-200" : "bg-white ring-stone-200"
      }`}
    >
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold ${warn ? "text-red-800" : ""}`}>{value}</p>
    </div>
  );
}
