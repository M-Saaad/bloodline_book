import { useQuery } from '@powersync/react';

import type { FarmMember } from '@/lib/types/tenancy';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

export type FarmRole = FarmMember['role'];

export function useFarmRole(): {
  role: FarmRole | null;
  isHand: boolean;
  canWrite: boolean;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { activeFarm } = useFarm();

  const { data: rows, isLoading } = useQuery<{ role: string }>(
    user && activeFarm
      ? `SELECT role FROM farm_members WHERE farm_id = ? AND user_id = ? LIMIT 1`
      : 'SELECT 1 WHERE 0',
    user && activeFarm ? [activeFarm.id, user.id] : [],
  );

  const roleRaw = rows?.[0]?.role;
  const role =
    roleRaw === 'owner' || roleRaw === 'manager' || roleRaw === 'hand'
      ? roleRaw
      : null;

  return {
    role,
    isHand: role === 'hand',
    canWrite: role !== 'hand',
    isLoading: Boolean(user && activeFarm && isLoading),
  };
}
