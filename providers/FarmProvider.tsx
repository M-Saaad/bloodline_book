import { useQuery, useStatus, useSyncStream } from '@powersync/react';
import { useNetworkState } from 'expo-network';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FARMS_FOR_USER_SQL,
  getFarmById,
  getFarmsForUser,
  getFarmsForUserFromSupabase,
} from '@/lib/db/farms';
import { mapFarm } from '@/lib/db/mappers';
import {
  mergeFarmLists,
  resolveActiveFarmId,
  savedFarmIdForUser,
} from '@/lib/domain/active-farm';
import { shouldShowReplicaLoading } from '@/lib/domain/offline-replica';
import { deviceHasSignal } from '@/lib/domain/sync-badge';
import { reconnectPowerSync } from '@/lib/powersync/system';
import { useUiStore } from '@/lib/store/ui';
import type { Farm } from '@/lib/types/tenancy';
import { useAuth } from '@/providers/AuthProvider';

interface FarmContextValue {
  farms: Farm[];
  activeFarm: Farm | null;
  isLoading: boolean;
  /** True once a direct local read or the watched query has answered. */
  localFarmsResolved: boolean;
  /** True after this device has finished a sync at least once. */
  hasSyncedBefore: boolean | undefined;
  setActiveFarmId: (farmId: string) => void;
  refreshFarms: () => Promise<void>;
}

const FarmContext = createContext<FarmContextValue | null>(null);

const EMPTY_FARMS_QUERY = 'SELECT 1 WHERE 0';

/** Matches `farm_data` in powersync/sync-config.yaml (auto_subscribe). */
const FARMS_SYNC_STREAM = 'farm_data';

