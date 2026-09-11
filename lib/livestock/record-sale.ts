/**
 * Livestock sale recording for a single-owner farm ledger.
 */
import type {
  AgreementStatus,
  FarmDatabase,
  LivestockSale,
  Transaction,
} from "../types";
import { createIncomeTransaction } from "../transactions/ledger";
import { agreementStatus } from "./purchase-agreement";

export interface RecordLivestockSaleInput {
  date: string;
  animalId: number;
  additionalAnimalIds?: number[];
  grossSalePrice: number;
  deliveryCost?: number;
  /** Cash received now toward net proceeds. Defaults to full net. Use 0 for sold-with-no-cash-yet. */
  amountReceivedNow?: number | null;
  customerId?: string | null;
  notes?: string | null;
}

export interface SaleReceiptInput {
  date: string;
  amount: number;
  notes?: string | null;
}

export interface SaleReceiptResult {
  tx: Transaction;
  sale: LivestockSale;
}

export function computeSaleNet(grossSalePrice: number, deliveryCost = 0): number {
  return grossSalePrice - deliveryCost;
}

/** @deprecated Use computeSaleNet — kept for callers that still reference the old name. */
export function computeSaleSplit(grossSalePrice: number, deliveryCost = 0) {
  const netReceived = computeSaleNet(grossSalePrice, deliveryCost);
  return { netReceived, partnerShare: netReceived };
}

export function saleBalance(sale: LivestockSale): number {
  return Math.max(0, sale.net_received - sale.amount_received);
}

export function findSaleForAnimal(db: FarmDatabase, animalId: number): LivestockSale | undefined {
  return (db.livestock_sales ?? []).find((s) => s.animal_ids.includes(animalId));
}

export function saleReceiptTxIds(db: FarmDatabase, saleId: string): string[] {
  return db.transactions
    .filter((t) => t.livestock_sale_id === saleId)
    .map((t) => t.id);
}

function validateReceiptAmount(sale: LivestockSale, amount: number) {
  if (amount <= 0 || Number.isNaN(amount)) {
    throw new Error("Receipt amount must be positive");
  }
  const balance = saleBalance(sale);
  if (amount > balance + 0.005) {
    throw new Error(`Receipt exceeds outstanding balance (${balance})`);
  }
}

export function buildSaleReceipt(
  db: FarmDatabase,
  sale: LivestockSale,
  input: SaleReceiptInput
): SaleReceiptResult {
  validateReceiptAmount(sale, input.amount);
  const animal = db.animals.find((a) => sale.animal_ids.includes(a.id));
  const notes =
    input.notes ||
    `Sale receipt — ${animal?.name || animal?.description || "goat"}`;

  const tx = createIncomeTransaction({
    date: input.date,
    amount: input.amount,
    category: "Livestock Sale",
    animalId: sale.animal_ids[0] ?? null,
    customerId: sale.customer_id,
    notes,
    livestockSaleId: sale.id,
  });

  const nextReceived = sale.amount_received + input.amount;
  const updatedSale: LivestockSale = {
    ...sale,
    amount_received: nextReceived,
    status: agreementStatus(nextReceived, sale.net_received) as AgreementStatus,
  };

  return { tx, sale: updatedSale };
}

export function beginLivestockSale(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): {
  sale: LivestockSale;
  tx: Transaction | null;
  animals: FarmDatabase["animals"];
  newContacts: FarmDatabase["contacts"];
} {
  const animal = db.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");

  const deliveryCost = input.deliveryCost ?? 0;
  const netReceived = computeSaleNet(input.grossSalePrice, deliveryCost);
  const animalIds = [input.animalId, ...(input.additionalAnimalIds ?? [])];

  if (netReceived < 0) throw new Error("Net sale amount cannot be negative");

  const receivedNow =
    input.amountReceivedNow == null || Number.isNaN(input.amountReceivedNow)
      ? netReceived
      : input.amountReceivedNow;

  if (receivedNow < 0) throw new Error("Amount received cannot be negative");
  if (receivedNow > netReceived + 0.005) {
    throw new Error(`Received amount cannot exceed net proceeds (${netReceived})`);
  }

  const sale: LivestockSale = {
    id: crypto.randomUUID(),
    date: input.date,
    animal_ids: animalIds,
    gross_sale_price: input.grossSalePrice,
    delivery_cost: deliveryCost,
    net_received: netReceived,
    amount_received: 0,
    status: receivedNow >= netReceived - 0.005 ? "settled" : "open",
    customer_id: input.customerId ?? null,
    notes: input.notes ?? null,
  };

  let tx: Transaction | null = null;

  if (receivedNow > 0) {
    const receipt = buildSaleReceipt(db, { ...sale, amount_received: 0 }, {
      date: input.date,
      amount: receivedNow,
      notes: input.notes ?? undefined,
    });
    tx = receipt.tx;
    sale.amount_received = receipt.sale.amount_received;
    sale.status = receipt.sale.status;
  }

  const idSet = new Set(animalIds);
  const pricePerGoat = input.grossSalePrice / animalIds.length;

  const animals = db.animals.map((a) => {
    if (!idSet.has(a.id)) return a;
    return {
      ...a,
      status: "Sold" as const,
      out_date: input.date,
      sold_price: pricePerGoat,
    };
  });

  return { sale, tx, animals, newContacts: [] };
}

export function applyLivestockSaleToDb(
  db: FarmDatabase,
  input: RecordLivestockSaleInput
): FarmDatabase {
  const result = beginLivestockSale(db, input);

  return {
    ...db,
    contacts: result.newContacts.length ? [...db.contacts, ...result.newContacts] : db.contacts,
    animals: result.animals,
    transactions: result.tx ? [...db.transactions, result.tx] : db.transactions,
    livestock_sales: [...(db.livestock_sales ?? []), result.sale],
  };
}

export function applySaleReceiptToDb(
  db: FarmDatabase,
  saleId: string,
  input: SaleReceiptInput
): FarmDatabase {
  const sale = (db.livestock_sales ?? []).find((s) => s.id === saleId);
  if (!sale) throw new Error("Sale not found");

  const { tx, sale: updatedSale } = buildSaleReceipt(db, sale, input);

  return {
    ...db,
    transactions: [...db.transactions, tx],
    livestock_sales: (db.livestock_sales ?? []).map((s) => (s.id === saleId ? updatedSale : s)),
  };
}

// Backward-compatible exports used by tests
export function recordLivestockSale(db: FarmDatabase, input: RecordLivestockSaleInput) {
  const result = beginLivestockSale(db, input);
  if (!result.tx && result.sale.net_received > 0) {
    throw new Error("Sale must record at least one receipt when net proceeds are positive");
  }
  return {
    sale: result.sale,
    tx: result.tx,
    netReceived: result.sale.net_received,
    partnerShare: result.sale.net_received,
  };
}
