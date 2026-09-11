import Link from "next/link";
import { formatDate, formatPkr } from "@/lib/format";
import type { MonthlyCategoryReport } from "@/lib/transactions/monthly-report";

export const FINANCE_TRANSACTION_PREVIEW_LIMIT = 12;

export function FinanceMonthlyTransactions({
  report,
  viewAllHref,
}: {
  report: MonthlyCategoryReport;
  viewAllHref: string;
}) {
  const periodLabel = report.periodLabel;
  const previewRows = [...report.ledgerRows].sort((a, b) => b.date.localeCompare(a.date));
  const totalCount = previewRows.length;

  if (totalCount === 0) {
    return (
      <p className="mt-3 text-sm text-stone-500">
        No transactions in {periodLabel}.
      </p>
    );
  }

  const shown = previewRows.slice(0, FINANCE_TRANSACTION_PREVIEW_LIMIT);
  const hiddenCount = totalCount - shown.length;

  return (
    <div className="mt-4 border-t border-stone-100 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">
          Included in period ({totalCount})
        </h3>
        {hiddenCount > 0 && (
          <Link href={viewAllHref} className="text-sm font-semibold text-emerald-700">
            View all →
          </Link>
        )}
      </div>
      <ul className="divide-y divide-stone-100 text-sm">
        {shown.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-medium text-stone-800">{row.category}</p>
              <p className="text-xs text-stone-500">
                {formatDate(row.date)} · {row.kind === "cost" ? "cost" : "income"}
              </p>
              {row.notes && <p className="text-xs text-stone-500 line-clamp-2">{row.notes}</p>}
            </div>
            <p
              className={`shrink-0 font-semibold ${
                row.kind === "cost" ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {formatPkr(row.displayAmount)}
            </p>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="mt-2 text-xs text-stone-500">
          Showing {shown.length} of {totalCount}.{" "}
          <Link href={viewAllHref} className="font-semibold text-emerald-700">
            View all
          </Link>
        </p>
      )}
    </div>
  );
}
