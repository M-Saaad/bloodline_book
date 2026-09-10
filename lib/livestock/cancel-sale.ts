import type { FarmDatabase, LivestockSale } from "../types";
import { agreementStatus } from "./purchase-agreement";
import { findSaleForAnimal, saleReceiptTxIds } from "./record-sale";

export function saleReceiptAmount(txAmount: number): number {
  return Math.abs(txAmount);
}

export function allSaleReceiptTxIds(db: FarmDatabase, sale: LivestockSale): string[] {
  return saleReceiptTxIds(db, sale.id);
}

export function findSaleForReceipt(
  db: FarmDatabase,
  txId: string
): LivestockSale | undefined {
  const tx = db.transactions.find((t) => t.id === txId);
  if (!tx?.livestock_sale_id) return undefined;
  return (db.livestock_sales ?? []).find((s) => s.id === tx.livestock_sale_id);
}

function revertAnimalsAfterSale(
  db: FarmDatabase,
  sale: LivestockSale
): FarmDatabase["animals"] {
  const animalIds = new Set(sale.animal_ids);

  return db.animals.map((a) => {
    if (!animalIds.has(a.id)) return a;
    return {
      ...a,
      status: "Active" as const,
      sold_price: null,
      out_date: null,
    };
  });
}

export function applyDeleteSaleReceipt(db: FarmDatabase, txId: string): FarmDatabase {
  const tx = db.transactions.find((t) => t.id === txId);
  if (!tx || tx.category !== "Livestock Sale") {
    throw new Error("Not a livestock sale receipt");
  }

  const sale = findSaleForReceipt(db, txId);
  if (!sale) throw new Error("No sale linked to this receipt");

  const receiptAmount = saleReceiptAmount(tx.amount);
  if (sale.amount_received < receiptAmount - 0.005) {
    throw new Error("Receipt amount does not match sale records");
  }

  const remainingReceiptIds = allSaleReceiptTxIds(db, sale).filter((id) => id !== txId);
  const nextReceived = sale.amount_received - receiptAmount;

  const updatedSale: LivestockSale = {
    ...sale,
    amount_received: Math.max(0, nextReceived),
    status: agreementStatus(Math.max(0, nextReceived), sale.net_received),
  };

  const next = {
    ...db,
    transactions: db.transactions.filter((t) => t.id !== txId),
    livestock_sales: (db.livestock_sales ?? []).map((s) => (s.id === sale.id ? updatedSale : s)),
  };

  if (nextReceived <= 0.005 && remainingReceiptIds.length === 0) {
    return {
      ...next,
      animals: revertAnimalsAfterSale(next, sale),
      livestock_sales: (next.livestock_sales ?? []).filter((s) => s.id !== sale.id),
    };
  }

  return next;
}

export function applyUndoLivestockSale(db: FarmDatabase, saleId: string): FarmDatabase {
  const sale = (db.livestock_sales ?? []).find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found");

  const txIds = new Set(allSaleReceiptTxIds(db, sale));

  return {
    ...db,
    animals: revertAnimalsAfterSale(db, sale),
    transactions: db.transactions.filter((t) => !txIds.has(t.id)),
    livestock_sales: (db.livestock_sales ?? []).filter((s) => s.id !== saleId),
  };
}

export function applyUndoLivestockSaleForAnimal(
  db: FarmDatabase,
  animalId: number
): FarmDatabase {
  const sale = findSaleForAnimal(db, animalId);
  if (!sale) throw new Error("No sale recorded for this goat");
  return applyUndoLivestockSale(db, sale.id);
}
