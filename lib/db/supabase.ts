import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Animal,
  AnimalMedia,
  BreedingEvent,
  Contact,
  FarmDatabase,
  FarmSettings,
  Lactation,
  LivestockSale,
  MedicalEvent,
  MilkRecord,
  Transaction,
  VetContact,
  WeightLog,
} from "../types";
import { DEFAULT_FARM_SETTINGS } from "../livestock/breeding";
import { emptyDb } from "../db-empty";
import { mapAnimalsWithParents, animalsWithEncodedParentComments } from "../livestock/animal-parents-store";
import { hasAnimalParentColumns } from "./parent-columns";

export function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v);
}

export function mapContact(r: Record<string, unknown>): Contact {
  return {
    id: String(r.id),
    name: String(r.name),
    type: r.type as Contact["type"],
    phone: (r.phone as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapAnimal(r: Record<string, unknown>): Animal {
  return {
    id: num(r.id),
    name: (r.name as string) ?? null,
    breed: r.breed == null ? null : String(r.breed),
    sex: (r.sex as Animal["sex"]) ?? null,
    registered_name: optionalStr(r.registered_name),
    barn_name: optionalStr(r.barn_name),
    previous_name: optionalStr(r.previous_name),
    adga_registration_number: optionalStr(r.adga_registration_number),
    tattoo_right: optionalStr(r.tattoo_right),
    tattoo_left: optionalStr(r.tattoo_left),
    tattoo_tail_web: optionalStr(r.tattoo_tail_web),
    eid_microchip: optionalStr(r.eid_microchip),
    scrapie_tag: optionalStr(r.scrapie_tag),
    farm_tag: optionalStr(r.farm_tag),
    date_of_purchase: r.date_of_purchase ? String(r.date_of_purchase) : null,
    age_at_purchase: (r.age_at_purchase as string) ?? null,
    description: (r.description as string) ?? null,
    comment: (r.comment as string) ?? null,
    status: r.status as Animal["status"],
    price: num(r.price ?? 0),
    sold_price: r.sold_price == null ? null : num(r.sold_price),
    purchased_from: (r.purchased_from as string) ?? null,
    owner_id: (r.owner_id as string) ?? null,
    home_bred: Boolean(r.home_bred),
    dam_id: r.dam_id == null ? null : num(r.dam_id),
    sire_id: r.sire_id == null ? null : num(r.sire_id),
    sire_name: (r.sire_name as string) ?? null,
    out_date: r.out_date ? String(r.out_date) : null,
  };
}

export function mapTx(r: Record<string, unknown>): Transaction {
  return {
    id: String(r.id),
    date: String(r.date),
    amount: num(r.amount),
    kind: r.kind as Transaction["kind"],
    category: r.category as Transaction["category"],
    animal_id: r.animal_id == null ? null : num(r.animal_id),
    customer_id: (r.customer_id as string) ?? null,
    vendor_id: (r.vendor_id as string) ?? null,
    notes: (r.notes as string) ?? null,
    source_row: r.source_row == null ? null : num(r.source_row),
    purchase_agreement_id: (r.purchase_agreement_id as string) ?? null,
    livestock_sale_id: (r.livestock_sale_id as string) ?? null,
  };
}

export function mapSale(r: Record<string, unknown>): LivestockSale {
  const net = num(r.net_received);
  const amountReceived =
    r.amount_received == null ? net : num(r.amount_received);
  return {
    id: String(r.id),
    date: String(r.date),
    animal_ids: Array.isArray(r.animal_ids) ? r.animal_ids.map(num) : [],
    gross_sale_price: num(r.gross_sale_price),
    delivery_cost: num(r.delivery_cost ?? 0),
    net_received: net,
    amount_received: amountReceived,
    status: (r.status as LivestockSale["status"]) ?? (amountReceived >= net ? "settled" : "open"),
    customer_id: (r.customer_id as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapPurchaseAgreement(r: Record<string, unknown>): import("../types").PurchaseAgreement {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    vendor_id: (r.vendor_id as string) ?? null,
    total_amount: num(r.total_amount),
    amount_paid: num(r.amount_paid ?? 0),
    status: (r.status as import("../types").AgreementStatus) ?? "open",
    notes: (r.notes as string) ?? null,
  };
}

function optionalNum(v: unknown): number | null {
  return v == null ? null : num(v);
}

function optionalStr(v: unknown): string | null {
  return v == null ? null : String(v);
}

export function mapMedical(r: Record<string, unknown>): MedicalEvent {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    event_type: r.event_type as MedicalEvent["event_type"],
    date: r.date ? String(r.date) : null,
    notes: (r.notes as string) ?? null,
    comment: (r.comment as string) ?? null,
    transaction_id: (r.transaction_id as string) ?? null,
    product_brand: optionalStr(r.product_brand),
    active_ingredient: optionalStr(r.active_ingredient),
    drug_class: optionalStr(r.drug_class),
    route: optionalStr(r.route),
    dose_amount: optionalNum(r.dose_amount),
    dose_unit: optionalStr(r.dose_unit),
    withdrawal_meat_days: optionalNum(r.withdrawal_meat_days),
    withdrawal_milk_days: optionalNum(r.withdrawal_milk_days),
    withdrawal_clear_date: r.withdrawal_clear_date ? String(r.withdrawal_clear_date) : null,
    lot_number: optionalStr(r.lot_number),
    expiration_date: r.expiration_date ? String(r.expiration_date) : null,
    famacha_score: optionalNum(r.famacha_score),
    body_condition_score: optionalNum(r.body_condition_score),
    fecal_egg_count: optionalNum(r.fecal_egg_count),
    fec_reduction_pct: optionalNum(r.fec_reduction_pct),
    prior_treatment_event_id: optionalStr(r.prior_treatment_event_id),
    production_stage: optionalStr(r.production_stage),
  };
}

export function mapBreeding(r: Record<string, unknown>): BreedingEvent {
  return {
    id: String(r.id),
    female_animal_id: num(r.female_animal_id),
    male_animal_id: r.male_animal_id == null ? null : num(r.male_animal_id),
    buck_name: (r.buck_name as string) ?? null,
    date_crossed: r.date_crossed ? String(r.date_crossed) : null,
    exposure_start_date: r.exposure_start_date ? String(r.exposure_start_date) : null,
    exposure_end_date: r.exposure_end_date ? String(r.exposure_end_date) : null,
    expected_due_date: r.expected_due_date ? String(r.expected_due_date) : null,
    due_date_early: r.due_date_early ? String(r.due_date_early) : null,
    due_date_late: r.due_date_late ? String(r.due_date_late) : null,
    delivered_date: r.delivered_date ? String(r.delivered_date) : null,
    ultrasound_date: r.ultrasound_date ? String(r.ultrasound_date) : null,
    fetus_count: r.fetus_count != null ? Number(r.fetus_count) : null,
    outcome: r.outcome as BreedingEvent["outcome"],
    status: (r.status as BreedingEvent["status"]) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export function mapWeight(r: Record<string, unknown>): WeightLog {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    weighed_on: String(r.weighed_on),
    weight_kg: num(r.weight_kg),
    notes: (r.notes as string) ?? null,
  };
}

export function mapMedia(r: Record<string, unknown>): AnimalMedia {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    storage_path: String(r.storage_path),
    media_type: r.media_type as AnimalMedia["media_type"],
    caption: (r.caption as string) ?? null,
    created_at: String(r.created_at),
  };
}

export function mapMilk(r: Record<string, unknown>): MilkRecord {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    date: String(r.date),
    session: r.session as MilkRecord["session"],
    amount_raw: num(r.amount_raw),
    unit_entered: r.unit_entered as MilkRecord["unit_entered"],
    amount_lb_normalized: num(r.amount_lb_normalized),
    measurement_method: r.measurement_method as MilkRecord["measurement_method"],
    source: r.source as MilkRecord["source"],
    operator: optionalStr(r.operator),
    notes: optionalStr(r.notes),
  };
}

export function mapLactation(r: Record<string, unknown>): Lactation {
  return {
    id: String(r.id),
    animal_id: num(r.animal_id),
    freshening_date: String(r.freshening_date),
    lactation_number: num(r.lactation_number ?? 1),
    dry_off_date: r.dry_off_date ? String(r.dry_off_date) : null,
    notes: optionalStr(r.notes),
  };
}

export function mapVetContact(r: Record<string, unknown>): VetContact {
  return {
    id: String(r.id),
    role: r.role as VetContact["role"],
    name: String(r.name),
    phone: optionalStr(r.phone),
    emergency_phone: optionalStr(r.emergency_phone),
    address: optionalStr(r.address),
    services_offered: optionalStr(r.services_offered),
    accepts_new_clients: optionalStr(r.accepts_new_clients),
    vcpr_established: optionalStr(r.vcpr_established),
    notes: optionalStr(r.notes),
  };
}

export function mapFarmSettings(r: Record<string, unknown> | undefined): FarmSettings {
  if (!r) return { ...DEFAULT_FARM_SETTINGS };
  return {
    gestation_days: num(r.gestation_days ?? DEFAULT_FARM_SETTINGS.gestation_days),
    gestation_early_days: num(r.gestation_early_days ?? DEFAULT_FARM_SETTINGS.gestation_early_days),
    gestation_late_days: num(r.gestation_late_days ?? DEFAULT_FARM_SETTINGS.gestation_late_days),
  };
}

export async function selectAll(client: SupabaseClient, table: string) {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

/** True when PostgREST/Postgres cannot see a table (missing migration, cache, or grants). */
export function isMissingRelationMessage(message: string, table?: string): boolean {
  const lower = message.toLowerCase();
  const missing =
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache") ||
    lower.includes("permission denied");
  if (!missing) return false;
  if (!table) return true;
  return lower.includes(table.toLowerCase());
}

/** Like selectAll but returns [] when a table is missing (e.g. migration not applied). */
export async function selectAllOptional(client: SupabaseClient, table: string) {
  try {
    return await selectAll(client, table);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingRelationMessage(message, table)) {
      console.warn(`[farm] optional table ${table} unavailable: ${message}`);
      return [] as Record<string, unknown>[];
    }
    throw err;
  }
}

export function mapMeta(meta: Record<string, unknown> | undefined): FarmDatabase["meta"] {
  return {
    importedAt: meta?.imported_at ? String(meta.imported_at) : null,
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

export async function loadFromSupabase(client: SupabaseClient): Promise<FarmDatabase> {
  const [
    contacts,
    animals,
    transactions,
    sales,
    purchaseAgreements,
    medical,
    breeding,
    weights,
    media,
    milk,
    lactations,
    vetContacts,
    farmSettingsRows,
    metaRows,
  ] = await Promise.all([
    selectAll(client, "contacts"),
    selectAll(client, "animals"),
    selectAll(client, "transactions"),
    selectAll(client, "livestock_sales"),
    selectAll(client, "purchase_agreements"),
    selectAll(client, "medical_events"),
    selectAll(client, "breeding_events"),
    selectAll(client, "weight_logs"),
    selectAll(client, "animal_media"),
    selectAllOptional(client, "milk_records"),
    selectAllOptional(client, "lactations"),
    selectAllOptional(client, "vet_contacts"),
    selectAllOptional(client, "farm_settings"),
    selectAll(client, "app_meta"),
  ]);

  const meta = metaRows[0];
  const db = emptyDb();
  db.contacts = contacts.map(mapContact);
  db.animals = await mapAnimalsWithParents(client, animals);
  db.transactions = transactions
    .map(mapTx)
    .filter((t) => t.kind === "cost" || t.kind === "income");
  db.livestock_sales = sales.map(mapSale);
  db.purchase_agreements = purchaseAgreements.map(mapPurchaseAgreement);
  db.medical_events = medical.map(mapMedical);
  db.breeding_events = breeding.map(mapBreeding);
  db.weight_logs = weights.map(mapWeight);
  db.animal_media = media.map(mapMedia);
  db.milk_records = milk.map(mapMilk);
  db.lactations = lactations.map(mapLactation);
  db.vet_contacts = vetContacts.map(mapVetContact);
  db.farm_settings = mapFarmSettings(farmSettingsRows[0]);
  db.meta = mapMeta(meta);
  return db;
}

async function upsert(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id"
) {
  if (rows.length === 0) return;
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await client.from(table).upsert(slice, { onConflict });
    if (error) throw new Error(`${table} upsert: ${error.message}`);
  }
}

/**
 * Delete rows that exist in Supabase but not in memory, then upsert current rows.
 * Without this, deletes never persist (upsert-only leaves orphan rows).
 */
async function syncTable(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  idColumn = "id"
) {
  const { data, error } = await client.from(table).select(idColumn);
  if (error) throw new Error(`${table} select ids: ${error.message}`);

  const keep = new Set(rows.map((r) => String(r[idColumn])));
  const orphanIds = (data as unknown as Array<Record<string, unknown>> | null ?? [])
    .map((r) => String(r[idColumn]))
    .filter((id) => !keep.has(id));

  if (orphanIds.length > 0) {
    const chunk = 500;
    for (let i = 0; i < orphanIds.length; i += chunk) {
      const slice = orphanIds.slice(i, i + chunk);
      const { error: delErr } = await client.from(table).delete().in(idColumn, slice);
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
    }
  }

  await upsert(client, table, rows, idColumn);
}

export async function saveToSupabase(client: SupabaseClient, db: FarmDatabase): Promise<void> {
  const parentCols = await hasAnimalParentColumns(client);
  // Children before parents so FK constraints are respected when deleting.
  await syncTable(
    client,
    "livestock_sales",
    db.livestock_sales.map((s) => ({
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
    }))
  );

  await syncTable(
    client,
    "purchase_agreements",
    (db.purchase_agreements ?? []).map((p) => ({
      id: p.id,
      animal_id: p.animal_id,
      vendor_id: p.vendor_id,
      total_amount: p.total_amount,
      amount_paid: p.amount_paid,
      status: p.status,
      notes: p.notes,
    }))
  );

  await syncTable(
    client,
    "medical_events",
    db.medical_events.map(medicalRow)
  );

  await syncTable(
    client,
    "breeding_events",
    db.breeding_events.map((b) => ({
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
    }))
  );

  await syncTable(
    client,
    "weight_logs",
    db.weight_logs.map((w) => ({
      id: w.id,
      animal_id: w.animal_id,
      weighed_on: w.weighed_on,
      weight_kg: w.weight_kg,
      notes: w.notes,
    }))
  );

  await syncTable(
    client,
    "animal_media",
    (db.animal_media ?? []).map((m) => ({
      id: m.id,
      animal_id: m.animal_id,
      storage_path: m.storage_path,
      media_type: m.media_type,
      caption: m.caption,
      created_at: m.created_at,
    }))
  );

  await syncTable(
    client,
    "transactions",
    db.transactions.map((t) => ({
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
    }))
  );

  await syncTable(
    client,
    "animals",
    (parentCols ? db.animals : animalsWithEncodedParentComments(db.animals)).map((a) => {
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
      if (parentCols) {
        row.dam_id = a.dam_id;
        row.sire_id = a.sire_id;
        row.sire_name = a.sire_name;
      }
      return row;
    })
  );

  await syncTable(
    client,
    "contacts",
    db.contacts.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      phone: c.phone ?? null,
      notes: c.notes ?? null,
    }))
  );

  const { error: metaErr } = await client.from("app_meta").upsert({
    id: 1,
    imported_at: db.meta.importedAt,
    updated_at: new Date().toISOString(),
  });
  if (metaErr) throw new Error(`app_meta upsert: ${metaErr.message}`);
}
