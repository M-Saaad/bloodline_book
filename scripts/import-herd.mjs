#!/usr/bin/env node
/**
 * Import goats from a farmer spreadsheet into one farm (admin only).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the shell environment ONLY.
 * Do not load .env. Never store the service role key in .env, git, or EXPO_PUBLIC_*.
 *
 * Usage:
 *   node scripts/import-herd.mjs "<farm name or id>" <file.xlsx|file.csv> [--map mapping.json] [--sheet NAME] [--apply]
 *
 * Default is dry run (no writes). Pass --apply to insert in one batch (safe to re-run).
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildImportPlan,
  formatMappingForPrint,
  guessColumnMapping,
  mergeColumnMapping,
} from './herd-import/plan.mjs';
import { readSpreadsheet } from './herd-import/read-spreadsheet.mjs';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseImportArgv(argv) {
  const args = argv.slice(2);
  let apply = false;
  let mapPath = null;
  let sheet = undefined;
  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--map') {
      mapPath = args[i + 1] ?? '';
      i += 1;
    } else if (arg === '--sheet') {
      sheet = args[i + 1] ?? '';
      i += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }
  const farmQuery = positional[0]?.trim() ?? '';
  const filePath = positional[1] ?? '';
  const extras = positional.slice(2);
  return { farmQuery, filePath, mapPath, sheet, apply, extras };
}

function usage() {
  console.error(
    'Usage: node scripts/import-herd.mjs "<farm name or id>" <file.xlsx|file.csv> [--map mapping.json] [--sheet NAME] [--apply]',
  );
  console.error('');
  console.error(
    'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell (not in .env).',
  );
}

async function findFarm(client, query) {
  if (UUID_RE.test(query)) {
    const { data, error } = await client
      .from('farms')
      .select('id, name')
      .eq('id', query)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? [data] : [];
  }

  const exact = await client.from('farms').select('id, name').eq('name', query);
  if (exact.error) {
    throw new Error(exact.error.message);
  }
  if (exact.data?.length) {
    return exact.data;
  }

  const all = await client.from('farms').select('id, name');
  if (all.error) {
    throw new Error(all.error.message);
  }
  const folded = query.toLowerCase();
  return (all.data ?? []).filter((farm) => farm.name.toLowerCase() === folded);
}

async function fetchExistingAnimals(client, farmId) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from('animals')
      .select('id, name, tag_number')
      .eq('farm_id', farmId)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      return rows;
    }
    from += pageSize;
  }
}

async function fetchBreeds(client, farmId) {
  const { data: globalBreeds, error: globalErr } = await client
    .from('breeds')
    .select('id, name, farm_id')
    .is('farm_id', null);
  if (globalErr) {
    throw new Error(globalErr.message);
  }
  const { data: farmBreeds, error: farmErr } = await client
    .from('breeds')
    .select('id, name, farm_id')
    .eq('farm_id', farmId);
  if (farmErr) {
    throw new Error(farmErr.message);
  }
  return [...(globalBreeds ?? []), ...(farmBreeds ?? [])];
}

function printPlanSummary(plan, { dryRun }) {
  console.log('');
  console.log(dryRun ? '=== DRY RUN (no writes) ===' : '=== APPLY ===');
  console.log('');
  console.log(`To insert: ${plan.toInsert.length}`);
  for (const item of plan.toInsert) {
    const r = item.record;
    const parents = [
      r.dam_id ? `dam_id=${r.dam_id}` : r.dam_external_name ? `dam=${r.dam_external_name}` : null,
      r.sire_id ? `sire_id=${r.sire_id}` : r.sire_external_name ? `sire=${r.sire_external_name}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(
      `  row ${item.row} ${item.label}: ${r.sex}${r.date_of_birth ? ` dob ${r.date_of_birth}` : ''}${parents ? ` (${parents})` : ''}`,
    );
  }
  console.log('');
  console.log(`Skipped (already in farm): ${plan.skipped.length}`);
  for (const item of plan.skipped) {
    console.log(`  row ${item.row} ${item.label}: ${item.reason}`);
  }
  console.log('');
  console.log(`Problems: ${plan.problems.length}`);
  for (const item of plan.problems) {
    console.log(`  row ${item.row} ${item.label}: ${item.reason}`);
  }
  if (plan.newBreeds.length) {
    console.log('');
    console.log(`New farm breeds: ${plan.newBreeds.length}`);
    for (const breed of plan.newBreeds) {
      console.log(`  ${breed.name} (${breed.segment})`);
    }
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 */
export async function applyImportPlan(admin, farmId, plan) {
  const now = new Date().toISOString();
  if (plan.newBreeds.length) {
    const breedRows = plan.newBreeds.map((b) => ({
      id: b.id,
      farm_id: farmId,
      name: b.name,
      segment: b.segment,
      created_at: now,
    }));
    const { error } = await admin.from('breeds').insert(breedRows);
    if (error) {
      throw new Error(`breeds: ${error.message}`);
    }
  }

  if (plan.toInsert.length === 0) {
    return;
  }

  const animalRows = plan.toInsert.map((item) => ({
    ...item.record,
    farm_id: farmId,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await admin.from('animals').insert(animalRows);
  if (error) {
    throw new Error(`animals: ${error.message}`);
  }
}

export async function runImport(options) {
  const {
    admin,
    farmId,
    filePath,
    mapPath,
    sheet,
    apply,
    referenceIso = new Date().toISOString().slice(0, 10),
  } = options;

  const { headers, rows, sheetName } = await readSpreadsheet(filePath, { sheet });
  if (sheetName) {
    console.log(`Sheet: ${sheetName}`);
  }
  console.log(`Rows: ${rows.length}`);

  let mapping = guessColumnMapping(headers);
  if (mapPath) {
    const raw = await readFile(resolve(mapPath), 'utf8');
    const overrides = JSON.parse(raw);
    mapping = mergeColumnMapping(mapping, overrides);
  }

  console.log('');
  console.log('Column mapping used:');
  console.log(formatMappingForPrint(mapping));

  const existingAnimals = await fetchExistingAnimals(admin, farmId);
  const breeds = await fetchBreeds(admin, farmId);

  const plan = buildImportPlan({
    rows,
    headers,
    mapping,
    existingAnimals,
    breeds,
    referenceIso,
  });

  printPlanSummary(plan, { dryRun: !apply });

  if (!apply) {
    return { plan, applied: false };
  }

  if (plan.problems.length > 0) {
    throw new Error('Refusing --apply while problem rows exist. Fix the sheet or mapping first.');
  }

  await applyImportPlan(admin, farmId, plan);
  return { plan, applied: true };
}

async function main() {
  let parsed;
  try {
    parsed = parseImportArgv(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    process.exit(1);
  }

  const { farmQuery, filePath, mapPath, sheet, apply, extras } = parsed;
  if (!farmQuery || !filePath || extras.length > 0) {
    usage();
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.');
    usage();
    process.exit(1);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    console.error('SUPABASE_URL is not a valid URL.');
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  console.log(`Supabase project URL: ${parsedUrl.origin}`);
  console.log(
    apply
      ? 'This will INSERT goats into the farm (--apply).'
      : 'Dry run only (pass --apply to write).',
  );
  const answer = await rl.question('Type yes to continue: ');
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.error('Aborted.');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let farms;
  try {
    farms = await findFarm(admin, farmQuery);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (farms.length === 0) {
    console.error(`No farm found for: ${farmQuery}`);
    process.exit(1);
  }
  if (farms.length > 1) {
    console.error(`More than one farm matches "${farmQuery}":`);
    for (const farm of farms) {
      console.error(`  ${farm.id}  ${farm.name}`);
    }
    console.error('Pass the farm id instead.');
    process.exit(1);
  }

  const farm = farms[0];
  console.log(`Farm: ${farm.name} (${farm.id})`);

  try {
    const result = await runImport({
      admin,
      farmId: farm.id,
      filePath: resolve(filePath),
      mapPath,
      sheet,
      apply,
    });
    if (result.applied) {
      console.log('');
      console.log(`Inserted ${result.plan.toInsert.length} animals.`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
