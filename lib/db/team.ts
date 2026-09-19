import * as Crypto from 'expo-crypto';

import { mapFarmInvite, mapFarmMember } from '@/lib/db/mappers';
import { powersync } from '@/lib/powersync/system';
import type { FarmInvite } from '@/lib/types/team';
import type { FarmMember } from '@/lib/types/tenancy';

export async function getFarmMembers(farmId: string): Promise<FarmMember[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    'SELECT * FROM farm_members WHERE farm_id = ? ORDER BY created_at',
    [farmId],
  );
  return rows.map(mapFarmMember);
}

export async function getFarmInvites(farmId: string): Promise<FarmInvite[]> {
  const rows = await powersync.getAll<Record<string, unknown>>(
    `SELECT * FROM farm_invites
     WHERE farm_id = ?
     ORDER BY created_at DESC`,
    [farmId],
  );
  return rows.map(mapFarmInvite);
}

export async function createFarmInvite(
  farmId: string,
  input: { email: string; role: FarmInvite['role'] },
): Promise<string> {
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await powersync.execute(
    `INSERT INTO farm_invites (id, farm_id, email, role, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [id, farmId, input.email.trim().toLowerCase(), input.role, now],
  );

  return id;
}

export async function revokeFarmInvite(inviteId: string): Promise<void> {
  await powersync.execute(
    `UPDATE farm_invites SET status = 'revoked' WHERE id = ?`,
    [inviteId],
  );
}
