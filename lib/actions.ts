import type { FarmDatabase, CategoryName, MedicalEvent } from "./types";
import { fetchDb, isSupabaseDb } from "./db";
import { createCostTransaction } from "./transactions/ledger";
import {
  applyLivestockSaleToDb,
  applySaleReceiptToDb,
  beginLivestockSale,
  buildSaleReceipt,
  findSaleForAnimal,
} from "./livestock/record-sale";
import {
  applyDeleteSaleReceipt,
  applyUndoLivestockSaleForAnimal,
} from "./livestock/cancel-sale";
import {
  applyPurchasePayment,
  createPurchaseAgreement,
  findPurchaseAgreement,
  validatePurchasePaymentAmount,
} from "./livestock/purchase-agreement";
import {
  assertFemaleAvailableForBreeding,
  computeBreedingDueDates,
  findActiveBreedingForDam,
  resolveBreedingAfterBirth,
  resolveBreedingAfterUltrasound,
} from "./livestock/breeding";
import { computeWithdrawalClearDate } from "./livestock/medical-notes";
import { normalizeMilkToLb } from "./livestock/milk";
import { applyDeleteAnimal } from "./animals/delete";
import { applyUpdateAnimalDetails, type UpdateAnimalInput } from "./animals/update";
import {
  applyAcquireFromCustomer,
  type AcquireFromCustomerInput,
} from "./livestock/acquire-from-customer";
import {
  applyDeleteTransaction,
  applyUpdateTransaction,
  type UpdateTransactionInput,
} from "./transactions/mutate";
import { persistMutation, applyWritePlan } from "./db/writes";
import type {
  AnimalStatus,
  AnimalBreed,
  AnimalSex,
  MedicalEventType,
  BreedingOutcome,
  BreedingStatus,
  BreedingEvent,
  Lactation,
  MilkRecord,
  MilkSession,
  MilkUnit,
  MilkMeasurementMethod,
  MilkSource,
  VetContact,
  VetContactRole,
} from "./types";
import { animalLabel } from "./labels";
import { uploadAnimalMedia } from "./media/upload";
import { similarVaccineEvents } from "./livestock/vaccine-schedule";
import { createServiceClient } from "./supabase/admin";
import { mapMedical } from "./db/supabase";

export { animalLabel };

export async function getDb(): Promise<FarmDatabase> {
  return fetchDb();
}

export function contactName(db: FarmDatabase, id: string | null | undefined) {
  if (!id) return "—";
  return db.contacts.find((c) => c.id === id)?.name ?? "—";
}

export async function logExpense(input: {
  date: string;
  amount: number;
  category: string;
  animalId?: number | null;
  notes?: string;
}) {
  const before = await fetchDb();
  const tx = createCostTransaction({
    date: input.date,
    amount: input.amount,
    category: input.category as CategoryName,
    animalId: input.animalId,
    notes: input.notes,
  });
  const after = {
    ...before,
    transactions: [...before.transactions, tx],
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertTransactions: [tx] });
    return after;
  }
  return persistMutation(before, after);
}

function resolveOwnerContact(
  db: FarmDatabase,
  ownerName: string
): { contact: FarmDatabase["contacts"][number]; created: boolean } {
  let owner = db.contacts.find((c) => c.name.toLowerCase() === ownerName.toLowerCase());
  if (!owner) {
    const type = ownerName === "Farm" ? "Farm" : "Customer";
    owner = { id: crypto.randomUUID(), name: ownerName, type, phone: null, notes: null };
    return { contact: owner, created: true };
  }
  return { contact: owner, created: false };
}

function resolveVendor(
  db: FarmDatabase,
  vendorName?: string | null
): { id: string | null; contact?: FarmDatabase["contacts"][number] } {
  const name = vendorName?.trim();
  if (!name) return { id: null };
  let v = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === "Vendor"
  );
  if (!v) {
    v = { id: crypto.randomUUID(), name, type: "Vendor", phone: null, notes: null };
    return { id: v.id, contact: v };
  }
  return { id: v.id };
}

function resolveCustomer(
  db: FarmDatabase,
  customerName?: string | null
): { id: string | null; contact?: FarmDatabase["contacts"][number] } {
  const name = customerName?.trim();
  if (!name) return { id: null };
  let customer = db.contacts.find(
    (c) => c.name.toLowerCase() === name.toLowerCase() && c.type === "Customer"
  );
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name,
      type: "Customer",
      phone: null,
      notes: null,
    };
    return { id: customer.id, contact: customer };
  }
  return { id: customer.id };
}

