/**
 * Live Supabase RLS isolation checks (Postgres row-level security only).
 * PowerSync sync rules, Storage policies, and RPC functions are NOT tested here.
 *
 * Usage: npm run test:isolation -- --yes-live
 * Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
 * Never uses the service role key.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIGNUP_DELAY_MS = 2000;
const FARM_SCOPED_TABLES = [
  'animals',
  'weigh_sessions',
  'weight_logs',
  'health_records',
  'breeding_events',
  'kidding_events',
  'transactions',
  'tasks',
  'pastures',
  'grazing_records',
  'feed_logs',
  'documents',
  'breeds',
];

const results = [];

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

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function record(scope, op, pass, detail = '') {
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`${pass ? 'PASS' : 'FAIL'}: ${scope} ${op}${suffix}`);
  results.push({ scope, op, pass, detail });
}

function makeClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hostFromSupabaseUrl(url) {
  try {
    return new URL(url).host;
  } catch {
    return '(invalid-url)';
  }
}

async function signUpUser(client, email, password) {
  await sleep(SIGNUP_DELAY_MS);
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    throw new Error(`Sign-up failed for ${email}: ${error.message}`);
  }
  if (!data.session) {
    console.error(
      `Sign-up for ${email} did not return a session. Email confirmation is likely enabled.`,
    );
    console.error(
      'Disable email confirmation for this project (Auth → Providers → Email) and retry.',
    );
    process.exit(1);
  }
  return { userId: data.user.id, session: data.session };
}

async function insertFarm(client, suffix, tag) {
  const farmId = randomUUID();
  const now = new Date().toISOString();
  const name = `ISOLATION-TEST-${suffix}-${tag}`;
  const { error } = await client.from('farms').insert({
    id: farmId,
    name,
    segment: 'meat',
    currency: 'USD',
    weight_unit: 'lb',
    created_at: now,
    updated_at: now,
  });
  if (error) {
    throw new Error(`Farm insert (${suffix}): ${error.message}`);
  }
  return { farmId, name };
}

async function seedFarmA(client, tag) {
  const marker = `ISOLATION-TEST-${tag}`;
  const today = isoDate();
  const now = new Date().toISOString();
  const ids = {};

  const { farmId } = await insertFarm(client, 'A', tag);
  ids.farmId = farmId;

  const breedId = randomUUID();
  const { error: breedErr } = await client.from('breeds').insert({
    id: breedId,
    farm_id: farmId,
    name: `${marker}-breed`,
    segment: 'meat',
    created_at: now,
  });
  if (breedErr) throw breedErr;
  ids.breeds = breedId;

  const damId = randomUUID();
  const { error: animalErr } = await client.from('animals').insert({
    id: damId,
    farm_id: farmId,
    name: `${marker}-dam`,
    sex: 'female',
    status: 'active',
    lifecycle_stage: 'adult',
    notes: marker,
    created_at: now,
    updated_at: now,
  });
  if (animalErr) throw animalErr;
  ids.animals = damId;

  const kiddingId = randomUUID();
  const { error: kiddingErr } = await client.from('kidding_events').insert({
    id: kiddingId,
    farm_id: farmId,
    dam_id: damId,
    kid_date: today,
    kids_born: 1,
    notes: marker,
    created_at: now,
    updated_at: now,
  });
  if (kiddingErr) throw kiddingErr;
  ids.kidding_events = kiddingId;

  const breedingId = randomUUID();
  const { error: breedingErr } = await client.from('breeding_events').insert({
    id: breedingId,
    farm_id: farmId,
    dam_id: damId,
    bred_date: today,
    status: 'bred',
    notes: marker,
    created_at: now,
    updated_at: now,
  });
  if (breedingErr) throw breedingErr;
  ids.breeding_events = breedingId;

  const sessionId = randomUUID();
  const { error: sessionErr } = await client.from('weigh_sessions').insert({
    id: sessionId,
    farm_id: farmId,
    date: today,
    weigh_point: 'ad_hoc',
    notes: marker,
    created_at: now,
  });
  if (sessionErr) throw sessionErr;
  ids.weigh_sessions = sessionId;

  const weightLogId = randomUUID();
  const { error: weightErr } = await client.from('weight_logs').insert({
    id: weightLogId,
    farm_id: farmId,
    weigh_session_id: sessionId,
    animal_id: damId,
    weight_value: 42,
    weight_unit: 'lb',
    created_at: now,
  });
  if (weightErr) throw weightErr;
  ids.weight_logs = weightLogId;

  const healthId = randomUUID();
  const { error: healthErr } = await client.from('health_records').insert({
    id: healthId,
    farm_id: farmId,
    animal_id: damId,
    date: today,
    kind: 'other',
    notes: marker,
    created_at: now,
  });
  if (healthErr) throw healthErr;
  ids.health_records = healthId;

  const txnId = randomUUID();
  const { error: txnErr } = await client.from('transactions').insert({
    id: txnId,
    farm_id: farmId,
    date: today,
    amount: 1,
    kind: 'expense',
    category: 'other',
    notes: marker,
    created_at: now,
  });
  if (txnErr) throw txnErr;
  ids.transactions = txnId;

  const taskId = randomUUID();
  const { error: taskErr } = await client.from('tasks').insert({
    id: taskId,
    farm_id: farmId,
    title: marker,
    priority: 'low',
    source: 'manual',
    created_at: now,
  });
  if (taskErr) throw taskErr;
  ids.tasks = taskId;

  const pastureId = randomUUID();
  const { error: pastureErr } = await client.from('pastures').insert({
    id: pastureId,
    farm_id: farmId,
    name: `${marker}-pasture`,
    notes: marker,
    created_at: now,
    updated_at: now,
  });
  if (pastureErr) throw pastureErr;
  ids.pastures = pastureId;

  const grazingId = randomUUID();
  const { error: grazingErr } = await client.from('grazing_records').insert({
    id: grazingId,
    farm_id: farmId,
    pasture_id: pastureId,
    animal_id: damId,
    start_date: today,
    notes: marker,
    created_at: now,
  });
  if (grazingErr) throw grazingErr;
  ids.grazing_records = grazingId;

  const feedId = randomUUID();
  const { error: feedErr } = await client.from('feed_logs').insert({
    id: feedId,
    farm_id: farmId,
    date: today,
    feed_type: marker,
    notes: marker,
    created_at: now,
  });
  if (feedErr) throw feedErr;
  ids.feed_logs = feedId;

  const docId = randomUUID();
  const { error: docErr } = await client.from('documents').insert({
    id: docId,
    farm_id: farmId,
    animal_id: damId,
    type: 'other',
    title: marker,
    notes: marker,
    created_at: now,
  });
  if (docErr) throw docErr;
  ids.documents = docId;

  const inviteId = randomUUID();
  const { error: inviteErr } = await client.from('farm_invites').insert({
    id: inviteId,
    farm_id: farmId,
    email: `invite-${tag}@bloodlinebook.test`,
    role: 'hand',
    status: 'pending',
    created_at: now,
  });
  if (inviteErr) throw inviteErr;
  ids.farm_invites = inviteId;

  const expected = {
    breeds: `${marker}-breed`,
    animals: marker,
    weigh_sessions: marker,
    weight_logs: 42,
    health_records: marker,
    breeding_events: marker,
    kidding_events: marker,
    transactions: marker,
    tasks: marker,
    pastures: `${marker}-pasture`,
    grazing_records: marker,
    feed_logs: marker,
    documents: marker,
  };

  return { farmId, ids, marker, expected };
}

async function seedFarmB(client, tag) {
  const marker = `ISOLATION-TEST-B-${tag}`;
  const now = new Date().toISOString();
  const { farmId } = await insertFarm(client, 'B', tag);
  const animalId = randomUUID();
  const { error } = await client.from('animals').insert({
    id: animalId,
    farm_id: farmId,
    name: marker,
    sex: 'female',
    status: 'active',
    lifecycle_stage: 'adult',
    notes: marker,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  return { farmId, animalId, marker };
}

function markerFieldForTable(table) {
  switch (table) {
    case 'tasks':
      return 'title';
    case 'breeds':
      return 'name';
    case 'pastures':
      return 'name';
    case 'feed_logs':
      return 'feed_type';
    case 'documents':
      return 'title';
    default:
      return 'notes';
  }
}

async function fetchField(client, table, id, field) {
  const { data, error } = await client
    .from(table)
    .select(field)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return { ok: false, detail: error.message };
  }
  if (!data) {
    return { ok: false, detail: 'row missing' };
  }
  return { ok: true, value: data[field] };
}

async function attackUpdateRow(clientB, table, id) {
  let patch;
  switch (table) {
    case 'breeds':
      patch = { name: 'ISOLATION-HACK' };
      break;
    case 'tasks':
    case 'documents':
      patch = { title: 'ISOLATION-HACK' };
      break;
    case 'pastures':
      patch = { name: 'ISOLATION-HACK' };
      break;
    case 'feed_logs':
      patch = { feed_type: 'ISOLATION-HACK' };
      break;
    case 'weight_logs':
      patch = { weight_value: 999 };
      break;
    default:
      patch = { notes: 'ISOLATION-HACK' };
      break;
  }

  const { data, error } = await clientB
    .from(table)
    .update(patch)
    .eq('id', id)
    .select('id');
  if (error) {
    record(table, 'B UPDATE', true, error.message);
    return;
  }
  record(
    table,
    'B UPDATE',
    (data?.length ?? 0) === 0,
    `rows updated ${data?.length ?? 0}`,
  );
}

async function attackSelectById(clientB, table, id) {
  const { data, error } = await clientB.from(table).select('id').eq('id', id);
  if (error) {
    record(table, 'B SELECT by id', false, error.message);
    return;
  }
  record(
    table,
    'B SELECT by id',
    (data?.length ?? 0) === 0,
    `row count ${data?.length ?? 0}`,
  );
}

async function attackSelectByFarmId(clientB, table, farmId) {
  const { data, error } = await clientB
    .from(table)
    .select('id')
    .eq('farm_id', farmId);
  if (error) {
    record(table, 'B SELECT by farm_id', false, error.message);
    return;
  }
  record(
    table,
    'B SELECT by farm_id',
    (data?.length ?? 0) === 0,
    `row count ${data?.length ?? 0}`,
  );
}

async function attackDelete(clientB, table, id) {
  const { data, error } = await clientB
    .from(table)
    .delete()
    .eq('id', id)
    .select('id');
  if (error) {
    record(table, 'B DELETE', true, error.message);
    return;
  }
  record(
    table,
    'B DELETE',
    (data?.length ?? 0) === 0,
    `rows deleted ${data?.length ?? 0}`,
  );
}

function buildInsertPayload(table, farmId, ids, tag) {
  const today = isoDate();
  const now = new Date().toISOString();
  const marker = `ISOLATION-B-INSERT-${tag}`;
  const id = randomUUID();

  switch (table) {
    case 'breeds':
      return {
        id,
        farm_id: farmId,
        name: marker,
        segment: 'meat',
        created_at: now,
      };
    case 'animals':
      return {
        id,
        farm_id: farmId,
        name: marker,
        sex: 'female',
        status: 'active',
        lifecycle_stage: 'kid',
        notes: marker,
        created_at: now,
        updated_at: now,
      };
    case 'weigh_sessions':
      return {
        id,
        farm_id: farmId,
        date: today,
        weigh_point: 'ad_hoc',
        notes: marker,
        created_at: now,
      };
    case 'weight_logs':
      return {
        id,
        farm_id: farmId,
        weigh_session_id: ids.weigh_sessions,
        animal_id: ids.animals,
        weight_value: 1,
        weight_unit: 'lb',
        created_at: now,
      };
    case 'health_records':
      return {
        id,
        farm_id: farmId,
        animal_id: ids.animals,
        date: today,
        kind: 'other',
        notes: marker,
        created_at: now,
      };
    case 'kidding_events':
      return {
        id,
        farm_id: farmId,
        dam_id: ids.animals,
        kid_date: today,
        kids_born: 1,
        notes: marker,
        created_at: now,
        updated_at: now,
      };
    case 'breeding_events':
      return {
        id,
        farm_id: farmId,
        dam_id: ids.animals,
        bred_date: today,
        status: 'bred',
        notes: marker,
        created_at: now,
        updated_at: now,
      };
    case 'transactions':
      return {
        id,
        farm_id: farmId,
        date: today,
        amount: 1,
        kind: 'expense',
        category: 'other',
        notes: marker,
        created_at: now,
      };
    case 'tasks':
      return {
        id,
        farm_id: farmId,
        title: marker,
        priority: 'low',
        source: 'manual',
        created_at: now,
      };
    case 'pastures':
      return {
        id,
        farm_id: farmId,
        name: marker,
        notes: marker,
        created_at: now,
        updated_at: now,
      };
    case 'grazing_records':
      return {
        id,
        farm_id: farmId,
        pasture_id: ids.pastures,
        animal_id: ids.animals,
        start_date: today,
        notes: marker,
        created_at: now,
      };
    case 'feed_logs':
      return {
        id,
        farm_id: farmId,
        date: today,
        feed_type: marker,
        notes: marker,
        created_at: now,
      };
    case 'documents':
      return {
        id,
        farm_id: farmId,
        type: 'other',
        title: marker,
        notes: marker,
        created_at: now,
      };
    default:
      return null;
  }
}

async function attackInsert(clientB, table, farmId, ids, tag) {
  const payload = buildInsertPayload(table, farmId, ids, tag);
  if (!payload) {
    record(table, 'B INSERT', false, 'missing payload builder');
    return;
  }
  const { error } = await clientB.from(table).insert(payload);
  record(table, 'B INSERT', Boolean(error), error?.message ?? 'insert succeeded');
}

async function verifyRowIntact(clientA, table, id, expected, markerField) {
  const { ok, value, detail } = await fetchField(
    clientA,
    table,
    id,
    markerField,
  );
  if (!ok) {
    record(table, 'A verify row', false, detail);
    return;
  }
  const matches =
    typeof expected === 'number'
      ? Number(value) === expected
      : value === expected;
  record(
    table,
    'A verify row',
    matches,
    matches ? 'unchanged' : `got ${String(value)}`,
  );
}

async function runTableAttacks(clientA, clientB, ctx) {
  const { farmAId, ids, expected, tag } = ctx;

  for (const table of FARM_SCOPED_TABLES) {
    const id = ids[table];

    await attackSelectById(clientB, table, id);
    await attackSelectByFarmId(clientB, table, farmAId);
    await attackUpdateRow(clientB, table, id);
    await attackDelete(clientB, table, id);
    await attackInsert(clientB, table, farmAId, ids, tag);
    await verifyRowIntact(
      clientA,
      table,
      id,
      expected[table],
      markerFieldForVerify(table),
    );
  }
}

function markerFieldForVerify(table) {
  switch (table) {
    case 'weight_logs':
      return 'weight_value';
    default:
      return markerFieldForTable(table);
  }
}

async function runTenantChecks(clientB, clientAnon, ctx) {
  const { farmAId, farmBId, userIdB, ids, tag } = ctx;

  const farmSelect = await clientB.from('farms').select('id').eq('id', farmAId);
  record(
    'farms',
    'B SELECT farm A',
    !farmSelect.error && (farmSelect.data?.length ?? 0) === 0,
    farmSelect.error?.message ?? `row count ${farmSelect.data?.length ?? 0}`,
  );

  const farmUpdate = await clientB
    .from('farms')
    .update({ name: 'ISOLATION-HACK' })
    .eq('id', farmAId)
    .select('id');
  record(
    'farms',
    'B UPDATE farm A',
    !farmUpdate.error && (farmUpdate.data?.length ?? 0) === 0,
    farmUpdate.error?.message ??
      `rows updated ${farmUpdate.data?.length ?? 0}`,
  );

  const farmDelete = await clientB
    .from('farms')
    .delete()
    .eq('id', farmAId)
    .select('id');
  record(
    'farms',
    'B DELETE farm A',
    !farmDelete.error && (farmDelete.data?.length ?? 0) === 0,
    farmDelete.error?.message ??
      `rows deleted ${farmDelete.data?.length ?? 0}`,
  );

  const membersSelect = await clientB
    .from('farm_members')
    .select('user_id')
    .eq('farm_id', farmAId);
  record(
    'farm_members',
    'B SELECT farm A',
    !membersSelect.error && (membersSelect.data?.length ?? 0) === 0,
    membersSelect.error?.message ??
      `row count ${membersSelect.data?.length ?? 0}`,
  );

  const membersUpdate = await clientB
    .from('farm_members')
    .update({ role: 'hand' })
    .eq('farm_id', farmAId)
    .select('user_id');
  record(
    'farm_members',
    'B UPDATE farm A',
    !membersUpdate.error && (membersUpdate.data?.length ?? 0) === 0,
    membersUpdate.error?.message ??
      `rows updated ${membersUpdate.data?.length ?? 0}`,
  );

  const membersDelete = await clientB
    .from('farm_members')
    .delete()
    .eq('farm_id', farmAId)
    .select('user_id');
  record(
    'farm_members',
    'B DELETE farm A',
    !membersDelete.error && (membersDelete.data?.length ?? 0) === 0,
    membersDelete.error?.message ??
      `rows deleted ${membersDelete.data?.length ?? 0}`,
  );

  const membersInsert = await clientB.from('farm_members').insert({
    farm_id: farmAId,
    user_id: userIdB,
    role: 'hand',
  });
  record(
    'farm_members',
    'B INSERT self on farm A',
    Boolean(membersInsert.error),
    membersInsert.error?.message ?? 'insert succeeded',
  );

  const invitesSelect = await clientB
    .from('farm_invites')
    .select('id')
    .eq('farm_id', farmAId);
  record(
    'farm_invites',
    'B SELECT farm A',
    !invitesSelect.error && (invitesSelect.data?.length ?? 0) === 0,
    invitesSelect.error?.message ??
      `row count ${invitesSelect.data?.length ?? 0}`,
  );

  const invitesInsert = await clientB.from('farm_invites').insert({
    id: randomUUID(),
    farm_id: farmAId,
    email: `b-invite-${tag}@bloodlinebook.test`,
    role: 'hand',
    status: 'pending',
  });
  record(
    'farm_invites',
    'B INSERT on farm A',
    Boolean(invitesInsert.error),
    invitesInsert.error?.message ?? 'insert succeeded',
  );

  const crossUpdate = await clientB
    .from('animals')
    .update({ farm_id: farmAId })
    .eq('id', ctx.bAnimalId)
    .select('id, farm_id');
  record(
    'animals',
    'B UPDATE move to farm A',
    Boolean(crossUpdate.error) || (crossUpdate.data?.length ?? 0) === 0,
    crossUpdate.error?.message ??
      `rows updated ${crossUpdate.data?.length ?? 0}`,
  );

  const stillOnB = await clientB
    .from('animals')
    .select('farm_id')
    .eq('id', ctx.bAnimalId)
    .maybeSingle();
  record(
    'animals',
    'B own row still on farm B',
    !stillOnB.error && stillOnB.data?.farm_id === farmBId,
    stillOnB.error?.message ??
      `farm_id=${stillOnB.data?.farm_id ?? 'missing'}`,
  );

  for (const table of FARM_SCOPED_TABLES) {
    let query = clientAnon.from(table).select('id');
    if (table === 'breeds') {
      query = query.not('farm_id', 'is', null);
    }
    const anonSelect = await query.limit(5);
    if (anonSelect.error) {
      record(table, 'anon SELECT', false, anonSelect.error.message);
      continue;
    }
    record(
      table,
      'anon SELECT',
      (anonSelect.data?.length ?? 0) === 0,
      `row count ${anonSelect.data?.length ?? 0}`,
    );
  }

  const anonGlobalBreeds = await clientAnon
    .from('breeds')
    .select('id')
    .is('farm_id', null)
    .limit(1);
  if (anonGlobalBreeds.error) {
    record(
      'breeds',
      'anon SELECT global breeds',
      false,
      anonGlobalBreeds.error.message,
    );
  } else {
    record(
      'breeds',
      'anon SELECT global breeds',
      (anonGlobalBreeds.data?.length ?? 0) > 0,
      `row count ${anonGlobalBreeds.data?.length ?? 0}`,
    );
  }

  const anonOwnedBreeds = await clientAnon
    .from('breeds')
    .select('id')
    .eq('id', ids.breeds);
  if (anonOwnedBreeds.error) {
    record(
      'breeds',
      'anon SELECT farm A breed by id',
      false,
      anonOwnedBreeds.error.message,
    );
  } else {
    record(
      'breeds',
      'anon SELECT farm A breed by id',
      (anonOwnedBreeds.data?.length ?? 0) === 0,
      `row count ${anonOwnedBreeds.data?.length ?? 0}`,
    );
  }
}

async function cleanupUser(client, farmId, ids, label, failures) {
  const del = async (table, id) => {
    if (!id) return;
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) {
      failures.push(`${label} ${table} ${id}: ${error.message}`);
    }
  };

  await del('weight_logs', ids.weight_logs);
  await del('weigh_sessions', ids.weigh_sessions);
  await del('grazing_records', ids.grazing_records);
  await del('health_records', ids.health_records);
  await del('breeding_events', ids.breeding_events);
  await del('kidding_events', ids.kidding_events);
  await del('documents', ids.documents);
  await del('tasks', ids.tasks);
  await del('feed_logs', ids.feed_logs);
  await del('transactions', ids.transactions);
  await del('animals', ids.animals);
  await del('pastures', ids.pastures);
  await del('farm_invites', ids.farm_invites);
  await del('breeds', ids.breeds);

  if (farmId) {
    const { error } = await client.from('farms').delete().eq('id', farmId);
    if (error) {
      failures.push(`${label} farms ${farmId}: ${error.message}`);
    }
  }
}

function printSummary() {
  console.log('\n--- Summary ---');
  for (const row of results) {
    console.log(`${row.pass ? 'PASS' : 'FAIL'}\t${row.scope}\t${row.op}`);
  }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
}

loadEnv();

const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const host = hostFromSupabaseUrl(url);
if (!process.argv.includes('--yes-live')) {
  console.log(`Target host: ${host}`);
  console.log(
    'This script writes throwaway auth users and rows on the live project.',
  );
  console.log('Re-run with --yes-live to execute checks.');
  process.exit(0);
}

const tag = randomBytes(4).toString('hex');
const emailA = `isolation-${tag}a@bloodlinebook.test`;
const emailB = `isolation-${tag}b@bloodlinebook.test`;
const password = `Isolation-${tag}!Aa1`;

const clientA = makeClient(url, anonKey);
const clientB = makeClient(url, anonKey);
const clientAnon = makeClient(url, anonKey);

const ctx = {
  tag,
  emailA,
  emailB,
  farmAId: null,
  farmBId: null,
  userIdA: null,
  userIdB: null,
  bAnimalId: null,
  ids: {},
  expected: {},
  marker: null,
};

const cleanupFailures = [];

try {
  console.log(`Target host: ${host}`);
  console.log(`Run tag: ${tag}`);

  const userA = await signUpUser(clientA, emailA, password);
  ctx.userIdA = userA.userId;

  const userB = await signUpUser(clientB, emailB, password);
  ctx.userIdB = userB.userId;

  const seededA = await seedFarmA(clientA, tag);
  ctx.farmAId = seededA.farmId;
  ctx.ids = seededA.ids;
  ctx.marker = seededA.marker;
  ctx.expected = seededA.expected;

  const seededB = await seedFarmB(clientB, tag);
  ctx.farmBId = seededB.farmId;
  ctx.bAnimalId = seededB.animalId;

  await runTableAttacks(clientA, clientB, ctx);
  await runTenantChecks(clientB, clientAnon, ctx);
} catch (error) {
  record('setup', 'exception', false, error instanceof Error ? error.message : String(error));
} finally {
  try {
    await cleanupUser(clientA, ctx.farmAId, ctx.ids, 'user A', cleanupFailures);
    await cleanupUser(
      clientB,
      ctx.farmBId,
      { animals: ctx.bAnimalId },
      'user B',
      cleanupFailures,
    );
  } catch (cleanupError) {
    cleanupFailures.push(
      cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    );
  }

  printSummary();

  console.log('\nThrowaway auth users (delete manually):');
  console.log(`  ${emailA}`);
  console.log(`  ${emailB}`);
  console.log('Delete these users in Supabase Dashboard -> Authentication -> Users');

  if (cleanupFailures.length > 0) {
    console.log('\nRows or farms that could not be deleted via anon key:');
    for (const line of cleanupFailures) {
      console.log(`  ${line}`);
    }
  }

  const failed = results.filter((r) => !r.pass);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}
