#!/usr/bin/env node
/**
 * Delete one farm and its data (admin only).
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the shell environment ONLY.
 * Do not load .env. Never store the service role key in .env, git, or EXPO_PUBLIC_*.
 *
 * Usage: node scripts/admin-delete-farm.mjs "<farm name or farm id>" [--no-export-check]
 */

import { createClient } from '@supabase/supabase-js';
import { access } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DOCUMENTS_BUCKET = 'documents';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Matches export-farm-csv.mjs farm-scoped tables plus membership tables. */
export const FARM_SCOPED_TABLES = [
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
  'farm_members',
  'farm_invites',
];

/**
 * Child tables deleted before animals (see supabase/migrations FKs and seed-demo DELETE_ORDER).
 */
export const DELETE_TABLE_ORDER = [
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
  'farm_members',
];

export function parseArgv(argv) {
  const args = argv.slice(2);
  const noExportCheck = args.includes('--no-export-check');
  const positional = args.filter((arg) => arg !== '--no-export-check');
  const query = positional[0]?.trim() ?? '';
  const extras = positional.slice(1);
  return { query, noExportCheck, extras };
}

export function slugify(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'farm';
}

export function exportDirForFarm(farmName, dayIso) {
  const day = dayIso ?? new Date().toISOString().slice(0, 10);
  return resolve('exports', `${slugify(farmName)}-${day}`);
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '(unknown)';
  }
  const at = email.indexOf('@');
  if (at <= 0) {
    return '(unknown)';
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain) {
    return '(unknown)';
  }
  return `${local[0]}***@${domain}`;
}

export function isFarmNameConfirmed(typed, farmName) {
  return typed === farmName;
}

export function parseDeleteAuthUsersAnswer(typed) {
  const normalized = typed.trim().toLowerCase();
  if (!normalized || normalized === 'n' || normalized === 'no') {
    return false;
  }
  if (normalized === 'y' || normalized === 'yes') {
    return true;
  }
  return false;
}

