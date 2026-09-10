/**
 * Seed bloodline-book-dev with fabricated US demo data.
 * Never run against production farm Supabase.
 *
 * Usage: npm run seed:demo
 */
import { createServiceClient } from "../lib/supabase/admin.ts";
import { isSupabaseConfigured } from "../lib/supabase/env.ts";
import { applyWritePlan } from "../lib/db/writes.ts";
import type {
  Animal,
  BreedingEvent,
  Contact,
  Lactation,
  MedicalEvent,
  MilkRecord,
  VetContact,
} from "../lib/types.ts";
import { computeBreedingDueDates } from "../lib/livestock/breeding.ts";

const FARM_NAME = "Willow Creek Dairy Goats";
const OWNER_NAME = "Jordan Ellis";

function assertDevProject() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and keys in .env.local");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.includes("alyumn") || url.includes("al-yumn")) {
    throw new Error("Refusing to seed: URL looks like the production farm project");
  }
}

async function main() {
  assertDevProject();
  const client = createServiceClient();

  // Clear existing demo rows (animals cascade to most child tables)
  const { data: existingAnimals } = await client.from("animals").select("id");
  const ids = (existingAnimals ?? []).map((r) => Number(r.id)).filter((id) => id > 0);
  if (ids.length) {
    await client.from("animals").delete().in("id", ids);
  }
  await client.from("vet_contacts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await client.from("contacts").delete().neq("name", "__keep__");

  const farmContact: Contact = {
    id: crypto.randomUUID(),
    name: "Farm",
    type: "Farm",
    phone: null,
    notes: FARM_NAME,
  };
  const ownerContact: Contact = {
    id: crypto.randomUUID(),
    name: OWNER_NAME,
    type: "Customer",
    phone: "555-0100",
    notes: "Demo owner — fictional",
  };

  const animals: Animal[] = [
    {
      id: 101,
      name: "Maple",
      barn_name: "Maple",
      registered_name: "Willow Creek Maple",
      breed: "Nigerian Dwarf",
      sex: "Female",
      adga_registration_number: "D1234567",
      tattoo_right: "WC",
      tattoo_left: "101",
      farm_tag: "ND-01",
      status: "Active",
      price: 0,
      sold_price: null,
      home_bred: true,
      dam_id: null,
      sire_id: null,
      sire_name: "Hazel's Buck",
      date_of_purchase: null,
      age_at_purchase: null,
      description: "Demo doe",
      comment: null,
      purchased_from: null,
      owner_id: farmContact.id,
      out_date: null,
    },
    {
      id: 102,
      name: "Briar",
      registered_name: "Willow Creek Briar",
      breed: "Nubian",
      sex: "Female",
      adga_registration_number: "N9876543",
      tattoo_right: "WC",
      tattoo_left: "102",
      farm_tag: "NU-02",
      status: "Active",
      price: 450,
      sold_price: null,
      home_bred: false,
      dam_id: null,
      sire_id: null,
      sire_name: null,
      date_of_purchase: "2024-03-15",
      age_at_purchase: "8 months",
      description: "Purchased demo doe",
      comment: null,
      purchased_from: null,
      owner_id: farmContact.id,
      out_date: null,
    },
    {
      id: 103,
      name: "Copper",
      breed: "Nigerian Dwarf",
      sex: "Male",
      tattoo_right: "WC",
      tattoo_left: "103",
      status: "Active",
      price: 0,
      sold_price: null,
      home_bred: true,
      dam_id: null,
      sire_id: null,
      sire_name: null,
      date_of_purchase: null,
      age_at_purchase: null,
      description: "Demo buck",
      comment: null,
      purchased_from: null,
      owner_id: farmContact.id,
      out_date: null,
    },
  ];

  const dueDates = computeBreedingDueDates("2025-06-01", "2025-06-14");
  const breeding: BreedingEvent = {
    id: crypto.randomUUID(),
    female_animal_id: 101,
    male_animal_id: 103,
    buck_name: "Copper",
    ...dueDates,
    delivered_date: null,
    ultrasound_date: "2025-07-20",
    fetus_count: 2,
    outcome: "Pending",
    status: "Ready",
    notes: "Pasture exposure demo",
  };

  const medical: MedicalEvent[] = [
    {
      id: crypto.randomUUID(),
      animal_id: 101,
      event_type: "Vaccine",
      date: "2025-04-01",
      notes: "CD&T · once a year · 1 ml",
      comment: null,
      transaction_id: null,
      product_brand: "Bar-Vac CD/T",
    },
    {
      id: crypto.randomUUID(),
      animal_id: 101,
      event_type: "FAMACHA",
      date: "2025-08-01",
      notes: null,
      comment: null,
      transaction_id: null,
      famacha_score: 2,
      body_condition_score: 3,
      production_stage: "late gestation",
    },
    {
      id: crypto.randomUUID(),
      animal_id: 102,
      event_type: "Deworming",
      date: "2025-07-10",
      notes: "I-DW Safeguard / Panacur (fenbendazole) 5 ml",
      comment: "After high FEC",
      transaction_id: null,
      product_brand: "Safeguard",
      route: "oral drench",
      dose_amount: 5,
      dose_unit: "mL",
      withdrawal_meat_days: 7,
      withdrawal_milk_days: 0,
      withdrawal_clear_date: "2025-07-17",
    },
  ];

  const lactation: Lactation = {
    id: crypto.randomUUID(),
    animal_id: 102,
    freshening_date: "2025-03-01",
    lactation_number: 2,
    dry_off_date: null,
    notes: "Current lactation",
  };

  const milk: MilkRecord[] = [
    {
      id: crypto.randomUUID(),
      animal_id: 102,
      date: "2025-08-01",
      session: "AM",
      amount_raw: 3.2,
      unit_entered: "lb",
      amount_lb_normalized: 3.2,
      measurement_method: "scale",
      source: "farm-entered",
      operator: OWNER_NAME,
      notes: null,
    },
    {
      id: crypto.randomUUID(),
      animal_id: 102,
      date: "2025-08-01",
      session: "PM",
      amount_raw: 2.8,
      unit_entered: "lb",
      amount_lb_normalized: 2.8,
      measurement_method: "scale",
      source: "farm-entered",
      operator: OWNER_NAME,
      notes: null,
    },
  ];

  const vet: VetContact = {
    id: crypto.randomUUID(),
    role: "primary",
    name: "Dr. Sarah Chen, DVM",
    phone: "555-0199",
    emergency_phone: "555-0911",
    address: "123 County Road 12, Demo Valley, VT",
    services_offered: "Small ruminant herd health, reproduction",
    accepts_new_clients: "yes",
    vcpr_established: "unknown",
    notes: "Fictional demo contact",
  };

  await applyWritePlan({
    upsertContacts: [farmContact, ownerContact],
    upsertAnimals: animals,
    upsertBreeding: [breeding],
    upsertMedical: medical,
    upsertLactations: [lactation],
    upsertMilk: milk,
    upsertVetContacts: [vet],
  });

  console.log(`Seeded demo herd for ${FARM_NAME} (${animals.length} animals)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
