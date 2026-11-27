import { useQuery } from '@powersync/react';
import { useEffect, useState } from 'react';

import { resolveFarmMemberRoleForActiveFarm } from '@/lib/db/farm-write-guard';
import {
  parseFarmMemberRole,
  resolveFarmRoleCapabilities,
  type FarmMemberRole,
} from '@/lib/domain/farm-role-access';
import { LOCAL_FARM_MEMBER_ROLE_SQL } from '@/lib/domain/farm-write-access';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

export type FarmRole = FarmMemberRole;

export type UseFarmRoleResult = {
  role: FarmRole | null;
  isHand: boolean;
  canWrite: boolean;
  isLoading: boolean;
  isRolePending: boolean;
  showReadOnlyBanner: boolean;
};

export function useFarmRole(): UseFarmRoleResult {
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const [fallbackRole, setFallbackRole] = useState<FarmRole | null>(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const { data: rows, isLoading: localLoading } = useQuery<{ role: string }>(
    user && activeFarm
      ? LOCAL_FARM_MEMBER_ROLE_SQL
      : 'SELECT 1 WHERE 0',
    user && activeFarm ? [activeFarm.id, user.id] : [],
  );

  const localRole = parseFarmMemberRole(rows?.[0]?.role);
  const localResolved = Boolean(user && activeFarm && !localLoading);

  useEffect(() => {
    setFallbackRole(null);
    setFallbackLoading(false);
  }, [activeFarm?.id, user?.id]);

  useEffect(() => {
    if (!user?.id || !activeFarm?.id || !localResolved || localRole != null) {
      return;
    }
    let cancelled = false;
    setFallbackLoading(true);
    void resolveFarmMemberRoleForActiveFarm(activeFarm.id, user.id, null).then(
      (remote) => {
        if (!cancelled) {
          setFallbackRole(remote);
          setFallbackLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setFallbackLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeFarm?.id, localResolved, localRole]);

  const role = localRole ?? fallbackRole;
  const { canWrite, isHand, isRolePending, showReadOnlyBanner } =
    resolveFarmRoleCapabilities(role, {
      localLoading: Boolean(user && activeFarm && localLoading),
      fallbackLoading,
    });

  return {
    role,
    isHand,
    canWrite,
    isLoading: isRolePending,
    isRolePending,
    showReadOnlyBanner,
  };
}