export async function buyGoat(input: {
  date: string;
  price?: number | null;
  paidNow?: number | null;
  breed: AnimalBreed;
  sex: AnimalSex;
  description: string;
  name?: string;
  ownerName: string;
  vendorName?: string;
}) {
  const before = await fetchDb();
  let db = before;
  const ownerRes = resolveOwnerContact(db, input.ownerName);
  const newContacts: FarmDatabase["contacts"] = [];
  if (ownerRes.created) {
    newContacts.push(ownerRes.contact);
    db = { ...db, contacts: [...db.contacts, ownerRes.contact] };
  }
  const vendorRes = resolveVendor(db, input.vendorName);
  if (vendorRes.contact) {
    newContacts.push(vendorRes.contact);
    db = { ...db, contacts: [...db.contacts, vendorRes.contact] };
  }
  const owner = ownerRes.contact;
  const vendorId = vendorRes.id;
  const isCustomerOwner = owner.type === "Customer";

  let price: number;
  if (isCustomerOwner) {
    price = input.price != null && !Number.isNaN(input.price) ? input.price : 0;
  } else {
    if (input.price == null || Number.isNaN(input.price)) {
      throw new Error("Price is required");
    }
    price = input.price;
  }

  const nextId = db.animals.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const animal = {
    id: nextId,
    name: input.name || null,
    breed: input.breed,
    sex: input.sex,
    date_of_purchase: input.date,
    age_at_purchase: null,
    description: input.description,
    comment: null,
    status: "Active" as const,
    price,
    sold_price: null,
    purchased_from: vendorId,
    owner_id: owner.id,
    home_bred: false,
    dam_id: null,
    sire_id: null,
    sire_name: null,
    out_date: null,
  };
  db = { ...db, animals: [...db.animals, animal] };

  const defaultPaidNow = isCustomerOwner ? 0 : price;
  const paidNow =
    input.paidNow == null || Number.isNaN(input.paidNow) ? defaultPaidNow : input.paidNow;
  if (paidNow < 0) throw new Error("Amount paid cannot be negative");
  if (paidNow > price + 0.005) throw new Error("Amount paid cannot exceed total price");

  const agreement = createPurchaseAgreement({
    animalId: nextId,
    vendorId,
    totalAmount: price,
    amountPaid: isCustomerOwner ? paidNow : 0,
    notes: `Buy ${input.name || input.description}`,
  });

  let after = {
    ...db,
    purchase_agreements: [...(db.purchase_agreements ?? []), agreement],
  };

  if (paidNow > 0) {
    const tx = createCostTransaction({
      date: input.date,
      amount: paidNow,
      category: "Livestock Purchase",
      animalId: nextId,
      vendorId,
      notes: `Buy ${input.name || input.description}`,
      purchaseAgreementId: agreement.id,
    });
    const settledAgreement = applyPurchasePayment(agreement, paidNow);
    after = {
      ...after,
      transactions: [...after.transactions, tx],
      purchase_agreements: (after.purchase_agreements ?? []).map((a) =>
        a.id === agreement.id ? settledAgreement : a
      ),
    };
    if (isSupabaseDb()) {
      await applyWritePlan({
        upsertContacts: newContacts.length ? newContacts : undefined,
        upsertAnimals: [animal],
        upsertTransactions: [tx],
        upsertPurchaseAgreements: [settledAgreement],
      });
      return after;
    }
    return persistMutation(before, after);
  }

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: [animal],
      upsertPurchaseAgreements: [agreement],
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function acquireGoatFromCustomer(input: AcquireFromCustomerInput) {
  const before = await fetchDb();
  const result = applyAcquireFromCustomer(before, input);
  const updatedAnimal = result.db.animals.find((a) => a.id === input.animalId)!;

  if (result.transaction) {
    if (isSupabaseDb()) {
      await applyWritePlan({
        upsertAnimals: [updatedAnimal],
        upsertPurchaseAgreements: [result.agreement],
        upsertTransactions: [result.transaction],
      });
      return result.db;
    }
    return persistMutation(before, result.db);
  }

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertAnimals: [updatedAnimal],
      upsertPurchaseAgreements: [result.agreement],
    });
    return result.db;
  }
  return persistMutation(before, result.db);
}

