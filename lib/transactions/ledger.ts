/**
 * Single-owner farm ledger helpers (no partner equity splits).
 */
import type { CategoryName, Transaction, TransactionKind } from "../types";

export function createCostTransaction(input: {
  date: string;
  amount: number;
  category: CategoryName;
  animalId?: number | null;
  vendorId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  purchaseAgreementId?: string | null;
  livestockSaleId?: string | null;
}): Transaction {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    amount: input.amount,
    kind: "cost",
    category: input.category,
    animal_id: input.animalId ?? null,
    vendor_id: input.vendorId ?? null,
    customer_id: input.customerId ?? null,
    notes: input.notes ?? null,
    source_row: null,
    purchase_agreement_id: input.purchaseAgreementId ?? null,
    livestock_sale_id: input.livestockSaleId ?? null,
  };
}

export function createIncomeTransaction(input: {
  date: string;
  amount: number;
  category: CategoryName;
  animalId?: number | null;
  customerId?: string | null;
  notes?: string | null;
  livestockSaleId?: string | null;
}): Transaction {
  return {
    id: crypto.randomUUID(),
    date: input.date,
    amount: input.amount,
    kind: "income",
    category: input.category,
    animal_id: input.animalId ?? null,
    customer_id: input.customerId ?? null,
    vendor_id: null,
    notes: input.notes ?? null,
    source_row: null,
    purchase_agreement_id: null,
    livestock_sale_id: input.livestockSaleId ?? null,
  };
}

export function isLedgerTransaction(tx: Transaction): boolean {
  return tx.kind === "cost" || tx.kind === "income";
}
