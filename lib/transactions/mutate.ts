/**
 * Transaction update/delete for single-owner farm ledger.
 */
import type {
  CategoryName,
  FarmDatabase,
  LivestockSale,
  Transaction,
} from "../types";
import { computeSaleNet } from "../livestock/record-sale";
import { applyDeleteSaleReceipt, findSaleForReceipt } from "../livestock/cancel-sale";
import { agreementStatus } from "../livestock/purchase-agreement";
import { diffDb, type WritePlan } from "../db/writes";

export type TransactionEditVariant = "expense" | "livestock_purchase" | "livestock_sale";

export function resolveTransactionKind(tx: Transaction): TransactionEditVariant {
  if (tx.kind === "income" && tx.category === "Livestock Sale") return "livestock_sale";
  if (tx.kind === "cost" && tx.category === "Livestock Purchase") return "livestock_purchase";
  if (tx.kind === "cost") return "expense";
  throw new Error(`Unsupported transaction: ${tx.kind} ${tx.category}`);
}

function removeTx(db: FarmDatabase, txId: string): FarmDatabase {
  return {
    ...db,
    transactions: db.transactions.filter((t) => t.id !== txId),
  };
}

function findOrCreateContact(
  db: FarmDatabase,
  name: string,
  type: "Customer" | "Vendor"
): { db: FarmDatabase; id: string } {
  const existing = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === type
  );
  if (existing) return { db, id: existing.id };
  const contact = {
    id: crypto.randomUUID(),
    name,
    type,
    phone: null,
    notes: null,
  };
  return { db: { ...db, contacts: [...db.contacts, contact] }, id: contact.id };
}

function findSaleForTx(db: FarmDatabase, tx: Transaction): LivestockSale | undefined {
  if (tx.livestock_sale_id) {
    return (db.livestock_sales ?? []).find((s) => s.id === tx.livestock_sale_id);
  }
  return findSaleForReceipt(db, tx.id);
}

export type UpdateTransactionInput =
  | {
      id: string;
      variant: "expense";
      date: string;
      amount: number;
      category: CategoryName;
      animalId?: number | null;
      notes?: string | null;
    }
  | {
      id: string;
      variant: "livestock_purchase";
      date: string;
      amount: number;
      vendorName?: string | null;
      notes?: string | null;
    }
  | {
      id: string;
      variant: "livestock_sale";
      date: string;
      animalId: number;
      additionalAnimalIds?: number[];
      grossSalePrice: number;
      deliveryCost?: number;
      customerId?: string | null;
      notes?: string | null;
    };

