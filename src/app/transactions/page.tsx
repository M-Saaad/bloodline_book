import { Suspense } from "react";
import { animalLabel } from "@/lib/labels";
import { LEDGER_CATEGORIES, slugToCategory, categoryToSlug } from "@/lib/constants";
import { extraCategoryNames } from "@/lib/transactions/expense-categories";
import { loadTransactionsData, contactNameFrom } from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { ViewOnlyBanner } from "@/components/ViewOnlyBanner";
import { TransactionsFilters } from "@/components/TransactionsFilters";
import { getWriteAccess } from "@/lib/auth/roles";
import {
  TransactionEditor,
  type EditableTransaction,
} from "@/components/TransactionEditor";
import { formatDate } from "@/lib/format";
import { resolveTransactionKind } from "@/lib/transactions/mutate";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const canWrite = await getWriteAccess();
  const data = await loadTransactionsData();
  const q = (sp.q || "").toLowerCase().trim();
  const filter = sp.filter || "all";
  const fromDate = sp.from?.trim().slice(0, 10);
  const toDate = sp.to?.trim().slice(0, 10);

  let txs = [...data.transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return (b.source_row ?? 0) - (a.source_row ?? 0);
  });

  if (fromDate) {
    txs = txs.filter((t) => t.date.slice(0, 10) >= fromDate);
  }
  if (toDate) {
    txs = txs.filter((t) => t.date.slice(0, 10) <= toDate);
  }

  if (filter === "cost") {
    txs = txs.filter((t) => t.kind === "cost");
  } else if (filter === "income") {
    txs = txs.filter((t) => t.kind === "income");
  } else {
    const fromSlug = slugToCategory(filter);
    const extraNames = extraCategoryNames(data.transactions.map((t) => t.category));
    const customMatch = extraNames.find((name) => categoryToSlug(name) === filter);
    const category =
      fromSlug ||
      customMatch ||
      ((LEDGER_CATEGORIES as readonly string[]).includes(filter) ? filter : null);
    if (category) txs = txs.filter((t) => t.category === category);
  }

  if (q) {
    txs = txs.filter(
      (t) =>
        (t.notes || "").toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.date.includes(q) ||
        formatDate(t.date).toLowerCase().includes(q)
    );
  }

  const animals = data.animals
    .filter((a) => a.status === "Active")
    .map((a) => ({ id: a.id, label: animalLabel(a) }));

  const allAnimals = data.animals.map((a) => ({ id: a.id, label: animalLabel(a) }));

  const editable: EditableTransaction[] = txs.map((tx) => {
    const variant = resolveTransactionKind(tx);
    const animal = tx.animal_id != null ? data.animals.find((a) => a.id === tx.animal_id) : null;
    const sale =
      tx.livestock_sale_id != null
        ? (data.livestock_sales ?? []).find((s) => s.id === tx.livestock_sale_id)
        : undefined;

    let saleMeta: EditableTransaction["sale"] = null;
    if (variant === "livestock_sale" && sale) {
      saleMeta = {
        animalIds: sale.animal_ids,
        grossSalePrice: sale.gross_sale_price,
        deliveryCost: sale.delivery_cost,
      };
    }

    const vendor = contactNameFrom(data.contacts, tx.vendor_id);
    const customerFromTx = contactNameFrom(data.contacts, tx.customer_id);

    return {
      id: tx.id,
      date: tx.date,
      amount: tx.amount,
      kind: tx.kind,
      category: tx.category,
      variant,
      notes: tx.notes,
      animalId: tx.animal_id,
      animalLabel: animal
        ? animalLabel(animal)
        : tx.animal_id != null
          ? `goat #${tx.animal_id}`
          : null,
      vendorName: vendor !== "—" ? vendor : null,
      customerName: customerFromTx !== "—" ? customerFromTx : null,
      sale: saleMeta,
    };
  });

  return (
    <main className="px-4 pt-6">
      <AppHeader
        eyebrow="Finance"
        title={`Transactions (${txs.length})`}
        subtitle={
          fromDate && toDate
            ? `${formatDate(fromDate)} – ${formatDate(toDate)}`
            : fromDate
              ? `From ${formatDate(fromDate)}`
              : toDate
                ? `Through ${formatDate(toDate)}`
                : undefined
        }
      />

      {!canWrite && <ViewOnlyBanner />}

      <Suspense fallback={<div className="mb-4 h-16 animate-pulse rounded-xl bg-stone-200" />}>
        <TransactionsFilters extraCategoryNames={extraCategoryNames(data.transactions.map((t) => t.category))} />
      </Suspense>

      <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
        {txs.length === 0 ? (
          <p className="text-sm text-stone-500">No transactions match.</p>
        ) : (
          <TransactionEditor
            transactions={editable}
            animals={animals}
            allAnimals={allAnimals}
            vendors={data.quickEntry.vendors}
            expenseCategories={data.quickEntry.expenseCategories}
            canWrite={canWrite}
          />
        )}
      </section>

    </main>
  );
}
