/**
 * Targeted page loaders — fetch only the tables each screen needs.
 * Falls back to full fetchDb() when Supabase is not configured (JSON mode).
 */
import { cache } from "react";
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
import { emptyDb } from "../db-empty";
import { getCachedDb, isSupabaseDb } from "../db";
import { createServiceClient } from "../supabase/admin";
import {
  mapBreeding,
  mapContact,
  mapFarmSettings,
  mapLactation,
  mapMedia,
  mapMedical,
  mapMeta,
  mapPurchaseAgreement,
  mapSale,
  mapAnimal,
  mapTx,
  mapWeight,
  mapVetContact,
  selectAll,
  selectAllOptional,
} from "./supabase";
import { quickEntryPropsFromDb, quickEntryPropsForProfile } from "../quick-entry-props";
import { mapAnimalsWithParents } from "../livestock/animal-parents-store";
import { computeHerdHealth, type HerdHealthData } from "../livestock/herd-health";
import { mergeVaccineSchedules, type VaccineScheduleEntry } from "../livestock/vaccine-schedule";
import type { QuickEntryProps } from "@/components/QuickEntry";
import type { SupabaseClient } from "@supabase/supabase-js";

async function selectWhere(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string | number
) {
  const { data, error } = await client.from(table).select("*").eq(column, value);
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function selectOne(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string | number
) {
  const { data, error } = await client.from(table).select("*").eq(column, value).maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? null) as Record<string, unknown> | null;
}