export function applyUpdateTransaction(
  db: FarmDatabase,
  input: UpdateTransactionInput
): FarmDatabase {
  const tx = db.transactions.find((t) => t.id === input.id);
  if (!tx) throw new Error("Transaction not found");
  const variant = resolveTransactionKind(tx);
  if (variant !== input.variant) {
    throw new Error(`Cannot edit as ${input.variant}; transaction is ${variant}`);
  }

  switch (input.variant) {
    case "expense": {
      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: input.amount,
        category: input.category,
        animal_id: input.animalId ?? null,
        notes: input.notes || null,
      };
      return {
        ...db,
        transactions: db.transactions.map((t) => (t.id === tx.id ? updated : t)),
      };
    }

    case "livestock_purchase": {
      let next = db;
      let vendorId: string | null = tx.vendor_id;
      if (input.vendorName != null && input.vendorName.trim()) {
        const r = findOrCreateContact(next, input.vendorName.trim(), "Vendor");
        next = r.db;
        vendorId = r.id;
      } else if (input.vendorName === "") {
        vendorId = null;
      }

      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: input.amount,
        vendor_id: vendorId,
        notes: input.notes || null,
      };

      const animals = next.animals.map((a) => {
        if (tx.animal_id == null || a.id !== tx.animal_id) return a;
        return {
          ...a,
          price: input.amount,
          date_of_purchase: input.date,
          purchased_from: vendorId,
        };
      });

      return {
        ...next,
        animals,
        transactions: next.transactions.map((t) => (t.id === tx.id ? updated : t)),
      };
    }

    case "livestock_sale": {
      const deliveryCost = input.deliveryCost ?? 0;
      const netReceived = computeSaleNet(input.grossSalePrice, deliveryCost);
      if (netReceived < 0) throw new Error("Net sale amount cannot be negative");

      const animalIds = [input.animalId, ...(input.additionalAnimalIds ?? [])];
      const primary = db.animals.find((a) => a.id === input.animalId);
      if (!primary) throw new Error("Animal not found");

      const notes =
        input.notes ||
        `Sale of ${primary.name || primary.description}`;

      const existingSale = findSaleForTx(db, tx);
      const prevAnimalIds = new Set(
        existingSale?.animal_ids ?? (tx.animal_id != null ? [tx.animal_id] : [])
      );
      const newAnimalIds = new Set(animalIds);
      const pricePerGoat = input.grossSalePrice / animalIds.length;

      const animals = db.animals.map((a) => {
        if (prevAnimalIds.has(a.id) && !newAnimalIds.has(a.id)) {
          return { ...a, status: "Active" as const, sold_price: null, out_date: null };
        }
        if (newAnimalIds.has(a.id)) {
          return {
            ...a,
            status: "Sold" as const,
            out_date: input.date,
            sold_price: pricePerGoat,
          };
        }
        return a;
      });

      const amountReceived = existingSale
        ? Math.min(existingSale.amount_received, netReceived)
        : tx.amount;

      const sale: LivestockSale = existingSale
        ? {
            ...existingSale,
            date: input.date,
            animal_ids: animalIds,
            gross_sale_price: input.grossSalePrice,
            delivery_cost: deliveryCost,
            net_received: netReceived,
            amount_received: amountReceived,
            status: agreementStatus(amountReceived, netReceived),
            customer_id: input.customerId ?? existingSale.customer_id,
            notes: input.notes || null,
          }
        : {
            id: crypto.randomUUID(),
            date: input.date,
            animal_ids: animalIds,
            gross_sale_price: input.grossSalePrice,
            delivery_cost: deliveryCost,
            net_received: netReceived,
            amount_received: amountReceived,
            status: agreementStatus(amountReceived, netReceived),
            customer_id: input.customerId ?? null,
            notes: input.notes || null,
          };

      const updated: Transaction = {
        ...tx,
        date: input.date,
        amount: amountReceived,
        category: "Livestock Sale",
        kind: "income",
        animal_id: input.animalId,
        customer_id: sale.customer_id,
        notes,
        livestock_sale_id: sale.id,
      };

      const livestock_sales = existingSale
        ? (db.livestock_sales ?? []).map((s) => (s.id === existingSale.id ? sale : s))
        : [...(db.livestock_sales ?? []), sale];

      return {
        ...db,
        animals,
        transactions: db.transactions.map((t) => (t.id === tx.id ? updated : t)),
        livestock_sales,
      };
    }
  }
}

export function applyDeleteTransaction(db: FarmDatabase, id: string): FarmDatabase {
  const tx = db.transactions.find((t) => t.id === id);
  if (!tx) throw new Error("Transaction not found");
  const variant = resolveTransactionKind(tx);

  switch (variant) {
    case "expense": {
      return removeTx(db, id);
    }

    case "livestock_sale": {
      const linkedSale = findSaleForReceipt(db, id);
      if (linkedSale) {
        return applyDeleteSaleReceipt(db, id);
      }
      return removeTx(db, id);
    }

    case "livestock_purchase": {
      const animalId = tx.animal_id;
      if (animalId != null) {
        const otherTxs = db.transactions.filter(
          (t) => t.id !== id && t.animal_id === animalId
        );
        const medical = db.medical_events.filter((m) => m.animal_id === animalId);
        const breeding = db.breeding_events.filter(
          (b) => b.female_animal_id === animalId || b.male_animal_id === animalId
        );
        const sales = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
        const media = (db.animal_media ?? []).filter((m) => m.animal_id === animalId);
        const weights = (db.weight_logs ?? []).filter((w) => w.animal_id === animalId);

        if (
          otherTxs.length > 0 ||
          medical.length > 0 ||
          breeding.length > 0 ||
          sales.length > 0 ||
          media.length > 0 ||
          weights.length > 0
        ) {
          throw new Error(
            "Cannot delete this purchase: the linked animal has medical, breeding, sales, or other records. Remove those first, or keep the purchase transaction."
          );
        }

        const next = removeTx(db, id);
        return {
          ...next,
          animals: next.animals.filter((a) => a.id !== animalId),
        };
      }
      return removeTx(db, id);
    }
  }
}

/** Build a row-level WritePlan for an update (in-memory apply + diff). */
export function planUpdateTransaction(
  db: FarmDatabase,
  input: UpdateTransactionInput
): { after: FarmDatabase; plan: WritePlan } {
  const after = applyUpdateTransaction(db, input);
  return { after, plan: diffDb(db, after) };
}

/** Build a row-level WritePlan for a delete (in-memory apply + diff). */
export function planDeleteTransaction(
  db: FarmDatabase,
  id: string
): { after: FarmDatabase; plan: WritePlan } {
  const after = applyDeleteTransaction(db, id);
  return { after, plan: diffDb(db, after) };
}
