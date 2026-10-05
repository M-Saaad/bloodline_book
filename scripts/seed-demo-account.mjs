/**
 * Creates a demo user + farm with sample herd data using the public anon key.
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
 *
 * The demo password comes from the shell variable DEMO_PASSWORD only.
 * Never put it in .env, EXPO_PUBLIC_*, or this repo.
 *
 * Usage: node scripts/seed-demo-account.mjs --yes-live
 *        node scripts/seed-demo-account.mjs --yes-live --reset
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEMO_EMAIL = 'demo@bloodlinebook.test';
const FARM_NAME = 'Willow Creek Demo';

/** Child tables an owner may delete (RLS DELETE policies require role owner). */
const DELETE_ORDER = [
  'weight_logs',
  'grazing_records',
  'feed_logs',
  'health_records',
  'documents',
  'tasks',
  'transactions',
  'breeding_events',
  'kidding_events',
  'animals',
  'weigh_sessions',
  'pastures',
  'breeds',
  'farm_invites',
];

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
      if (key === 'DEMO_PASSWORD') {
        continue;
      }
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
const demoPassword = process.env.DEMO_PASSWORD ?? '';
const yesLive = process.argv.includes('--yes-live');
const reset = process.argv.includes('--reset');

function hostFromUrl(value) {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

if (!url || !anonKey) {
  console.error('Missing Supabase URL and anon key in .env');
  process.exit(1);
}

const host = hostFromUrl(url);
if (!host) {
  console.error('EXPO_PUBLIC_SUPABASE_URL is not a valid URL.');
  process.exit(1);
}

console.log(host);

if (!yesLive) {
  console.error('Re-run with --yes-live to seed the live project.');
  process.exit(1);
}

if (!demoPassword) {
  console.error(
    'DEMO_PASSWORD is missing. Export it in the shell. Do not put it in .env or EXPO_PUBLIC_*.',
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function ensureSession() {
  const signIn = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: demoPassword,
  });
  if (!signIn.error && signIn.data.session) {
    return signIn.data.session;
  }

  const signUp = await supabase.auth.signUp({
    email: DEMO_EMAIL,
    password: demoPassword,
  });
  if (signUp.error) {
    throw signUp.error;
  }
  if (signUp.data.session) {
    return signUp.data.session;
  }

  const retry = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: demoPassword,
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

async function signInOnly() {
  const signIn = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: demoPassword,
  });
  if (signIn.error || !signIn.data.session || !signIn.data.user) {
    throw new Error(
      signIn.error?.message ?? 'Could not sign in as the demo user.',
    );
  }
  return signIn.data.user;
}

async function assertDemoOwner(farmId, userId) {
  const { data, error } = await supabase
    .from('farm_members')
    .select('role, user_id')
    .eq('farm_id', farmId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data || data.role !== 'owner' || data.user_id !== userId) {
    throw new Error(
      `Refusing to reset: ${FARM_NAME} is not owned by ${DEMO_EMAIL}.`,
    );
  }
}

async function countForFarm(table, farmId) {
  const { count, error } = await supabase
    .from(table)
    .select('farm_id', { count: 'exact', head: true })
    .eq('farm_id', farmId);
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteFarmRows(table, farmId) {
  for (;;) {
    const before = await countForFarm(table, farmId);
    if (before === 0) {
      return;
    }
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('farm_id', farmId)
      .select('farm_id');
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    if (!data?.length) {
      const leftover = new Error(
        `${table}: anon key deleted 0 of ${before} rows. RLS has no matching DELETE policy, or the policy rejected them.`,
      );
      leftover.table = table;
      throw leftover;
    }
  }
}

async function clearAnimalParentLinks(farmId) {
  const before = await countForFarm('animals', farmId);
  if (before === 0) {
    return;
  }
  const { data, error } = await supabase
    .from('animals')
    .update({ dam_id: null, sire_id: null, litter_id: null })
    .eq('farm_id', farmId)
    .select('id');
  if (error) {
    throw new Error(`animals: ${error.message}`);
  }
  if (!data?.length) {
    const leftover = new Error(
      `animals: could not clear dam_id, sire_id, and litter_id on ${before} rows.`,
    );
    leftover.table = 'animals';
    throw leftover;
  }
}

function editorSql(farmId, tables) {
  const lines = [
    '-- Willow Creek Demo only. Run in the Supabase SQL editor as a role that bypasses RLS.',
    `-- Farm id: ${farmId}`,
  ];
  if (tables.includes('animals')) {
    lines.push(
      `update public.animals set dam_id = null, sire_id = null, litter_id = null where farm_id = '${farmId}';`,
    );
  }
  for (const table of DELETE_ORDER) {
    if (tables.includes(table)) {
      lines.push(`delete from public.${table} where farm_id = '${farmId}';`);
    }
  }
  if (tables.includes('farms') || tables.includes('farm_members')) {
    lines.push(
      `delete from public.farms where id = '${farmId}' and name = 'Willow Creek Demo';`,
    );
  }
  return lines.join('\n');
}

async function printLeftovers(farmId, cause) {
  console.error(cause.message);
  console.error('');
  console.error(`Rows still on ${FARM_NAME} (${farmId}):`);
  const remaining = [];
  for (const table of [...DELETE_ORDER, 'farm_members']) {
    try {
      const count = await countForFarm(table, farmId);
      if (count > 0) {
        remaining.push(table);
        console.error(`  ${table}: ${count}`);
      }
    } catch (error) {
      remaining.push(table);
      console.error(
        `  ${table}: could not count (${error instanceof Error ? error.message : error})`,
      );
    }
  }
  const { data: farmRow } = await supabase
    .from('farms')
    .select('id')
    .eq('id', farmId)
    .eq('name', FARM_NAME)
    .maybeSingle();
  if (farmRow) {
    remaining.push('farms');
    console.error('  farms: 1');
  }
  console.error('');
  console.error(editorSql(farmId, remaining));
}

async function resetDemoFarm(farmId) {
  await clearAnimalParentLinks(farmId);
  for (const table of DELETE_ORDER) {
    await deleteFarmRows(table, farmId);
  }
  const { data, error } = await supabase
    .from('farms')
    .delete()
    .eq('id', farmId)
    .eq('name', FARM_NAME)
    .select('id');
  if (error) {
    const leftover = new Error(`farms: ${error.message}`);
    leftover.table = 'farms';
    throw leftover;
  }
  if (!data?.length) {
    const leftover = new Error(
      'farms: anon key cannot delete the farm. supabase/migrations/0001_extensions_and_tenancy.sql has SELECT, INSERT, and UPDATE policies only.',
    );
    leftover.table = 'farms';
    throw leftover;
  }
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

async function run() {
  if (reset) {
    const user = await signInOnly();
    const existingFarmId = await farmAlreadySeeded();
    if (existingFarmId) {
      await assertDemoOwner(existingFarmId, user.id);
      try {
        await resetDemoFarm(existingFarmId);
      } catch (error) {
        await printLeftovers(existingFarmId, error);
        process.exit(1);
      }
    }
  }
  return seed();
}

run()
  .then(({ farmId, skipped, dueOpen }) => {
    console.log('');
    console.log('Demo account ready');
    console.log('--------------------');
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log('Password: set in the shell as DEMO_PASSWORD (not printed)');
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
