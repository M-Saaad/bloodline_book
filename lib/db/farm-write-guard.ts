import type { FarmMemberRole } from '@/lib/domain/farm-role-access';
import {
  FARM_WRITE_FORBIDDEN_MESSAGE,
  farmRoleCanWrite,
  parseFarmMemberRole,
} from '@/lib/domain/farm-role-access';
import { currentUserId } from '@/lib/db/tag-history';
import { getFarmMemberRoleFromSupabase } from '@/lib/db/farm-member-role';
import { powersync } from '@/lib/powersync/system';

export { FARM_WRITE_FORBIDDEN_MESSAGE };

export class FarmWriteForbiddenError extends Error {
  constructor(message = FARM_WRITE_FORBIDDEN_MESSAGE) {
    super(message);
    this.name = 'FarmWriteForbiddenError';
  }
}

export async function readLocalFarmMemberRole(
  farmId: string,
  userId: string,
): Promise<FarmMemberRole | null> {
  const row = await powersync.getOptional<{ role: string }>(
    `SELECT role FROM farm_members WHERE farm_id = ? AND user_id = ? LIMIT 1`,
    [farmId, userId],
  );
  return parseFarmMemberRole(row?.role);
}

/**
 * Last-line defense: block hand (or unknown) writes even if UI gates were bypassed.
 * Uses the local replica; callers should gate UI with useFarmRole().
 */
export async function assertFarmWriteAllowed(
  farmId: string,
  userId?: string | null,
): Promise<void> {
  const uid = userId ?? (await currentUserId());
  if (!uid) {
    throw new FarmWriteForbiddenError('Sign in to make changes.');
  }
  const role = await readLocalFarmMemberRole(farmId, uid);
  if (!farmRoleCanWrite(role)) {
    throw new FarmWriteForbiddenError();
  }
}

export async function assertFarmWriteAllowedForAnimal(animalId: string): Promise<string> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    'SELECT farm_id FROM animals WHERE id = ? LIMIT 1',
    [animalId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Animal not found.');
  }
  await assertFarmWriteAllowed(farmId);
  return farmId;
}

export async function assertFarmWriteAllowedForWeightLog(logId: string): Promise<void> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    `SELECT ws.farm_id as farm_id
     FROM weight_logs wl
     INNER JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
     WHERE wl.id = ?
     LIMIT 1`,
    [logId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Weight entry not found.');
  }
  await assertFarmWriteAllowed(farmId);
}

export async function assertFarmWriteAllowedForWeighSession(
  sessionId: string,
): Promise<void> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    'SELECT farm_id FROM weigh_sessions WHERE id = ? LIMIT 1',
    [sessionId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Weigh session not found.');
  }
  await assertFarmWriteAllowed(farmId);
}

export async function assertFarmWriteAllowedForTask(taskId: string): Promise<void> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    'SELECT farm_id FROM tasks WHERE id = ? LIMIT 1',
    [taskId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Task not found.');
  }
  await assertFarmWriteAllowed(farmId);
}

type FarmScopedTable =
  | 'breeding_events'
  | 'kidding_events'
  | 'health_records'
  | 'pastures'
  | 'feed_logs'
  | 'grazing_records'
  | 'transactions'
  | 'farm_invites';

export async function assertFarmWriteAllowedByRecord(
  table: FarmScopedTable,
  recordId: string,
): Promise<string> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    `SELECT farm_id FROM ${table} WHERE id = ? LIMIT 1`,
    [recordId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Record not found.');
  }
  await assertFarmWriteAllowed(farmId);
  return farmId;
}

export async function assertFarmWriteAllowedForKidding(kiddingId: string): Promise<string> {
  const row = await powersync.getOptional<{ farm_id: string }>(
    'SELECT farm_id FROM kidding_events WHERE id = ? LIMIT 1',
    [kiddingId],
  );
  const farmId = row?.farm_id;
  if (!farmId) {
    throw new Error('Kidding record not found.');
  }
  await assertFarmWriteAllowed(farmId);
  return farmId;
}

/** Resolve role for hooks: local SQLite first, then Supabase when online and local row is missing. */
export async function resolveFarmMemberRoleForActiveFarm(
  farmId: string,
  userId: string,
  localRole: FarmMemberRole | null,
): Promise<FarmMemberRole | null> {
  if (localRole) {
    return localRole;
  }
  return getFarmMemberRoleFromSupabase(farmId, userId);
}