const FARMS_QUERY_OPTIONS = {
  streams: [{ name: FARMS_SYNC_STREAM, waitForStream: false }],
  reportFetching: true,
};

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const activeFarmId = useUiStore((s) => s.activeFarmId);
  const setActiveFarmId = useUiStore((s) => s.setActiveFarmId);
  const rememberedFarm = useUiStore((s) => s.rememberedFarm);
  const activeFarmHydrated = useUiStore((s) => s.activeFarmHydrated);
  const rememberActiveFarmId = useUiStore((s) => s.rememberActiveFarmId);
  const [fallbackFarm, setFallbackFarm] = useState<Farm | null>(null);
  const [bootstrapFarms, setBootstrapFarms] = useState<Farm[] | null>(null);
  const [readLocalFarms, setReadLocalFarms] = useState<Farm[] | null>(null);
  const [farmsForUserId, setFarmsForUserId] = useState<string | null>(null);
  const [selectionUserId, setSelectionUserId] = useState<
    string | null | undefined
  >(undefined);
  const network = useNetworkState();
  const staleSyncRecoveryAttemptedRef = useRef(false);
  const signedIn = Boolean(session);
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const deviceOnline = deviceHasSignal(network);
  const listsBelongToUser = farmsForUserId === userId;

  if (!listsBelongToUser) {
    setFarmsForUserId(userId);
    setReadLocalFarms(null);
    setBootstrapFarms(null);
  }

  if (activeFarmHydrated && selectionUserId !== userId) {
    setSelectionUserId(userId);
    const savedForThisUser = savedFarmIdForUser(rememberedFarm, userId);
    if (savedForThisUser !== activeFarmId) {
      setActiveFarmId(savedForThisUser);
    }
  } else if (
    activeFarmHydrated &&
    selectionUserId === userId &&
    activeFarmId == null
  ) {
    const savedForThisUser = savedFarmIdForUser(rememberedFarm, userId);
    if (savedForThisUser) {
      setActiveFarmId(savedForThisUser);
    }
  }

  const syncStatus = useStatus();
  const farmStreamStatus = useSyncStream({ name: FARMS_SYNC_STREAM });
  const farmDataStreamSynced =
    farmStreamStatus?.subscription?.hasSynced === true;
  const hasSyncedBefore =
    syncStatus.hasSynced === true || farmDataStreamSynced
      ? true
      : syncStatus.hasSynced;

  const {
    data: farmRows,
    isLoading: farmsQueryLoading,
    isFetching: farmsQueryFetching,
    refresh,
  } = useQuery<Record<string, unknown>>(
    user ? FARMS_FOR_USER_SQL : EMPTY_FARMS_QUERY,
    user ? [user.id] : [],
    user ? FARMS_QUERY_OPTIONS : undefined,
  );

  const queryFarms = useMemo(() => {
    if (!user || !listsBelongToUser) {
      return [];
    }
    return (farmRows ?? [])
      .filter(
        (row) =>
          String(row.member_user_id ?? '').toLowerCase() === user.id.toLowerCase(),
      )
      .map(mapFarm);
  }, [farmRows, listsBelongToUser, user]);
  const localFarms = useMemo(() => {
    if (!listsBelongToUser) {
      return [];
    }
    if (queryFarms.length > 0) {
      return queryFarms;
    }
    if (readLocalFarms && readLocalFarms.length > 0) {
      return readLocalFarms;
    }
    return queryFarms;
  }, [listsBelongToUser, queryFarms, readLocalFarms]);
  const localFarmsResolved =
    !user || readLocalFarms !== null || !farmsQueryLoading;

  const serverFarms = listsBelongToUser ? bootstrapFarms : null;
  const farms = useMemo(
    () => mergeFarmLists(localFarms, serverFarms),
    [localFarms, serverFarms],
  );

  const syncSettledForEmptyFarmCheck =
    farmDataStreamSynced &&
    !syncStatus.downloading &&
    !syncStatus.connecting;

  const isLoading = Boolean(
    session &&
      user &&
      shouldShowReplicaLoading({
        hasSynced: hasSyncedBefore,
        localRowCount: localFarms.length,
        localQueryLoading: !localFarmsResolved,
        emptyBootstrapPending:
          deviceOnline !== false && bootstrapFarms === null,
      }),
  );

  const refreshFarms = useCallback(async () => {
    const requestedUserId = user?.id;
    if (!requestedUserId || !session) {
      return;
    }

    await refresh?.();
    if (userIdRef.current !== requestedUserId) {
      return;
    }

    const local = await getFarmsForUser(requestedUserId);
    if (userIdRef.current !== requestedUserId) {
      return;
    }
    setReadLocalFarms(local);
    if (deviceOnline !== true) {
      return;
    }

    try {
      const rows = await getFarmsForUserFromSupabase(requestedUserId);
      if (userIdRef.current !== requestedUserId) {
        return;
      }
      setBootstrapFarms(rows);
    } catch (error) {
      console.error('Supabase farm bootstrap failed:', error);
      if (userIdRef.current !== requestedUserId) {
        return;
      }
      setBootstrapFarms((current) => current ?? []);
    }
  }, [deviceOnline, user, session, refresh]);

  useEffect(() => {
    staleSyncRecoveryAttemptedRef.current = false;
  }, [userId]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !signedIn) {
      return;
    }

    let cancelled = false;
    getFarmsForUser(userId)
      .then((rows) => {
        if (!cancelled) {
          setReadLocalFarms(rows);
        }
      })
      .catch((error: unknown) => {
        console.error('Local farm read failed:', error);
        if (!cancelled) {
          setReadLocalFarms([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn, user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !session || deviceOnline !== true) {
      return;
    }

    let cancelled = false;

    getFarmsForUserFromSupabase(userId)
      .then((rows) => {
        if (!cancelled) {
          setBootstrapFarms(rows);
        }
      })
      .catch((error) => {
        console.error('Supabase farm bootstrap failed:', error);
        if (!cancelled) {
          setBootstrapFarms((current) => current ?? []);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deviceOnline, user, session]);

  useEffect(() => {
    const userId = user?.id;
    if (
      !userId ||
      !session ||
      localFarms.length > 0 ||
      farmsQueryFetching ||
      !syncSettledForEmptyFarmCheck ||
      staleSyncRecoveryAttemptedRef.current ||
      (bootstrapFarms ?? []).length === 0
    ) {
      return;
    }

    let cancelled = false;
    staleSyncRecoveryAttemptedRef.current = true;

    async function recoverStaleLocalReplica() {
      console.warn(
        'Farm membership exists on server but local PowerSync replica is empty — reconnecting sync.',
      );
      try {
        await reconnectPowerSync();
        if (!cancelled) {
          await refresh?.();
        }
      } catch (recoveryError) {
        console.error('PowerSync stale-sync recovery failed:', recoveryError);
      }
    }

    recoverStaleLocalReplica();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    session,
    localFarms.length,
    farmsQueryFetching,
    syncSettledForEmptyFarmCheck,
    bootstrapFarms,
    refresh,
  ]);

  const preferredFarmId = selectionUserId === userId ? activeFarmId : null;
  const resolvedFarmId = activeFarmHydrated
    ? resolveActiveFarmId({ farms, preferredFarmId })
    : null;

  useEffect(() => {
    if (!activeFarmHydrated || !userId || farms.length === 0) {
      return;
    }
    if (selectionUserId !== userId) {
      return;
    }
    if (resolvedFarmId && resolvedFarmId !== activeFarmId) {
      setActiveFarmId(resolvedFarmId);
    }
  }, [
    activeFarmHydrated,
    userId,
    selectionUserId,
    farms.length,
    resolvedFarmId,
    activeFarmId,
    setActiveFarmId,
  ]);

  useEffect(() => {
    if (!resolvedFarmId) {
      setFallbackFarm(null);
      return;
    }
    if (farms.some((farm) => farm.id === resolvedFarmId)) {
      setFallbackFarm(null);
      return;
    }
    if (farms.length > 0) {
      setFallbackFarm(null);
      return;
    }

    getFarmById(resolvedFarmId).then(setFallbackFarm);
  }, [resolvedFarmId, farms]);

  const activeFarm =
    farms.find((farm) => farm.id === resolvedFarmId) ?? fallbackFarm ?? null;

  const chooseActiveFarmId = useCallback(
    (farmId: string) => {
      if (!userId) {
        return;
      }
      rememberActiveFarmId(userId, farmId);
    },
    [rememberActiveFarmId, userId],
  );

  const value = useMemo(
    () => ({
      farms,
      activeFarm,
      isLoading,
      localFarmsResolved,
      hasSyncedBefore,
      setActiveFarmId: chooseActiveFarmId,
      refreshFarms,
    }),
    [
      farms,
      activeFarm,
      isLoading,
      localFarmsResolved,
      hasSyncedBefore,
      chooseActiveFarmId,
      refreshFarms,
    ],
  );

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarm(): FarmContextValue {
  const context = useContext(FarmContext);
  if (!context) {
    throw new Error('useFarm must be used within FarmProvider');
  }
  return context;
}

/** Remount farm screens when the active farm changes so queries and stacks refresh. */
export function useFarmScopeKey(): string {
  const { activeFarm } = useFarm();
  return activeFarm?.id ?? 'none';
}