export async function registerBornGoat(input: {
  date: string;
  breed: AnimalBreed;
  sex: AnimalSex;
  description: string;
  name?: string;
  ownerName: string;
  comment?: string;
  damId: number;
  sireId?: number | null;
  sireName?: string | null;
}) {
  const before = await fetchDb();
  let db = before;
  const ownerRes = resolveOwnerContact(db, input.ownerName);
  const newContacts: FarmDatabase["contacts"] = [];
  if (ownerRes.created) {
    newContacts.push(ownerRes.contact);
    db = { ...db, contacts: [...db.contacts, ownerRes.contact] };
  }
  const owner = ownerRes.contact;
  const dam = db.animals.find((a) => a.id === input.damId);
  if (!dam || dam.sex !== "Female") throw new Error("Select a valid dam (female goat)");

  const nextId = db.animals.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  const animal = {
    id: nextId,
    name: input.name || null,
    breed: input.breed,
    sex: input.sex,
    date_of_purchase: input.date,
    age_at_purchase: "0",
    description: input.description,
    comment: input.comment?.trim() || null,
    status: "Active" as const,
    price: 0,
    sold_price: null,
    purchased_from: null,
    owner_id: owner.id,
    home_bred: true,
    dam_id: input.damId,
    sire_id: input.sireId ?? null,
    sire_name: input.sireName?.trim() || null,
    out_date: null,
  };

  const activeBreeding = findActiveBreedingForDam(db.breeding_events, input.damId, {
    sireId: input.sireId,
    sireName: input.sireName,
  });
  const updatedBreeding = activeBreeding
    ? resolveBreedingAfterBirth(activeBreeding, input.date)
    : null;

  const after = {
    ...db,
    animals: [...db.animals, animal],
    breeding_events: updatedBreeding
      ? db.breeding_events.map((b) => (b.id === updatedBreeding.id ? updatedBreeding : b))
      : db.breeding_events,
  };

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: [animal],
      upsertBreeding: updatedBreeding ? [updatedBreeding] : undefined,
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function addPurchasePayment(input: {
  animalId: number;
  date: string;
  amount: number;
  notes?: string;
}) {
  const before = await fetchDb();
  const agreement = findPurchaseAgreement(before, input.animalId);
  if (!agreement) throw new Error("No purchase agreement for this goat");
  validatePurchasePaymentAmount(agreement, input.amount);

  const updatedAgreement = applyPurchasePayment(agreement, input.amount);
  const animal = before.animals.find((a) => a.id === input.animalId);
  const tx = createCostTransaction({
    date: input.date,
    amount: input.amount,
    category: "Livestock Purchase",
    animalId: input.animalId,
    vendorId: agreement.vendor_id,
    notes: input.notes || `Purchase payment — ${animal?.name || animal?.description || "goat"}`,
    purchaseAgreementId: agreement.id,
  });
  const after: FarmDatabase = {
    ...before,
    transactions: [...before.transactions, tx],
    purchase_agreements: (before.purchase_agreements ?? []).map((a) =>
      a.id === agreement.id ? updatedAgreement : a
    ),
  };

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertTransactions: [tx],
      upsertPurchaseAgreements: [updatedAgreement],
    });
    return after;
  }
  return persistMutation(before, after);
}

export async function addSaleReceipt(input: {
  animalId: number;
  date: string;
  amount: number;
  notes?: string;
}) {
  const before = await fetchDb();
  const sale = findSaleForAnimal(before, input.animalId);
  if (!sale) throw new Error("No sale agreement for this goat");

  if (isSupabaseDb()) {
    const { tx, sale: updatedSale } = buildSaleReceipt(before, sale, {
      date: input.date,
      amount: input.amount,
      notes: input.notes,
    });
    await applyWritePlan({
      upsertTransactions: [tx],
      upsertSales: [updatedSale],
    });
    return {
      ...before,
      transactions: [...before.transactions, tx],
      livestock_sales: (before.livestock_sales ?? []).map((s) =>
        s.id === updatedSale.id ? updatedSale : s
      ),
    };
  }

  const after = applySaleReceiptToDb(before, sale.id, {
    date: input.date,
    amount: input.amount,
    notes: input.notes,
  });
  return persistMutation(before, after);
}