function usage() {
  console.error(
    'Usage: node scripts/admin-delete-farm.mjs "<farm name or farm id>" [--no-export-check]',
  );
  console.error('');
  console.error(
    'Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the shell (not in .env).',
  );
  console.error(
    'Never put the service role key in .env or any EXPO_PUBLIC_* variable.',
  );
  console.error('');
  console.error(
    'Export the farm first: node scripts/export-farm-csv.mjs "<farm name or id>"',
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

async function countForFarm(client, table, farmId) {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('farm_id', farmId);
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function fetchMemberSummaries(client, farmId) {
  const { data: members, error } = await client
    .from('farm_members')
    .select('user_id, role')
    .eq('farm_id', farmId);
  if (error) {
    throw new Error(`farm_members: ${error.message}`);
  }

  const rows = [];
  for (const member of members ?? []) {
    const { data: userData, error: userError } =
      await client.auth.admin.getUserById(member.user_id);
    if (userError) {
      rows.push({
        userId: member.user_id,
        role: member.role,
        emailMasked: '(unknown)',
      });
      continue;
    }
    rows.push({
      userId: member.user_id,
      role: member.role,
      emailMasked: maskEmail(userData.user?.email ?? ''),
    });
  }
  return rows;
}

async function exportDirExists(dir) {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

async function collectDocumentStoragePaths(client, farmId) {
  const pageSize = 1000;
  const paths = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await client
      .from('documents')
      .select('storage_path')
      .eq('farm_id', farmId)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`documents: ${error.message}`);
    }
    for (const row of data ?? []) {
      if (row.storage_path) {
        paths.add(row.storage_path);
      }
    }
    if (!data || data.length < pageSize) {
      break;
    }
    from += pageSize;
  }
  return paths;
}

async function listStoragePathsRecursive(storage, prefix) {
  const paths = [];
  const { data, error } = await storage.list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) {
    throw new Error(`storage list ${prefix || '/'}: ${error.message}`);
  }
  for (const entry of data ?? []) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (!entry.metadata) {
      paths.push(...(await listStoragePathsRecursive(storage, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

async function removeStoragePaths(storage, paths) {
  const list = [...paths];
  let removed = 0;
  const batchSize = 100;
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    const { error } = await storage.remove(batch);
    if (error) {
      throw new Error(`storage remove: ${error.message}`);
    }
    removed += batch.length;
  }
  return removed;
}

async function clearAnimalParentLinks(client, farmId) {
  const { error } = await client
    .from('animals')
    .update({ dam_id: null, sire_id: null, litter_id: null })
    .eq('farm_id', farmId);
  if (error) {
    throw new Error(`animals: ${error.message}`);
  }
}

async function deleteFarmRows(client, table, farmId) {
  let total = 0;
  for (;;) {
    const { data, error } = await client
      .from(table)
      .delete()
      .eq('farm_id', farmId)
      .select('farm_id');
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    const deleted = data?.length ?? 0;
    if (deleted === 0) {
      return total;
    }
    total += deleted;
  }
}

async function deleteFarmRow(client, farmId) {
  const { data, error } = await client
    .from('farms')
    .delete()
    .eq('id', farmId)
    .select('id, name');
  if (error) {
    throw new Error(`farms: ${error.message}`);
  }
  if (!data?.length) {
    throw new Error('farms: delete returned no rows');
  }
  return data[0];
}

async function countMembershipsForUser(client, userId) {
  const { count, error } = await client
    .from('farm_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) {
    throw new Error(`farm_members: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteAuthUserIfOrphaned(client, userId) {
  const remaining = await countMembershipsForUser(client, userId);
  if (remaining > 0) {
    return { deleted: false, reason: 'still_member_of_another_farm' };
  }
  const { error } = await client.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`auth delete ${userId}: ${error.message}`);
  }
  return { deleted: true };
}

export async function printDeletionSummary({
  farm,
  members,
  rowCounts,
  exportDir,
  noExportCheck,
}) {
  console.log('');
  console.log('Deletion summary');
  console.log(`  Farm name: ${farm.name}`);
  console.log(`  Farm id:   ${farm.id}`);
  console.log('  Members:');
  if (!members.length) {
    console.log('    (none)');
  } else {
    for (const member of members) {
      console.log(
        `    ${member.emailMasked}  role=${member.role}  user_id=${member.userId}`,
      );
    }
  }
  console.log('  Row counts (farm-scoped tables):');
  for (const table of FARM_SCOPED_TABLES) {
    console.log(`    ${table}: ${rowCounts[table] ?? 0}`);
  }
  if (noExportCheck) {
    console.log('  CSV export check: skipped (--no-export-check)');
  } else if (exportDir) {
    console.log(`  CSV export: ${exportDir}`);
  }
  console.log('');
}

async function main() {
  const { query, noExportCheck, extras } = parseArgv(process.argv);
  if (!query || query.startsWith('-')) {
    usage();
    process.exit(1);
  }
  if (extras.length > 0) {
    console.error(`Unknown argument: ${extras[0]}`);
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

  console.log(`Supabase project URL: ${parsedUrl.origin}`);
  console.log(
    'This uses the service role key from your shell and permanently deletes one farm.',
  );

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let farms;
  try {
    farms = await findFarm(admin, query);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (farms.length === 0) {
    console.error(`No farm found for: ${query}`);
    process.exit(1);
  }
  if (farms.length > 1) {
    console.error(`More than one farm matches "${query}":`);
    for (const farm of farms) {
      console.error(`  ${farm.id}  ${farm.name}`);
    }
    console.error('Pass the farm id instead.');
    process.exit(1);
  }

  const farm = farms[0];
  const exportDir = exportDirForFarm(farm.name);
  if (!noExportCheck && !(await exportDirExists(exportDir))) {
    console.error(`No CSV export for this farm today: ${exportDir}`);
    console.error(
      'Run: node scripts/export-farm-csv.mjs "' +
        farm.name.replaceAll('"', '\\"') +
        '"',
    );
    console.error('Or pass --no-export-check if you exported elsewhere.');
    process.exit(1);
  }

  const rowCounts = {};
  try {
    for (const table of FARM_SCOPED_TABLES) {
      rowCounts[table] = await countForFarm(admin, table, farm.id);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  let members;
  try {
    members = await fetchMemberSummaries(admin, farm.id);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  await printDeletionSummary({
    farm,
    members,
    rowCounts,
    exportDir: noExportCheck ? null : exportDir,
    noExportCheck,
  });

  const rl = createInterface({ input, output });
  const nameAnswer = await rl.question(
    `Type the exact farm name to delete (${farm.name}): `,
  );
  if (!isFarmNameConfirmed(nameAnswer, farm.name)) {
    rl.close();
    console.error('Aborted: farm name did not match.');
    process.exit(1);
  }

  const authAnswer = await rl.question(
    'Also delete auth users who belong to no other farm? [y/N]: ',
  );
  rl.close();
  const deleteOrphanAuthUsers = parseDeleteAuthUsersAnswer(authAnswer);

  const memberUserIds = members.map((member) => member.userId);
  const deleted = {
    storageObjects: 0,
    tables: {},
    farm: null,
    authUsers: [],
  };

  try {
    const storage = admin.storage.from(DOCUMENTS_BUCKET);
    const pathsFromRows = await collectDocumentStoragePaths(admin, farm.id);
    const prefixPaths = await listStoragePathsRecursive(storage, farm.id);
    const allPaths = new Set([...pathsFromRows, ...prefixPaths]);
    if (allPaths.size > 0) {
      deleted.storageObjects = await removeStoragePaths(storage, allPaths);
    }

    await clearAnimalParentLinks(admin, farm.id);
    for (const table of DELETE_TABLE_ORDER) {
      deleted.tables[table] = await deleteFarmRows(admin, table, farm.id);
    }
    deleted.farm = await deleteFarmRow(admin, farm.id);

    if (deleteOrphanAuthUsers) {
      for (const userId of memberUserIds) {
        const result = await deleteAuthUserIfOrphaned(admin, userId);
        if (result.deleted) {
          const member = members.find((row) => row.userId === userId);
          deleted.authUsers.push({
            userId,
            emailMasked: member?.emailMasked ?? '(unknown)',
          });
        }
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('');
  console.log('Deleted:');
  console.log(
    `  storage (${DOCUMENTS_BUCKET} bucket): ${deleted.storageObjects} object(s)`,
  );
  for (const table of DELETE_TABLE_ORDER) {
    const count = deleted.tables[table] ?? 0;
    if (count > 0) {
      console.log(`  ${table}: ${count} row(s)`);
    }
  }
  if (deleted.farm) {
    console.log(`  farms: 1 row (${deleted.farm.name})`);
  }
  if (deleteOrphanAuthUsers) {
    if (deleted.authUsers.length === 0) {
      console.log('  auth.users: 0 (no orphaned members deleted)');
    } else {
      for (const user of deleted.authUsers) {
        console.log(`  auth.users: ${user.emailMasked} (${user.userId})`);
      }
    }
  } else {
    console.log('  auth.users: not requested');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