async function selectSalesForAnimal(client: SupabaseClient, animalId: number) {
  const { data, error } = await client
    .from("livestock_sales")
    .select("*")
    .contains("animal_ids", [animalId]);
  if (error) throw new Error(`livestock_sales: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function selectPastBuckNames(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.from("breeding_events").select("buck_name");
  if (error) throw new Error(`breeding_events: ${error.message}`);
  return [
    ...new Set(
      (data ?? [])
        .map((row) => (row as { buck_name?: string | null }).buck_name)
        .filter((n): n is string => Boolean(n && n.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function filterLedgerTxs(rows: Record<string, unknown>[]): Transaction[] {
  return rows
    .map(mapTx)
    .filter((t) => t.kind === "cost" || t.kind === "income");
}

/** Shared QuickEntry props — active animals, contacts, buck names. */
export const getQuickEntryData = cache(async (): Promise<QuickEntryProps> => {
  if (!isSupabaseDb()) {
    return quickEntryPropsFromDb(await getCachedDb());
  }
  const client = createServiceClient();
  const [animals, contacts, breeding, transactions, medical] =
    await Promise.all([
      selectAll(client, "animals"),
      selectAll(client, "contacts"),
      selectAll(client, "breeding_events"),
      selectAll(client, "transactions"),
      selectAllOptional(client, "medical_events"),
    ]);
  const db = emptyDb();
  db.animals = await mapAnimalsWithParents(client, animals);
  db.contacts = contacts.map(mapContact);
  db.breeding_events = breeding.map(mapBreeding);
  db.transactions = filterLedgerTxs(transactions);
  db.medical_events = medical.map(mapMedical);
  return quickEntryPropsFromDb(db);
});

export type HomePageData = {
  animals: Animal[];
  lactations: FarmDatabase["lactations"];
  breeding_events: BreedingEvent[];
  medical_events: MedicalEvent[];
  farm_settings: FarmDatabase["farm_settings"];
  herd: HerdHealthData;
};

/** Single loader for `/` — avoids duplicate table fetches and full herd-health recompute. */
export const loadHomePageData = cache(async (): Promise<HomePageData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    const medicalEvents = db.medical_events ?? [];
    return {
      animals: db.animals,
      lactations: db.lactations ?? [],
      breeding_events: db.breeding_events ?? [],
      medical_events: medicalEvents,
      farm_settings: db.farm_settings,
      herd: computeHerdHealth({
        animals: db.animals,
        medical_events: medicalEvents,
        breeding_events: db.breeding_events ?? [],
        weight_logs: db.weight_logs ?? [],
      }),
    };
  }

  const client = createServiceClient();
  const [animalRows, lactations, breeding, medical, weights, farmSettingsRows] =
    await Promise.all([
      selectAll(client, "animals"),
      selectAllOptional(client, "lactations"),
      selectAllOptional(client, "breeding_events"),
      selectAllOptional(client, "medical_events"),
      selectAllOptional(client, "weight_logs"),
      selectAllOptional(client, "farm_settings"),
    ]);

  const mappedAnimals = await mapAnimalsWithParents(client, animalRows);
  const medicalEvents = medical.map(mapMedical);
  const breedingEvents = breeding.map(mapBreeding);

  return {
    animals: mappedAnimals,
    lactations: lactations.map(mapLactation),
    breeding_events: breedingEvents,
    medical_events: medicalEvents,
    farm_settings: mapFarmSettings(farmSettingsRows[0]),
    herd: computeHerdHealth({
      animals: mappedAnimals,
      medical_events: medicalEvents,
      breeding_events: breedingEvents,
      weight_logs: weights.map(mapWeight),
    }),
  };
});

export type VetContactsData = {
  vet_contacts: FarmDatabase["vet_contacts"];
};

export const loadVetContactsData = cache(async (): Promise<VetContactsData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return { vet_contacts: db.vet_contacts ?? [] };
  }
  const client = createServiceClient();
  const vetContacts = await selectAllOptional(client, "vet_contacts");
  return { vet_contacts: vetContacts.map(mapVetContact) };
});

export type MilkLogData = {
  animals: Animal[];
  lactations: FarmDatabase["lactations"];
};

export const loadMilkLogData = cache(async (): Promise<MilkLogData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return { animals: db.animals, lactations: db.lactations ?? [] };
  }
  const client = createServiceClient();
  const [animals, lactations] = await Promise.all([
    selectAll(client, "animals"),
    selectAllOptional(client, "lactations"),
  ]);
  return {
    animals: animals.map(mapAnimal),
    lactations: lactations.map(mapLactation),
  };
});

/** @deprecated Prefer loadHomePageData for the dashboard; kept for diagnostics. */
export type HomeData = HomePageData & {
  contacts: Contact[];
  transactions: Transaction[];
  vet_contacts: FarmDatabase["vet_contacts"];
  meta: FarmDatabase["meta"];
  quickEntry: QuickEntryProps;
};

/** @deprecated Prefer loadHomePageData — loads extra tables for /api/health-check only. */
export const loadHomeData = cache(async (): Promise<HomeData> => {
  const home = await loadHomePageData();
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      ...home,
      contacts: db.contacts,
      transactions: db.transactions,
      vet_contacts: db.vet_contacts,
      meta: db.meta,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [contacts, transactions, metaRows, vetContacts] = await Promise.all([
    selectAll(client, "contacts"),
    selectAll(client, "transactions"),
    selectAll(client, "app_meta"),
    selectAllOptional(client, "vet_contacts"),
  ]);
  const mappedContacts = contacts.map(mapContact);
  const quickEntryDb = emptyDb();
  quickEntryDb.animals = home.animals;
  quickEntryDb.contacts = mappedContacts;
  quickEntryDb.breeding_events = home.breeding_events;
  quickEntryDb.medical_events = home.medical_events;
  quickEntryDb.transactions = filterLedgerTxs(transactions);

  return {
    ...home,
    contacts: mappedContacts,
    transactions: quickEntryDb.transactions,
    vet_contacts: vetContacts.map(mapVetContact),
    meta: mapMeta(metaRows[0]),
    quickEntry: quickEntryPropsFromDb(quickEntryDb),
  };
});

export type AnimalsListData = {
  animals: Animal[];
  contacts: Contact[];
  breeding_events: BreedingEvent[];
  lactations: FarmDatabase["lactations"];
  medical_events: MedicalEvent[];
};

export const loadAnimalsListData = cache(async (): Promise<AnimalsListData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      animals: db.animals,
      contacts: db.contacts,
      breeding_events: db.breeding_events,
      lactations: db.lactations ?? [],
      medical_events: db.medical_events,
    };
  }

  const client = createServiceClient();
  const [animals, contacts, breeding, lactations, medical] = await Promise.all([
    selectAll(client, "animals"),
    selectAll(client, "contacts"),
    selectAll(client, "breeding_events"),
    selectAllOptional(client, "lactations"),
    selectAllOptional(client, "medical_events"),
  ]);

  return {
    animals: await mapAnimalsWithParents(client, animals),
    contacts: contacts.map(mapContact),
    breeding_events: breeding.map(mapBreeding),
    lactations: lactations.map(mapLactation),
    medical_events: medical.map(mapMedical),
  };
});

export type AnimalProfileData = {
  animal: Animal;
  animals: Animal[];
  contacts: Contact[];
  medical_events: MedicalEvent[];
  herd_vaccine_events: MedicalEvent[];
  breeding_events: BreedingEvent[];
  transactions: Transaction[];
  livestock_sales: LivestockSale[];
  purchase_agreement: PurchaseAgreement | null;
  purchase_balance: number;
  sale_balance: number | null;
  weight_logs: WeightLog[];
  animal_media: AnimalMedia[];
  quickEntry: ReturnType<typeof quickEntryPropsForProfile>;
};

function profileTransactions(
  db: FarmDatabase,
  animalId: number,
  sales: LivestockSale[]
): Transaction[] {
  const saleIds = new Set(sales.map((s) => s.id));
  return db.transactions.filter(
    (t) =>
      t.animal_id === animalId ||
      (t.livestock_sale_id != null && saleIds.has(t.livestock_sale_id)) ||
      (t.purchase_agreement_id != null &&
        db.purchase_agreements?.some(
          (a) => a.id === t.purchase_agreement_id && a.animal_id === animalId
        ))
  );
}

function resolvePurchaseAgreement(
  db: FarmDatabase,
  animal: Animal
): { agreement: PurchaseAgreement | null; balance: number } {
  const agreements = (db.purchase_agreements ?? []).filter((a) => a.animal_id === animal.id);
  const agreement = agreements.length > 0 ? agreements[agreements.length - 1] : null;
  if (agreement) {
    return {
      agreement,
      balance: Math.max(0, agreement.total_amount - agreement.amount_paid),
    };
  }
  const paid = db.transactions
    .filter(
      (t) =>
        t.kind === "cost" &&
        t.category === "Livestock Purchase" &&
        t.animal_id === animal.id
    )
    .reduce((sum, t) => sum + t.amount, 0);
  if (animal.price <= 0) return { agreement: null, balance: 0 };
  return { agreement: null, balance: Math.max(0, animal.price - paid) };
}

export const loadAnimalProfileData = cache(
  async (animalId: number): Promise<AnimalProfileData | null> => {
    if (!isSupabaseDb()) {
      const db = await getCachedDb();
      const animal = db.animals.find((a) => a.id === animalId);
      if (!animal) return null;
      const saleMeta = (db.livestock_sales ?? []).filter((s) => s.animal_ids.includes(animalId));
      const purchase = resolvePurchaseAgreement(db, animal);
      const sale = saleMeta[0];
      const herdVaccines = db.medical_events.filter((m) => m.event_type === "Vaccine");
      const pastBuckNames = [
        ...new Set(
          db.breeding_events
            .map((b) => b.buck_name)
            .filter((n): n is string => Boolean(n && n.trim()))
        ),
      ].sort((a, b) => a.localeCompare(b));
      return {
        animal,
        animals: db.animals,
        contacts: db.contacts,
        medical_events: db.medical_events.filter((m) => m.animal_id === animalId),
        herd_vaccine_events: herdVaccines,
        breeding_events: db.breeding_events.filter((b) => b.female_animal_id === animalId),
        transactions: profileTransactions(db, animalId, saleMeta),
        livestock_sales: saleMeta,
        purchase_agreement: purchase.agreement,
        purchase_balance: purchase.balance,
        sale_balance: sale ? Math.max(0, sale.net_received - sale.amount_received) : null,
        weight_logs: db.weight_logs.filter((w) => w.animal_id === animalId),
        animal_media: (db.animal_media ?? []).filter((m) => m.animal_id === animalId),
        quickEntry: quickEntryPropsForProfile(
          db.contacts,
          db.animals,
          pastBuckNames,
          mergeVaccineSchedules(herdVaccines)
        ),
      };
    }

    const client = createServiceClient();
    const [animalRow, contacts, allAnimals, medical, herdVaccines, breeding, sales, purchaseRows, weights, media, pastBuckNames] =
      await Promise.all([
        selectOne(client, "animals", "id", animalId),
        selectAll(client, "contacts"),
        selectAll(client, "animals"),
        selectWhere(client, "medical_events", "animal_id", animalId),
        selectWhere(client, "medical_events", "event_type", "Vaccine"),
        selectWhere(client, "breeding_events", "female_animal_id", animalId),
        selectSalesForAnimal(client, animalId),
        selectWhere(client, "purchase_agreements", "animal_id", animalId),
        selectWhere(client, "weight_logs", "animal_id", animalId),
        selectWhere(client, "animal_media", "animal_id", animalId),
        selectPastBuckNames(client),
      ]);

    if (!animalRow) return null;

    const mappedSales = sales.map(mapSale).filter((s) => s.animal_ids.includes(animalId));
    const mappedAgreements = purchaseRows.map(mapPurchaseAgreement);
    const saleIds = mappedSales.map((s) => s.id);
    const agreementIds = mappedAgreements.map((a) => a.id);

    const { data: animalTxRows, error: animalTxErr } = await client
      .from("transactions")
      .select("*")
      .eq("animal_id", animalId);
    if (animalTxErr) throw new Error(`transactions: ${animalTxErr.message}`);

    const extraTxPromises: Promise<Record<string, unknown>[]>[] = [];
    if (saleIds.length > 0) {
      extraTxPromises.push(
        (async () => {
          const { data, error } = await client
            .from("transactions")
            .select("*")
            .in("livestock_sale_id", saleIds);
          if (error) throw new Error(`transactions: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        })()
      );
    }
    if (agreementIds.length > 0) {
      extraTxPromises.push(
        (async () => {
          const { data, error } = await client
            .from("transactions")
            .select("*")
            .in("purchase_agreement_id", agreementIds);
          if (error) throw new Error(`transactions: ${error.message}`);
          return (data ?? []) as Record<string, unknown>[];
        })()
      );
    }
    const extraTxRows = (await Promise.all(extraTxPromises)).flat();

    const txById = new Map<string, Transaction>();
    for (const row of [...(animalTxRows ?? []), ...extraTxRows]) {
      const tx = mapTx(row as Record<string, unknown>);
      if (tx.kind === "cost" || tx.kind === "income") {
        txById.set(tx.id, tx);
      }
    }

    const mappedAllAnimals = await mapAnimalsWithParents(client, allAnimals);
    const animal = mappedAllAnimals.find((a) => a.id === animalId);
    if (!animal) return null;
    const mappedContacts = contacts.map(mapContact);
    const mappedHerdVaccines = herdVaccines.map(mapMedical);
    const miniDb = emptyDb();
    miniDb.animals = [animal];
    miniDb.transactions = [...txById.values()];
    miniDb.purchase_agreements = mappedAgreements;
    miniDb.livestock_sales = mappedSales;
    const purchase = resolvePurchaseAgreement(miniDb, animal);
    const sale = mappedSales[0];

    return {
      animal,
      animals: mappedAllAnimals,
      contacts: mappedContacts,
      medical_events: medical.map(mapMedical),
      herd_vaccine_events: mappedHerdVaccines,
      breeding_events: breeding.map(mapBreeding),
      transactions: profileTransactions(miniDb, animalId, mappedSales),
      livestock_sales: mappedSales,
      purchase_agreement: purchase.agreement,
      purchase_balance: purchase.balance,
      sale_balance: sale ? Math.max(0, sale.net_received - sale.amount_received) : null,
      weight_logs: weights.map(mapWeight),
      animal_media: media.map(mapMedia),
      quickEntry: quickEntryPropsForProfile(
        mappedContacts,
        mappedAllAnimals,
        pastBuckNames,
        mergeVaccineSchedules(mappedHerdVaccines)
      ),
    };
  }
);