export async function updateAnimal(input: UpdateAnimalInput) {
  const before = await fetchDb();
  const { db: after, newContacts } = applyUpdateAnimalDetails(before, input);
  const updated = after.animals.find((a) => a.id === input.id)!;
  const agreement = findPurchaseAgreement(after, input.id);
  const sale = findSaleForAnimal(after, input.id);

  if (isSupabaseDb()) {
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: [updated],
      upsertPurchaseAgreements: agreement ? [agreement] : undefined,
      upsertSales: sale ? [sale] : undefined,
    });
    return after;
  }
  return persistMutation(before, after);
}

export type LogMedicalInput = {
  animalIds: number[];
  eventType: MedicalEventType;
  date: string;
  notes?: string;
  comment?: string;
  product_brand?: string | null;
  active_ingredient?: string | null;
  drug_class?: string | null;
  route?: string | null;
  dose_amount?: number | null;
  dose_unit?: string | null;
  withdrawal_meat_days?: number | null;
  withdrawal_milk_days?: number | null;
  withdrawal_clear_date?: string | null;
  lot_number?: string | null;
  expiration_date?: string | null;
  famacha_score?: number | null;
  body_condition_score?: number | null;
  fecal_egg_count?: number | null;
  fec_reduction_pct?: number | null;
  prior_treatment_event_id?: string | null;
  production_stage?: string | null;
};

function buildMedicalEvent(animalId: number, input: LogMedicalInput): MedicalEvent {
  const withdrawalClear =
    input.withdrawal_clear_date ??
    computeWithdrawalClearDate(
      input.date,
      input.withdrawal_meat_days,
      input.withdrawal_milk_days
    );
  return {
    id: crypto.randomUUID(),
    animal_id: animalId,
    event_type: input.eventType,
    date: input.date,
    notes: input.notes || null,
    comment: input.comment?.trim() || null,
    transaction_id: null,
    product_brand: input.product_brand ?? null,
    active_ingredient: input.active_ingredient ?? null,
    drug_class: input.drug_class ?? null,
    route: input.route ?? null,
    dose_amount: input.dose_amount ?? null,
    dose_unit: input.dose_unit ?? null,
    withdrawal_meat_days: input.withdrawal_meat_days ?? null,
    withdrawal_milk_days: input.withdrawal_milk_days ?? null,
    withdrawal_clear_date: withdrawalClear,
    lot_number: input.lot_number ?? null,
    expiration_date: input.expiration_date ?? null,
    famacha_score: input.famacha_score ?? null,
    body_condition_score: input.body_condition_score ?? null,
    fecal_egg_count: input.fecal_egg_count ?? null,
    fec_reduction_pct: input.fec_reduction_pct ?? null,
    prior_treatment_event_id: input.prior_treatment_event_id ?? null,
    production_stage: input.production_stage ?? null,
  };
}

export async function logMedical(input: LogMedicalInput) {
  const animalIds = [...new Set(input.animalIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (animalIds.length === 0) throw new Error("Select at least one goat");

  const events = animalIds.map((animalId) => buildMedicalEvent(animalId, input));
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertMedical: events });
    return;
  }
  const before = await fetchDb();
  const after = {
    ...before,
    medical_events: [...before.medical_events, ...events],
  };
  return persistMutation(before, after);
}

async function loadVaccineEvent(id: string): Promise<{
  event: MedicalEvent;
  similar: MedicalEvent[];
}> {
  if (!isSupabaseDb()) {
    const db = await fetchDb();
    const event = db.medical_events.find((m) => m.id === id);
    if (!event) throw new Error("Vaccination not found");
    if (event.event_type !== "Vaccine") throw new Error("Not a vaccination");
    return { event, similar: similarVaccineEvents(db.medical_events, event) };
  }

  const client = createServiceClient();
  const { data, error } = await client.from("medical_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vaccination not found");
  const event = mapMedical(data);
  if (event.event_type !== "Vaccine") throw new Error("Not a vaccination");

  let similarQuery = client.from("medical_events").select("*").eq("event_type", "Vaccine");
  if (event.date) similarQuery = similarQuery.eq("date", event.date);
  else similarQuery = similarQuery.is("date", null);
  const { data: rows, error: similarError } = await similarQuery;
  if (similarError) throw new Error(similarError.message);
  const similar = similarVaccineEvents((rows ?? []).map(mapMedical), event);
  return { event, similar };
}

