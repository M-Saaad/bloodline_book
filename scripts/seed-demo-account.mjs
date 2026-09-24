/**
 * Creates a demo user + farm with sample herd data using the public anon key.
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
 *
 * Usage: node scripts/seed-demo-account.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEMO_EMAIL = 'demo@bloodlinebook.test';
const DEMO_PASSWORD = 'DemoHerd2026!';
const FARM_NAME = 'Willow Creek Demo';

function loadEnv() {
  const path = resolve(process.cwd(), '.env');
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional .env
  }
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

loadEnv();

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing Supabase URL and anon key in .env');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function ensureSession() {
  const signIn = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (!signIn.error && signIn.data.session) {
    return signIn.data.session;
  }

  const signUp = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (signUp.error) {
    throw signUp.error;
  }
  if (signUp.data.session) {
    return signUp.data.session;
  }

  const retry = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (retry.error || !retry.data.session) {
    throw new Error(
      retry.error?.message ??
        'Account exists but email confirmation may be required. Disable confirm email in Supabase Auth settings.',
    );
  }
  return retry.data.session;
}

async function farmAlreadySeeded() {
  const { data, error } = await supabase
    .from('farms')
    .select('id, name')
    .eq('name', FARM_NAME)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function getBreedId(name) {
  const { data, error } = await supabase
    .from('breeds')
    .select('id')
    .eq('name', name)
    .is('farm_id', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Breed not found: ${name}. Run Supabase migrations.`);
  return data.id;
}

async function seed() {
  await ensureSession();

  const existingFarmId = await farmAlreadySeeded();
  if (existingFarmId) {
    return { farmId: existingFarmId, skipped: true, dueOpen: null };
  }

  const nigerianId = await getBreedId('Nigerian Dwarf');
  const nubianId = await getBreedId('Nubian');

  const farmId = randomUUID();
  const now = new Date().toISOString();

  const { error: farmErr } = await supabase.from('farms').insert({
    id: farmId,
    name: FARM_NAME,
    segment: 'dairy',
    currency: 'USD',
    weight_unit: 'lb',
    created_at: now,
    updated_at: now,
  });
  if (farmErr) throw farmErr;

  const daisyId = randomUUID();
  const cloverId = randomUUID();
  const buckId = randomUUID();
  const kid1Id = randomUUID();
  const kid2Id = randomUUID();

  const dobDaisy = addDays(isoDate(), -800);
  const dobClover = addDays(isoDate(), -650);
  const dobBuck = addDays(isoDate(), -900);

  const { error: animalsErr } = await supabase.from('animals').insert([
    {
      id: daisyId,
      farm_id: farmId,
      name: 'Daisy',
      tag_number: 'WCD-101',
      sex: 'female',
      status: 'active',
      lifecycle_stage: 'breeding',
      breed_primary_id: nigerianId,
      date_of_birth: dobDaisy,
      created_at: now,
      updated_at: now,
    },
    {
      id: cloverId,
      farm_id: farmId,
      name: 'Clover',
      tag_number: 'WCD-102',
      sex: 'female',
      status: 'active',
      lifecycle_stage: 'breeding',
      breed_primary_id: nubianId,
      date_of_birth: dobClover,
      created_at: now,
      updated_at: now,
    },
    {
      id: buckId,
      farm_id: farmId,
      name: 'Atlas',
      tag_number: 'WCD-B01',
      sex: 'male',
      status: 'active',
      lifecycle_stage: 'adult',
      breed_primary_id: nigerianId,
      date_of_birth: dobBuck,
      created_at: now,
      updated_at: now,
    },
  ]);
  if (animalsErr) throw animalsErr;

  const bredOpen = addDays(isoDate(), -30);
  const dueOpen = addDays(bredOpen, 150);
  const breedingOpenId = randomUUID();

  const { error: breedingOpenErr } = await supabase.from('breeding_events').insert({
    id: breedingOpenId,
    farm_id: farmId,
    dam_id: cloverId,
    sire_id: buckId,
    bred_date: bredOpen,
    due_date: dueOpen,
    status: 'bred',
    created_at: now,
    updated_at: now,
  });
  if (breedingOpenErr) throw breedingOpenErr;

  const kidDatePast = addDays(isoDate(), -45);
  const kiddingId = randomUUID();
  const { error: kiddingErr } = await supabase.from('kidding_events').insert({
    id: kiddingId,
    farm_id: farmId,
    dam_id: daisyId,
    sire_id: buckId,
    kid_date: kidDatePast,
    kids_born: 2,
    kids_surviving: 2,
    notes: 'Twin does — demo litter',
    created_at: now,
    updated_at: now,
  });
  if (kiddingErr) throw kiddingErr;

  const bredPast = addDays(isoDate(), -200);
  const { error: breedingPastErr } = await supabase.from('breeding_events').insert({
    id: randomUUID(),
    farm_id: farmId,
    dam_id: daisyId,
    sire_id: buckId,
    bred_date: bredPast,
    due_date: addDays(bredPast, 150),
    status: 'kidded',
    kidding_event_id: kiddingId,
    created_at: now,
    updated_at: now,
  });
  if (breedingPastErr) throw breedingPastErr;

  const { error: kidsErr } = await supabase.from('animals').insert([
    {
      id: kid1Id,
      farm_id: farmId,
      name: 'Daisy kid 1',
      tag_number: 'WCD-K01',
      sex: 'female',
      status: 'active',
      lifecycle_stage: 'kid',
      dam_id: daisyId,
      sire_id: buckId,
      litter_id: kiddingId,
      date_of_birth: kidDatePast,
      created_at: now,
      updated_at: now,
    },
    {
      id: kid2Id,
      farm_id: farmId,
      name: 'Daisy kid 2',
      tag_number: 'WCD-K02',
      sex: 'female',
      status: 'active',
      lifecycle_stage: 'kid',
      dam_id: daisyId,
      sire_id: buckId,
      litter_id: kiddingId,
      date_of_birth: kidDatePast,
      created_at: now,
      updated_at: now,
    },
  ]);
  if (kidsErr) throw kidsErr;

  const healthFamachaId = randomUUID();
  const { error: healthErr } = await supabase.from('health_records').insert([
    {
      id: randomUUID(),
      farm_id: farmId,
      animal_id: daisyId,
      date: addDays(isoDate(), -14),
      kind: 'famacha',
      famacha_score: 3,
      notes: 'Routine check — healthy',
      created_at: now,
    },
    {
      id: healthFamachaId,
      farm_id: farmId,
      animal_id: cloverId,
      date: addDays(isoDate(), -3),
      kind: 'famacha',
      famacha_score: 4,
      notes: 'Recheck scheduled',
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      animal_id: daisyId,
      date: addDays(isoDate(), -60),
      kind: 'vaccination',
      product_name: 'CD&T',
      withdrawal_days: 0,
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      animal_id: cloverId,
      date: addDays(isoDate(), -20),
      kind: 'deworming',
      product_name: 'Safeguard',
      withdrawal_days: 7,
      created_at: now,
    },
  ]);
  if (healthErr) throw healthErr;

  const pastureId = randomUUID();
  const { error: pastureErr } = await supabase.from('pastures').insert({
    id: pastureId,
    farm_id: farmId,
    name: 'North Paddock',
    acres: 4,
    forage_type: 'mixed',
    status: 'grazing',
    created_at: now,
    updated_at: now,
  });
  if (pastureErr) throw pastureErr;

  const grazingStart = addDays(isoDate(), -7);
  const { error: grazingErr } = await supabase.from('grazing_records').insert([
    {
      id: randomUUID(),
      farm_id: farmId,
      pasture_id: pastureId,
      animal_id: daisyId,
      start_date: grazingStart,
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      pasture_id: pastureId,
      animal_id: cloverId,
      start_date: grazingStart,
      created_at: now,
    },
  ]);
  if (grazingErr) throw grazingErr;

  const weighSessionId = randomUUID();
  const { error: sessionErr } = await supabase.from('weigh_sessions').insert({
    id: weighSessionId,
    farm_id: farmId,
    date: addDays(isoDate(), -2),
    weigh_point: 'ad_hoc',
    created_at: now,
  });
  if (sessionErr) throw sessionErr;

  const { error: weightsErr } = await supabase.from('weight_logs').insert([
    {
      id: randomUUID(),
      farm_id: farmId,
      weigh_session_id: weighSessionId,
      animal_id: daisyId,
      weight_value: 78.5,
      weight_unit: 'lb',
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      weigh_session_id: weighSessionId,
      animal_id: cloverId,
      weight_value: 92,
      weight_unit: 'lb',
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      weigh_session_id: weighSessionId,
      animal_id: kid1Id,
      weight_value: 22,
      weight_unit: 'lb',
      created_at: now,
    },
  ]);
  if (weightsErr) throw weightsErr;

  const { error: txErr } = await supabase.from('transactions').insert([
    {
      id: randomUUID(),
      farm_id: farmId,
      date: addDays(isoDate(), -5),
      amount: 145.5,
      kind: 'expense',
      category: 'Feed',
      notes: 'Alfalfa hay — demo',
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      date: addDays(isoDate(), -30),
      amount: 850,
      kind: 'revenue',
      category: 'Animal sales',
      notes: 'Yearling buck sale',
      created_at: now,
    },
  ]);
  if (txErr) throw txErr;

  const { error: tasksErr } = await supabase.from('tasks').insert([
    {
      id: randomUUID(),
      farm_id: farmId,
      title: 'Expected kidding — Clover',
      due_date: dueOpen,
      priority: 'high',
      source: 'breeding',
      source_id: breedingOpenId,
      completed: false,
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      title: 'Recheck FAMACHA — Clover',
      due_date: addDays(isoDate(), 4),
      priority: 'medium',
      source: 'famacha_check',
      source_id: healthFamachaId,
      completed: false,
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      title: 'Check water troughs',
      due_date: isoDate(),
      priority: 'medium',
      source: 'manual',
      completed: false,
      created_at: now,
    },
    {
      id: randomUUID(),
      farm_id: farmId,
      title: 'Fence repair — south gate',
      priority: 'low',
      source: 'manual',
      completed: true,
      created_at: now,
    },
  ]);
  if (tasksErr) throw tasksErr;

  const { error: feedErr } = await supabase.from('feed_logs').insert({
    id: randomUUID(),
    farm_id: farmId,
    date: addDays(isoDate(), -1),
    feed_type: 'Hay',
    quantity: 3,
    unit: 'bale',
    pasture_id: pastureId,
    created_at: now,
  });
  if (feedErr) throw feedErr;

  const { error: docErr } = await supabase.from('documents').insert({
    id: randomUUID(),
    farm_id: farmId,
    type: 'registration',
    title: 'ADGA registration — Daisy',
    notes: 'Metadata only (no file upload in app yet)',
    created_at: now,
  });
  if (docErr) throw docErr;

  return { farmId, skipped: false, dueOpen };
}

seed()
  .then(({ farmId, skipped, dueOpen }) => {
    console.log('');
    console.log('Demo account ready');
    console.log('--------------------');
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
    console.log(`Farm:     ${FARM_NAME} (${farmId})`);
    if (skipped) {
      console.log('');
      console.log('(Farm already existed — left data unchanged.)');
    } else {
      console.log('');
      console.log(
        'Sample data inserted (5 goats, breeding, health, land, weights, money, tasks, document).',
      );
      if (dueOpen) {
        console.log(
          `Clover due date: ${dueOpen} (calendar when within 120 days)`,
        );
      }
    }
    console.log('');
    console.log('See docs/TEST-ACCOUNT.md for details.');
    console.log('');
  })
  .catch((err) => {
    console.error('Seed failed:', err.message ?? err);
    process.exit(1);
  });
