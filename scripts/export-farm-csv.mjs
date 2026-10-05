#!/usr/bin/env node
/**
 * Export one farm's records to CSV (admin only).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the shell environment ONLY.
 * Do not load .env. Never store the service role key in .env, git, or EXPO_PUBLIC_*.
 *
 * Does not export farm_members or farm_invites (those rows hold other people's emails).
 *
 * Usage: node scripts/export-farm-csv.mjs "<farm name or farm id>"
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FARM_TABLES = [
  'animals',
  'breeds',
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
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Extra readable columns inserted immediately after the original id column. */
const READABLE_AFTER = {
  animals: {
    breed_primary_id: ['breed_name'],
    dam_id: ['dam_name', 'dam_tag'],
    sire_id: ['sire_name', 'sire_tag'],
    litter_id: ['litter_label'],
  },
  weight_logs: {
    animal_id: ['animal_name', 'animal_tag'],
    weigh_session_id: ['weigh_session_label'],
  },
  health_records: {
    animal_id: ['animal_name', 'animal_tag'],
  },
  breeding_events: {
    dam_id: ['dam_name', 'dam_tag'],
    sire_id: ['sire_name', 'sire_tag'],
    kidding_event_id: ['kidding_label'],
  },
  kidding_events: {
    dam_id: ['dam_name', 'dam_tag'],
    sire_id: ['sire_name', 'sire_tag'],
  },
  documents: {
    animal_id: ['animal_name', 'animal_tag'],
  },
  grazing_records: {
    animal_id: ['animal_name', 'animal_tag'],
    pasture_id: ['pasture_name'],
  },
  feed_logs: {
    pasture_id: ['pasture_name'],
  },
};

function usage() {
  console.error('Usage: node scripts/export-farm-csv.mjs "<farm name or farm id>"');
  console.error('');
  console.error(
    'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell (not in .env).',
  );
  console.error(
    'Never put the service role key in .env or any EXPO_PUBLIC_* variable.',
  );
}

function csvCell(value) {
  if (value == null) {
    return '';
  }
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'farm';
}

function animalBits(maps, id) {
  if (!id) {
    return { name: '', tag: '' };
  }
  const animal = maps.animals.get(id);
  if (!animal) {
    return { name: '', tag: '' };
  }
  return {
    name: animal.name ?? '',
    tag: animal.tag_number ?? '',
  };
}

function readableValues(table, column, row, maps) {
  switch (`${table}.${column}`) {
    case 'animals.breed_primary_id':
      return { breed_name: maps.breeds.get(row.breed_primary_id) ?? '' };
    case 'animals.dam_id':
    case 'breeding_events.dam_id':
    case 'kidding_events.dam_id': {
      const bits = animalBits(maps, row.dam_id);
      return { dam_name: bits.name, dam_tag: bits.tag };
    }
    case 'animals.sire_id':
    case 'breeding_events.sire_id':
    case 'kidding_events.sire_id': {
      const bits = animalBits(maps, row.sire_id);
      return { sire_name: bits.name, sire_tag: bits.tag };
    }
    case 'animals.litter_id':
      return { litter_label: maps.kidding.get(row.litter_id) ?? '' };
    case 'weight_logs.animal_id':
    case 'health_records.animal_id':
    case 'documents.animal_id':
    case 'grazing_records.animal_id': {
      const bits = animalBits(maps, row.animal_id);
      return { animal_name: bits.name, animal_tag: bits.tag };
    }
    case 'weight_logs.weigh_session_id':
      return {
        weigh_session_label: maps.sessions.get(row.weigh_session_id) ?? '',
      };
    case 'breeding_events.kidding_event_id':
      return { kidding_label: maps.kidding.get(row.kidding_event_id) ?? '' };
    case 'grazing_records.pasture_id':
    case 'feed_logs.pasture_id':
      return { pasture_name: maps.pastures.get(row.pasture_id) ?? '' };
    default:
      return {};
  }
}

function columnsFor(table, rows) {
  const seen = new Set();
  const base = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        base.push(key);
      }
    }
  }
  if (base.length === 0) {
    base.push('id', 'farm_id');
  }
  const extras = READABLE_AFTER[table] ?? {};
  const columns = [];
  for (const column of base) {
    columns.push(column);
    for (const extra of extras[column] ?? []) {
      columns.push(extra);
    }
  }
  return columns;
}

export function toCsv(table, rows, maps) {
  const columns = columnsFor(table, rows);
  const lines = [columns.map(csvCell).join(',')];
  for (const row of rows) {
    const enriched = { ...row };
    for (const column of Object.keys(READABLE_AFTER[table] ?? {})) {
      Object.assign(enriched, readableValues(table, column, row, maps));
    }
    lines.push(columns.map((column) => csvCell(enriched[column])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function fetchAll(client, table, farmId) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('farm_id', farmId)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      return rows;
    }
    from += pageSize;
  }
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

async function main() {
const query = process.argv[2];
if (!query || query.startsWith('-')) {
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
  'This uses the service role key from your shell and exports every row for one farm.',
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
  farms = await findFarm(admin, query.trim());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (farms.length === 0) {
  console.error(`No farm found for: ${query.trim()}`);
  process.exit(1);
}
if (farms.length > 1) {
  console.error(`More than one farm matches "${query.trim()}":`);
  for (const farm of farms) {
    console.error(`  ${farm.id}  ${farm.name}`);
  }
  console.error('Pass the farm id instead.');
  process.exit(1);
}

const farm = farms[0];
const day = new Date().toISOString().slice(0, 10);
const dir = resolve('exports', `${slugify(farm.name)}-${day}`);

try {
  const tables = {};
  for (const table of FARM_TABLES) {
    tables[table] = await fetchAll(admin, table, farm.id);
  }

  const { data: globalBreeds, error: breedError } = await admin
    .from('breeds')
    .select('id, name')
    .is('farm_id', null);
  if (breedError) {
    throw new Error(`breeds: ${breedError.message}`);
  }

  const maps = {
    animals: new Map(
      tables.animals.map((row) => [
        row.id,
        { name: row.name, tag_number: row.tag_number },
      ]),
    ),
    breeds: new Map([
      ...tables.breeds.map((row) => [row.id, row.name]),
      ...(globalBreeds ?? []).map((row) => [row.id, row.name]),
    ]),
    pastures: new Map(tables.pastures.map((row) => [row.id, row.name ?? ''])),
    sessions: new Map(
      tables.weigh_sessions.map((row) => [
        row.id,
        [row.date, row.weigh_point].filter(Boolean).join(' '),
      ]),
    ),
    kidding: new Map(
      tables.kidding_events.map((row) => [
        row.id,
        row.kid_date ? `kidding ${row.kid_date}` : 'kidding',
      ]),
    ),
  };

  await mkdir(dir, { recursive: true });
  for (const table of FARM_TABLES) {
    const csv = toCsv(table, tables[table], maps);
    await writeFile(resolve(dir, `${table}.csv`), csv, 'utf8');
    console.error(`${table}.csv  ${tables[table].length} rows`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

console.log(dir);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}