function vaccineTargets(event: MedicalEvent, similar: MedicalEvent[], applySimilar: boolean): MedicalEvent[] {
  return applySimilar ? [event, ...similar] : [event];
}

export async function updateVaccineEvents(input: {
  id: string;
  date: string;
  notes: string;
  applySimilar: boolean;
}): Promise<{ animalIds: number[] }> {
  const date = input.date.trim().slice(0, 10);
  if (!date) throw new Error("Date is required");
  const notes = input.notes.trim();
  if (!notes) throw new Error("Enter a vaccine name");

  const { event, similar } = await loadVaccineEvent(input.id);
  const targets = vaccineTargets(event, similar, input.applySimilar);
  const updated = targets.map((row) => ({ ...row, date, notes }));

  if (isSupabaseDb()) {
    await applyWritePlan({ upsertMedical: updated });
    return { animalIds: [...new Set(updated.map((row) => row.animal_id))] };
  }

  const before = await fetchDb();
  const byId = new Map(updated.map((row) => [row.id, row]));
  const after = {
    ...before,
    medical_events: before.medical_events.map((row) => byId.get(row.id) ?? row),
  };
  await persistMutation(before, after);
  return { animalIds: [...new Set(updated.map((row) => row.animal_id))] };
}

export async function deleteVaccineEvents(input: {
  id: string;
  applySimilar: boolean;
}): Promise<{ animalIds: number[] }> {
  const { event, similar } = await loadVaccineEvent(input.id);
  const targets = vaccineTargets(event, similar, input.applySimilar);
  const ids = targets.map((row) => row.id);
  const animalIds = [...new Set(targets.map((row) => row.animal_id))];

  if (isSupabaseDb()) {
    await applyWritePlan({ deleteMedicalIds: ids });
    return { animalIds };
  }

  const before = await fetchDb();
  const remove = new Set(ids);
  const after = {
    ...before,
    medical_events: before.medical_events.filter((row) => !remove.has(row.id)),
  };
  await persistMutation(before, after);
  return { animalIds };
}

export async function recordBreeding(input: {
  femaleId: number;
  buckName: string;
  maleAnimalId?: number | null;
  dateCrossed?: string;
  exposureStart?: string;
  exposureEnd?: string;
  notes?: string;
}) {
  const before = await fetchDb();
  assertFemaleAvailableForBreeding(before.breeding_events, input.femaleId);
  let maleAnimalId: number | null = input.maleAnimalId ?? null;
  let buckName = input.buckName.trim();
  if (maleAnimalId != null) {
    const male = before.animals.find((a) => a.id === maleAnimalId);
    if (!male) throw new Error("Buck animal not found");
    if (!buckName) buckName = animalLabel(male);
  } else {
    maleAnimalId = null;
  }
  const exposureStart = (input.exposureStart ?? input.dateCrossed ?? "").trim();
  const exposureEnd = (input.exposureEnd ?? exposureStart).trim();
  if (!exposureStart || !exposureEnd) throw new Error("Exposure dates are required");
  const dueDates = computeBreedingDueDates(
    exposureStart,
    exposureEnd,
    before.farm_settings
  );
  const event = {
    id: crypto.randomUUID(),
    female_animal_id: input.femaleId,
    male_animal_id: maleAnimalId,
    buck_name: buckName || null,
    ...dueDates,
    delivered_date: null,
    ultrasound_date: null,
    fetus_count: null,
    outcome: "Pending" as const,
    status: "Doubt" as const,
    notes: input.notes || null,
  };
  const after = {
    ...before,
    breeding_events: [...before.breeding_events, event],
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertBreeding: [event] });
    return after;
  }
  return persistMutation(before, after);
}

