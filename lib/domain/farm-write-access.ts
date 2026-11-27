import {
  FARM_WRITE_FORBIDDEN_MESSAGE,
  farmRoleCanWrite,
  parseFarmMemberRole,
  type FarmMemberRole,
} from '@/lib/domain/farm-role-access';

export { FARM_WRITE_FORBIDDEN_MESSAGE };

export class FarmWriteForbiddenError extends Error {
  constructor(message = FARM_WRITE_FORBIDDEN_MESSAGE) {
    super(message);
    this.name = 'FarmWriteForbiddenError';
  }
}

/**
 * PowerSync stores uuids as text. SQLite `=` is case-sensitive, so compare
 * both sides with lower().
 */
export const LOCAL_FARM_MEMBER_ROLE_SQL =
  'SELECT role FROM farm_members WHERE lower(farm_id) = lower(?) AND lower(user_id) = lower(?) LIMIT 1';

export type LocalRoleDb = {
  getOptional<T>(sql: string, parameters?: unknown[]): Promise<T | null>;
};

export async function readLocalFarmMemberRoleFrom(
  db: LocalRoleDb,
  farmId: string,
  userId: string,
): Promise<FarmMemberRole | null> {
  const row = await db.getOptional<{ role: string }>(LOCAL_FARM_MEMBER_ROLE_SQL, [
    farmId,
    userId,
  ]);
  return parseFarmMemberRole(row?.role);
}

/**
 * Local owner/manager may write. A local hand may not.
 * A missing local row checks Supabase; a failed check (offline) stays read-only.
 */
export async function decideFarmWrite(input: {
  readLocal: () => Promise<FarmMemberRole | null>;
  readRemote: () => Promise<FarmMemberRole | null>;
}): Promise<void> {
  const localRole = await input.readLocal();
  switch (localRole) {
    case 'owner':
    case 'manager':
      return;
    case 'hand':
      throw new FarmWriteForbiddenError();
    case null: {
      let remoteRole: FarmMemberRole | null;
      try {
        remoteRole = await input.readRemote();
      } catch {
        remoteRole = null;
      }
      if (!farmRoleCanWrite(remoteRole)) {
        throw new FarmWriteForbiddenError();
      }
      return;
    }
    default: {
      const _exhaustive: never = localRole;
      throw new FarmWriteForbiddenError(_exhaustive);
    }
  }
}
