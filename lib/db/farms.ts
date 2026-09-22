import * as Crypto from 'expo-crypto';

import { mapFarm } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import { supabase } from '@/lib/supabase/client';
import type { Farm } from '@/lib/types/tenancy';

export const FARMS_FOR_USER_SQL = `SELECT f.* FROM farms f
     INNER JOIN farm_members fm ON fm.farm_id = f.id
     WHERE fm.user_id = ?
     ORDER BY f.name`;

export async function getFarmsForUser(userId: string): Promise<Farm[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    FARMS_FOR_USER_SQL,
    [userId],
  );
  return rows.map(mapFarm);
}

/** Routing fallback when the local PowerSync replica is empty but the session is valid. */
export async function getFarmsForUserFromSupabase(
  userId: string,
): Promise<Farm[]> {
  const { data, error } = await supabase
    .from('farm_members')
    .select('farm_id, farms(*)')
    .eq('user_id', userId);

  if (error) {
    console.error('getFarmsForUserFromSupabase (farm_members):', error.message);
    return [];
  }
  if (!data?.length) {
    return [];
  }

  const farms: Farm[] = [];
  const missingFarmIds: string[] = [];

  for (const row of data) {
    const farmRow = row.farms;
    if (farmRow && typeof farmRow === 'object' && !Array.isArray(farmRow)) {
      farms.push(mapFarm(farmRow as Record<string, unknown>));
    } else if (row.farm_id) {
      missingFarmIds.push(String(row.farm_id));
    }
  }

  if (missingFarmIds.length > 0) {
    const { data: farmRows, error: farmsError } = await supabase
      .from('farms')
      .select('*')
      .in('id', missingFarmIds);

    if (farmsError) {
      console.error('getFarmsForUserFromSupabase (farms):', farmsError.message);
    } else {
      for (const row of farmRows ?? []) {
        farms.push(mapFarm(row as Record<string, unknown>));
      }
    }
  }

  const byId = new Map(farms.map((farm) => [farm.id, farm]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFarm(input: {
  name: string;
  segment: Farm['segment'];
  currency?: string;
  weightUnit?: Farm['weightUnit'];
}): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO farms (id, name, segment, currency, weight_unit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.segment,
      input.currency ?? 'USD',
      input.weightUnit ?? 'lb',
      now,
      now,
    ],
  );

  return id;
}

export async function getFarmById(farmId: string): Promise<Farm | null> {
  const row = await powersync.getOptional<Record<string, unknown>>(
    'SELECT * FROM farms WHERE id = ?',
    [farmId],
  );
  return row ? mapFarm(row) : null;
}

export async function updateFarmSettings(
  farmId: string,
  input: {
    name?: string;
    weightUnit?: Farm['weightUnit'];
    currency?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.weightUnit !== undefined) {
    fields.push('weight_unit = ?');
    values.push(input.weightUnit);
  }
  if (input.currency !== undefined) {
    fields.push('currency = ?');
    values.push(input.currency);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(farmId);

  await powersync.execute(
    `UPDATE farms SET ${fields.join(', ')} WHERE id = ?`,
    values,
  );
}