export async function updateBreeding(input: {
  id: string;
  buckName: string;
  maleAnimalId?: number | null;
  dateCrossed?: string;
  exposureStart?: string;
  exposureEnd?: string;
  outcome: BreedingOutcome;
  status: BreedingStatus | "";
  deliveredDate?: string | null;
  ultrasoundDate?: string | null;
  fetusCount?: number | null;
  notes?: string | null;
}) {
  const before = await fetchDb();
  const existing = before.breeding_events.find((b) => b.id === input.id);
  if (!existing) throw new Error("Breeding record not found");

  const nextOutcome = input.outcome;
  let resolvedStatus: BreedingStatus | null = input.status || null;
  const willBeInPipeline =
    nextOutcome !== "Delivered" &&
    nextOutcome !== "Stillbirth" &&
    nextOutcome !== "Miscarriage" &&
    (nextOutcome === "Pending" || nextOutcome === "Doubt" || resolvedStatus === "Doubt");

  if (willBeInPipeline) {
    assertFemaleAvailableForBreeding(before.breeding_events, existing.female_animal_id, input.id);
  }

  const maleAnimalId: number | null = input.maleAnimalId ?? null;
  let buckName = input.buckName.trim();
  if (maleAnimalId != null) {
    const male = before.animals.find((a) => a.id === maleAnimalId);
    if (!male) throw new Error("Buck animal not found");
    if (!buckName) buckName = animalLabel(male);
  }

  const deliveredDate =
    input.deliveredDate?.trim() ||
    (nextOutcome === "Delivered" ? existing.delivered_date : null) ||
    null;

  const ultrasoundDate =
    input.ultrasoundDate !== undefined
      ? input.ultrasoundDate?.trim() || null
      : existing.ultrasound_date;
  const fetusCount =
    input.fetusCount !== undefined ? input.fetusCount : existing.fetus_count;
  if (ultrasoundDate && (resolvedStatus === "Doubt" || !resolvedStatus)) {
    resolvedStatus = "Ready";
  }
  let resolvedOutcome: BreedingOutcome = nextOutcome;
  if (ultrasoundDate && resolvedOutcome === "Doubt") {
    resolvedOutcome = "Pending";
  }

  const exposureStart = (input.exposureStart ?? input.dateCrossed ?? existing.exposure_start_date ?? existing.date_crossed ?? "").trim();
  const exposureEnd = (input.exposureEnd ?? exposureStart).trim();
  const dueDates = exposureStart && exposureEnd
    ? computeBreedingDueDates(exposureStart, exposureEnd, before.farm_settings)
    : null;

  const updated = {
    ...existing,
    male_animal_id: maleAnimalId,
    buck_name: buckName || null,
    ...(dueDates ?? {}),
    delivered_date: nextOutcome === "Delivered" ? deliveredDate : null,
    ultrasound_date: ultrasoundDate,
    fetus_count: fetusCount,
    outcome: resolvedOutcome,
    status: resolvedStatus,
    notes: input.notes?.trim() || null,
  };

  const after = {
    ...before,
    breeding_events: before.breeding_events.map((b) => (b.id === updated.id ? updated : b)),
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertBreeding: [updated] });
    return after;
  }
  return persistMutation(before, after);
}

export async function deleteBreeding(id: string) {
  const before = await fetchDb();
  const existing = before.breeding_events.find((b) => b.id === id);
  if (!existing) throw new Error("Breeding record not found");

  const after = {
    ...before,
    breeding_events: before.breeding_events.filter((b) => b.id !== id),
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ deleteBreedingIds: [id] });
    return after;
  }
  return persistMutation(before, after);
}

export async function recordBreedingUltrasounds(input: {
  records: Array<{ id: string; femaleId: number }>;
  ultrasoundDate: string;
  status?: BreedingStatus | "";
  fetusCount?: number | null;
  comments?: string | null;
  file?: File | null;
}) {
  if (input.records.length === 0) {
    throw new Error("Select at least one goat to record ultrasound");
  }

  const ultrasoundDate = input.ultrasoundDate.trim().slice(0, 10);
  if (!ultrasoundDate) throw new Error("Ultrasound date is required");

  const before = await fetchDb();
  const updated: BreedingEvent[] = [];

  for (const record of input.records) {
    const existing = before.breeding_events.find((b) => b.id === record.id);
    if (!existing) throw new Error("Breeding record not found");
    if (existing.female_animal_id !== record.femaleId) {
      throw new Error("Breeding record does not match selected goat");
    }

    if (input.file?.size) {
      await uploadAnimalMedia({
        animalId: record.femaleId,
        file: input.file,
        caption: `Ultrasound ${ultrasoundDate}`,
      });
    }

    const { status, outcome } = resolveBreedingAfterUltrasound(existing, input.fetusCount);

    updated.push({
      ...existing,
      ultrasound_date: ultrasoundDate,
      fetus_count: input.fetusCount !== undefined ? input.fetusCount : (existing.fetus_count ?? null),
      status,
      outcome,
      notes: mergeUltrasoundNotes(existing.notes, input.comments, ultrasoundDate),
    });
  }

  const updatedById = new Map(updated.map((b) => [b.id, b]));
  const after = {
    ...before,
    breeding_events: before.breeding_events.map((b) => updatedById.get(b.id) ?? b),
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertBreeding: updated });
    return after;
  }
  return persistMutation(before, after);
}