export type TransactionsData = {
  transactions: Transaction[];
  contacts: Contact[];
  animals: Animal[];
  livestock_sales: LivestockSale[];
  quickEntry: QuickEntryProps;
};

export const loadTransactionsData = cache(async (): Promise<TransactionsData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    return {
      transactions: db.transactions,
      contacts: db.contacts,
      animals: db.animals,
      livestock_sales: db.livestock_sales,
      quickEntry: quickEntryPropsFromDb(db),
    };
  }

  const client = createServiceClient();
  const [transactions, contacts, animals, sales, breeding, medical] =
    await Promise.all([
      selectAll(client, "transactions"),
      selectAll(client, "contacts"),
      selectAll(client, "animals"),
      selectAll(client, "livestock_sales"),
      selectAll(client, "breeding_events"),
      selectAllOptional(client, "medical_events"),
    ]);

  const mappedAnimals = await mapAnimalsWithParents(client, animals);
  const mappedContacts = contacts.map(mapContact);
  const db = emptyDb();
  db.animals = mappedAnimals;
  db.contacts = mappedContacts;
  db.breeding_events = breeding.map(mapBreeding);
  db.medical_events = medical.map(mapMedical);
  db.transactions = filterLedgerTxs(transactions);

  return {
    transactions: db.transactions,
    contacts: mappedContacts,
    animals: mappedAnimals,
    livestock_sales: sales.map(mapSale),
    quickEntry: quickEntryPropsFromDb(db),
  };
});

