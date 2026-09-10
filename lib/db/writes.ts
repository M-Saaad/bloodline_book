/**
 * Row-level Supabase writes. Prefer these over full-table saveToSupabase at runtime.
 * Seed scripts may still call saveToSupabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Animal,
  AnimalMedia,
  BreedingEvent,
  Contact,
  FarmDatabase,
  LivestockSale,
  MedicalEvent,
  PurchaseAgreement,
  Transaction,
  WeightLog,
} from "../types";
import { createServiceClient } from "../supabase/admin";
import { isSupabaseDb, persistDb } from "../db";
import { hasAnimalParentColumns } from "./parent-columns";
import { animalsWithEncodedParentComments } from "../livestock/animal-parents-store";

export type WritePlan = {
  upsertContacts?: Contact[];
  upsertAnimals?: Animal[];
  deleteAnimalIds?: number[];
  upsertTransactions?: Transaction[];
  deleteTransactionIds?: string[];
  upsertSales?: LivestockSale[];
  deleteSaleIds?: string[];
  upsertPurchaseAgreements?: PurchaseAgreement[];
  deletePurchaseAgreementIds?: string[];
  upsertMedical?: MedicalEvent[];
  deleteMedicalIds?: string[];
  upsertBreeding?: BreedingEvent[];
  deleteBreedingIds?: string[];
  upsertMedia?: AnimalMedia[];
  upsertWeights?: WeightLog[];
};

function txRow(t: Transaction): Record<string, unknown> {
  return {
    id: t.id,
    date: t.date,
    amount: t.amount,
    kind: t.kind,
    category: t.category,
    animal_id: t.animal_id,
    customer_id: t.customer_id,
    vendor_id: t.vendor_id,
    notes: t.notes,
    source_row: t.source_row,
    purchase_agreement_id: t.purchase_agreement_id,
    livestock_sale_id: t.livestock_sale_id,
  };
}

function contactRow(c: Contact): Record<string, unknown> {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    phone: c.phone ?? null,
    notes: c.notes ?? null,
  };
}

function animalRow(a: Animal, includeParents = true): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: a.id,
    name: a.name,
    breed: a.breed,
    sex: a.sex,
    date_of_purchase: a.date_of_purchase,
    age_at_purchase: a.age_at_purchase,
    description: a.description,
    comment: a.comment,
    status: a.status,
    price: a.price,
    sold_price: a.sold_price,
    purchased_from: a.purchased_from,
    owner_id: a.owner_id,
    home_bred: a.home_bred,
    out_date: a.out_date,
  };
  if (includeParents) {
    row.dam_id = a.dam_id;
    row.sire_id = a.sire_id;
    row.sire_name = a.sire_name;
  }
  return row;
}

function saleRow(s: LivestockSale): Record<string, unknown> {
  return {
    id: s.id,
    date: s.date,
    animal_ids: s.animal_ids,
    gross_sale_price: s.gross_sale_price,
    delivery_cost: s.delivery_cost,
    net_received: s.net_received,
    amount_received: s.amount_received,
    status: s.status,
    customer_id: s.customer_id,
    notes: s.notes,
  };
}

function purchaseAgreementRow(p: PurchaseAgreement): Record<string, unknown> {
  return {
    id: p.id,
    animal_id: p.animal_id,
    vendor_id: p.vendor_id,
    total_amount: p.total_amount,
    amount_paid: p.amount_paid,
    status: p.status,
    notes: p.notes,
  };
}

function medicalRow(m: MedicalEvent): Record<string, unknown> {
  return {
    id: m.id,
    animal_id: m.animal_id,
    event_type: m.event_type,
    date: m.date,
    notes: m.notes,
    comment: m.comment,
    transaction_id: m.transaction_id,
    product_brand: m.product_brand ?? null,
    active_ingredient: m.active_ingredient ?? null,
    drug_class: m.drug_class ?? null,
    route: m.route ?? null,
    dose_amount: m.dose_amount ?? null,
    dose_unit: m.dose_unit ?? null,
    withdrawal_meat_days: m.withdrawal_meat_days ?? null,
    withdrawal_milk_days: m.withdrawal_milk_days ?? null,
    withdrawal_clear_date: m.withdrawal_clear_date ?? null,
    lot_number: m.lot_number ?? null,
    expiration_date: m.expiration_date ?? null,
    famacha_score: m.famacha_score ?? null,
    body_condition_score: m.body_condition_score ?? null,
    fecal_egg_count: m.fecal_egg_count ?? null,
    fec_reduction_pct: m.fec_reduction_pct ?? null,
    prior_treatment_event_id: m.prior_treatment_event_id ?? null,
    production_stage: m.production_stage ?? null,
  };
}

function breedingRow(b: BreedingEvent): Record<string, unknown> {
  return {
    id: b.id,
    female_animal_id: b.female_animal_id,
    male_animal_id: b.male_animal_id,
    buck_name: b.buck_name,
    date_crossed: b.date_crossed,
    expected_due_date: b.expected_due_date,
    delivered_date: b.delivered_date,
    ultrasound_date: b.ultrasound_date,
    fetus_count: b.fetus_count,
    outcome: b.outcome,
    status: b.status,
    notes: b.notes,
  };
}

function mediaRow(m: AnimalMedia): Record<string, unknown> {
  return {
    id: m.id,
    animal_id: m.animal_id,
    storage_path: m.storage_path,
    media_type: m.media_type,
    caption: m.caption,
    created_at: m.created_at,
  };
}

async function upsertRows(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return;
  const { error } = await client.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function deleteByIds(
  client: SupabaseClient,
  table: string,
  ids: (string | number)[],
  column = "id"
) {
  if (ids.length === 0) return;
  const { error } = await client.from(table).delete().in(column, ids);
  if (error) throw new Error(`${table} delete: ${error.message}`);
}

export async function applyWritePlan(plan: WritePlan): Promise<void> {
  const client = createServiceClient();

  if (plan.upsertContacts?.length) {
    await upsertRows(client, "contacts", plan.upsertContacts.map(contactRow));
  }

  if (plan.deleteSaleIds?.length) {
    await deleteByIds(client, "livestock_sales", plan.deleteSaleIds);
  }
  if (plan.deletePurchaseAgreementIds?.length) {
    await deleteByIds(client, "purchase_agreements", plan.deletePurchaseAgreementIds);
  }
  if (plan.deleteBreedingIds?.length) {
    await deleteByIds(client, "breeding_events", plan.deleteBreedingIds);
  }
  if (plan.deleteMedicalIds?.length) {
    await deleteByIds(client, "medical_events", plan.deleteMedicalIds);
  }

  if (plan.deleteTransactionIds?.length) {
    await deleteByIds(client, "transactions", plan.deleteTransactionIds);
  }
  if (plan.deleteAnimalIds?.length) {
    await deleteByIds(client, "animals", plan.deleteAnimalIds);
  }

  if (plan.upsertAnimals?.length) {
    const parentCols = await hasAnimalParentColumns(client);
    const animalsToWrite = parentCols
      ? plan.upsertAnimals
      : animalsWithEncodedParentComments(plan.upsertAnimals);
    await upsertRows(
      client,
      "animals",
      animalsToWrite.map((a) => animalRow(a, parentCols))
    );
  }
  if (plan.upsertPurchaseAgreements?.length) {
    await upsertRows(
      client,
      "purchase_agreements",
      plan.upsertPurchaseAgreements.map(purchaseAgreementRow)
    );
  }

  const allTxs = plan.upsertTransactions ?? [];
  const txsBeforeSales = allTxs.filter((t) => !t.livestock_sale_id);
  const txsAfterSales = allTxs.filter((t) => t.livestock_sale_id);

  if (txsBeforeSales.length) {
    await upsertRows(client, "transactions", txsBeforeSales.map(txRow));
  }
  if (plan.upsertSales?.length) {
    await upsertRows(client, "livestock_sales", plan.upsertSales.map(saleRow));
  }
  if (txsAfterSales.length) {
    await upsertRows(client, "transactions", txsAfterSales.map(txRow));
  }
  if (plan.upsertMedical?.length) {
    await upsertRows(client, "medical_events", plan.upsertMedical.map(medicalRow));
  }
  if (plan.upsertBreeding?.length) {
    await upsertRows(client, "breeding_events", plan.upsertBreeding.map(breedingRow));
  }
  if (plan.upsertMedia?.length) {
    await upsertRows(client, "animal_media", plan.upsertMedia.map(mediaRow));
  }
  if (plan.upsertWeights?.length) {
    await upsertRows(
      client,
      "weight_logs",
      plan.upsertWeights.map((w) => ({
        id: w.id,
        animal_id: w.animal_id,
        weighed_on: w.weighed_on,
        weight_kg: w.weight_kg,
        notes: w.notes,
      }))
    );
  }
}

function byId<T extends { id: string | number }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((r) => [String(r.id), r]));
}

function changed<T extends { id: string | number }>(
  before: T[],
  after: T[],
  equal: (a: T, b: T) => boolean
): { upsert: T[]; deleteIds: string[] } {
  const bMap = byId(before);
  const aMap = byId(after);
  const upsert: T[] = [];
  for (const [id, row] of aMap) {
    const prev = bMap.get(id);
    if (!prev || !equal(prev, row)) upsert.push(row);
  }
  const deleteIds: string[] = [];
  for (const id of bMap.keys()) {
    if (!aMap.has(id)) deleteIds.push(id);
  }
  return { upsert, deleteIds };
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Diff two FarmDatabase snapshots into a minimal WritePlan. */
export function diffDb(before: FarmDatabase, after: FarmDatabase): WritePlan {
  const contacts = changed(before.contacts, after.contacts, jsonEq);
  const animals = changed(before.animals, after.animals, jsonEq);
  const txs = changed(before.transactions, after.transactions, jsonEq);
  const sales = changed(before.livestock_sales ?? [], after.livestock_sales ?? [], jsonEq);
  const purchaseAgreements = changed(
    before.purchase_agreements ?? [],
    after.purchase_agreements ?? [],
    jsonEq
  );
  const medical = changed(before.medical_events, after.medical_events, jsonEq);
  const breeding = changed(before.breeding_events, after.breeding_events, jsonEq);
  const media = changed(before.animal_media ?? [], after.animal_media ?? [], jsonEq);
  const weights = changed(before.weight_logs ?? [], after.weight_logs ?? [], jsonEq);

  return {
    upsertContacts: contacts.upsert,
    upsertAnimals: animals.upsert,
    deleteAnimalIds: animals.deleteIds.map(Number),
    upsertTransactions: txs.upsert,
    deleteTransactionIds: txs.deleteIds,
    upsertSales: sales.upsert,
    deleteSaleIds: sales.deleteIds,
    upsertPurchaseAgreements: purchaseAgreements.upsert,
    deletePurchaseAgreementIds: purchaseAgreements.deleteIds,
    upsertMedical: medical.upsert,
    deleteMedicalIds: medical.deleteIds,
    upsertBreeding: breeding.upsert,
    deleteBreedingIds: breeding.deleteIds,
    upsertMedia: media.upsert,
    upsertWeights: weights.upsert,
  };
}

/**
 * Persist in-memory mutation result. On Supabase: only changed rows.
 * On JSON: full file write.
 */
export async function persistMutation(
  before: FarmDatabase,
  after: FarmDatabase
): Promise<FarmDatabase> {
  if (!isSupabaseDb()) {
    return persistDb(after);
  }
  const plan = diffDb(before, after);
  await applyWritePlan(plan);
  return after;
}