function mergeUltrasoundNotes(
  existing: string | null,
  comment: string | null | undefined,
  ultrasoundDate: string
): string | null {
  const trimmed = comment?.trim();
  if (!trimmed) return existing;
  const entry = `Ultrasound ${ultrasoundDate}: ${trimmed}`;
  return existing?.trim() ? `${existing.trim()}\n${entry}` : entry;
}

export async function recordBreedingUltrasound(input: {
  id: string;
  femaleId: number;
  ultrasoundDate: string;
  status?: BreedingStatus | "";
  fetusCount?: number | null;
  comments?: string | null;
  file?: File | null;
}) {
  return recordBreedingUltrasounds({
    records: [{ id: input.id, femaleId: input.femaleId }],
    ultrasoundDate: input.ultrasoundDate,
    status: input.status,
    fetusCount: input.fetusCount,
    comments: input.comments,
    file: input.file,
  });
}

export async function logWeight(input: {
  animalId: number;
  weighedOn: string;
  weightKg: number;
  notes?: string;
}) {
  const before = await fetchDb();
  const animal = before.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");
  if (!input.weightKg || input.weightKg <= 0) throw new Error("Weight must be positive");

  const entry = {
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    weighed_on: input.weighedOn,
    weight_kg: input.weightKg,
    notes: input.notes || null,
  };
  const after = {
    ...before,
    weight_logs: [...(before.weight_logs ?? []), entry],
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertWeights: [entry] });
    return after;
  }
  return persistMutation(before, after);
}

export async function changeStatus(input: {
  animalId: number;
  status: AnimalStatus;
  outDate?: string;
}) {
  const before = await fetchDb();
  const animal = before.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");
  const updated = {
    ...animal,
    status: input.status,
    out_date: input.outDate ?? animal.out_date,
  };
  const after = {
    ...before,
    animals: before.animals.map((a) => (a.id === updated.id ? updated : a)),
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertAnimals: [updated] });
    return after;
  }
  return persistMutation(before, after);
}

export async function deleteSaleReceipt(txId: string) {
  const before = await fetchDb();
  const after = applyDeleteSaleReceipt(before, txId);
  return persistMutation(before, after);
}

export async function undoLivestockSale(animalId: number) {
  const before = await fetchDb();
  const after = applyUndoLivestockSaleForAnimal(before, animalId);
  return persistMutation(before, after);
}

export async function recordLivestockSale(input: {
  date: string;
  animalId: number;
  additionalAnimalIds?: number[];
  grossSalePrice: number;
  deliveryCost?: number;
  amountReceivedNow?: number | null;
  customerId?: string | null;
  buyerName?: string | null;
  notes?: string;
}) {
  const before = await fetchDb();
  let db = before;
  const newContacts: FarmDatabase["contacts"] = [];
  let customerId = input.customerId ?? null;

  if (!customerId && input.buyerName?.trim()) {
    const customerRes = resolveCustomer(db, input.buyerName);
    if (customerRes.contact) {
      newContacts.push(customerRes.contact);
      db = { ...db, contacts: [...db.contacts, customerRes.contact] };
    }
    customerId = customerRes.id;
  }

  const saleInput = {
    date: input.date,
    animalId: input.animalId,
    additionalAnimalIds: input.additionalAnimalIds,
    grossSalePrice: input.grossSalePrice,
    deliveryCost: input.deliveryCost,
    amountReceivedNow: input.amountReceivedNow,
    customerId,
    notes: input.notes ?? null,
  };

  if (isSupabaseDb()) {
    const result = beginLivestockSale(db, saleInput);
    const animalIds = new Set(result.sale.animal_ids);
    await applyWritePlan({
      upsertContacts: newContacts.length ? newContacts : undefined,
      upsertAnimals: result.animals.filter((a) => animalIds.has(a.id)),
      upsertTransactions: result.tx ? [result.tx] : undefined,
      upsertSales: [result.sale],
    });
    return {
      ...before,
      contacts: newContacts.length ? [...before.contacts, ...newContacts] : before.contacts,
      animals: result.animals,
      transactions: result.tx ? [...before.transactions, result.tx] : before.transactions,
      livestock_sales: [...(before.livestock_sales ?? []), result.sale],
    };
  }

  const after = applyLivestockSaleToDb(db, saleInput);
  return persistMutation(before, after);
}