export type HerdHealthPageData = {
  herd: HerdHealthData;
  quickEntry: QuickEntryProps;
  vaccineSchedules: VaccineScheduleEntry[];
};

export const loadHerdHealthData = cache(async (): Promise<HerdHealthPageData> => {
  if (!isSupabaseDb()) {
    const db = await getCachedDb();
    const medicalEvents = db.medical_events ?? [];
    return {
      herd: computeHerdHealth({
        animals: db.animals,
        medical_events: medicalEvents,
        breeding_events: db.breeding_events ?? [],
        weight_logs: db.weight_logs ?? [],
      }),
      quickEntry: quickEntryPropsFromDb(db),
      vaccineSchedules: mergeVaccineSchedules(medicalEvents),
    };
  }

  const client = createServiceClient();
  const [animals, medical, breeding, weights, contacts, transactions] = await Promise.all([
    selectAll(client, "animals"),
    selectAllOptional(client, "medical_events"),
    selectAllOptional(client, "breeding_events"),
    selectAllOptional(client, "weight_logs"),
    selectAll(client, "contacts"),
    selectAll(client, "transactions"),
  ]);

  const mappedAnimals = await mapAnimalsWithParents(client, animals);
  const medicalEvents = medical.map(mapMedical);
  const quickEntryDb = emptyDb();
  quickEntryDb.animals = mappedAnimals;
  quickEntryDb.contacts = contacts.map(mapContact);
  quickEntryDb.breeding_events = breeding.map(mapBreeding);
  quickEntryDb.medical_events = medicalEvents;
  quickEntryDb.transactions = filterLedgerTxs(transactions);

  return {
    herd: computeHerdHealth({
      animals: mappedAnimals,
      medical_events: medicalEvents,
      breeding_events: breeding.map(mapBreeding),
      weight_logs: weights.map(mapWeight),
    }),
    quickEntry: quickEntryPropsFromDb(quickEntryDb),
    vaccineSchedules: mergeVaccineSchedules(medicalEvents),
  };
});

/** Helper for pages that only need contact name lookup from a contacts list. */
export function contactNameFrom(
  contacts: Contact[],
  id: string | null | undefined
): string {
  if (!id) return "—";
  return contacts.find((c) => c.id === id)?.name ?? "—";
}
