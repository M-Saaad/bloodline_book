import * as Crypto from 'expo-crypto';

import { mapFarm } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import type { Farm } from '@/lib/types/tenancy';

export async function getFarmsForUser(userId: string): Promise<Farm[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT f.* FROM farms f
     INNER JOIN farm_members fm ON fm.farm_id = f.id
     WHERE fm.user_id = ?
     ORDER BY f.name`,
    [userId],
  );
  return rows.map(mapFarm);
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