export async function updateTransaction(input: UpdateTransactionInput) {
  const before = await fetchDb();
  const after = applyUpdateTransaction(before, input);
  return persistMutation(before, after);
}

export async function deleteTransaction(id: string) {
  const before = await fetchDb();
  const after = applyDeleteTransaction(before, id);
  return persistMutation(before, after);
}

export async function deleteAnimal(animalId: number) {
  const before = await fetchDb();
  const after = applyDeleteAnimal(before, animalId);
  return persistMutation(before, after);
}

export async function logMilkRecord(input: {
  animalId: number;
  date: string;
  session: MilkSession;
  amount: number;
  unit: MilkUnit;
  measurementMethod?: MilkMeasurementMethod;
  source?: MilkSource;
  operator?: string;
  notes?: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Milk amount must be greater than zero");
  }
  const record: MilkRecord = {
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    date: input.date,
    session: input.session,
    amount_raw: input.amount,
    unit_entered: input.unit,
    amount_lb_normalized: normalizeMilkToLb(input.amount, input.unit),
    measurement_method: input.measurementMethod ?? "scale",
    source: input.source ?? "farm-entered",
    operator: input.operator?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertMilk: [record] });
    return;
  }
  const before = await fetchDb();
  const after = {
    ...before,
    milk_records: [...before.milk_records, record],
  };
  return persistMutation(before, after);
}

export async function recordLactation(input: {
  animalId: number;
  fresheningDate: string;
  lactationNumber?: number;
  dryOffDate?: string | null;
  notes?: string;
}) {
  const lactation: Lactation = {
    id: crypto.randomUUID(),
    animal_id: input.animalId,
    freshening_date: input.fresheningDate,
    lactation_number: input.lactationNumber ?? 1,
    dry_off_date: input.dryOffDate?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertLactations: [lactation] });
    return;
  }
  const before = await fetchDb();
  const after = {
    ...before,
    lactations: [...before.lactations, lactation],
  };
  return persistMutation(before, after);
}

export async function upsertVetContact(input: {
  id?: string;
  role: VetContactRole;
  name: string;
  phone?: string;
  emergencyPhone?: string;
  address?: string;
  servicesOffered?: string;
  acceptsNewClients?: string;
  vcprEstablished?: string;
  notes?: string;
}) {
  const contact: VetContact = {
    id: input.id ?? crypto.randomUUID(),
    role: input.role,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    emergency_phone: input.emergencyPhone?.trim() || null,
    address: input.address?.trim() || null,
    services_offered: input.servicesOffered?.trim() || null,
    accepts_new_clients: input.acceptsNewClients?.trim() || "unknown",
    vcpr_established: input.vcprEstablished?.trim() || "unknown",
    notes: input.notes?.trim() || null,
  };
  if (!contact.name) throw new Error("Vet name is required");
  if (isSupabaseDb()) {
    await applyWritePlan({ upsertVetContacts: [contact] });
    return contact;
  }
  const before = await fetchDb();
  const existing = before.vet_contacts.find((v) => v.id === contact.id);
  const vet_contacts = existing
    ? before.vet_contacts.map((v) => (v.id === contact.id ? contact : v))
    : [...before.vet_contacts, contact];
  await persistMutation(before, { ...before, vet_contacts });
  return contact;
}

export async function deleteVetContact(id: string) {
  if (isSupabaseDb()) {
    await applyWritePlan({ deleteVetContactIds: [id] });
    return;
  }
  const before = await fetchDb();
  const after = {
    ...before,
    vet_contacts: before.vet_contacts.filter((v) => v.id !== id),
  };
  return persistMutation(before, after);
}
