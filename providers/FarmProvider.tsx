import { useQuery, useStatus, useSyncStream } from '@powersync/react';
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
import { withTimeout } from '@/lib/network/online';
import { reconnectPowerSync } from '@/lib/powersync/system';
import { useUiStore } from '@/lib/store/ui';
import type { Farm } from '@/lib/types/tenancy';
import { useAuth } from '@/providers/AuthProvider';

interface FarmContextValue {
  farms: Farm[];
  activeFarm: Farm | null;
  isLoading: boolean;
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
  const [fallbackFarm, setFallbackFarm] = useState<Farm | null>(null);
  const [bootstrapFarms, setBootstrapFarms] = useState<Farm[] | null>(null);
  const staleSyncRecoveryAttemptedRef = useRef(false);

  const syncStatus = useStatus();
  const farmStreamStatus = useSyncStream({ name: FARMS_SYNC_STREAM });
  const farmDataStreamSynced =
    farmStreamStatus?.subscription?.hasSynced === true;

  const {
    data: farmRows,
    isFetching: farmsQueryFetching,
    refresh,
  } = useQuery<Record<string, unknown>>(
    user ? FARMS_FOR_USER_SQL : EMPTY_FARMS_QUERY,
    user ? [user.id] : [],
    user ? FARMS_QUERY_OPTIONS : undefined,
  );

  const localFarms = useMemo(
    () => (user ? (farmRows ?? []).map(mapFarm) : []),
    [farmRows, user],
  );

  const farms = useMemo(() => {
    if (localFarms.length > 0) {
      return localFarms;
    }
    return bootstrapFarms ?? [];
  }, [localFarms, bootstrapFarms]);

  const syncSettledForEmptyFarmCheck =
    farmDataStreamSynced &&
    !syncStatus.downloading &&
    !syncStatus.connecting;

  const isLoading = Boolean(
    session && user && localFarms.length === 0 && bootstrapFarms === null,
  );

  const refreshFarms = useCallback(async () => {
    const userId = user?.id;
    if (!userId || !session) {
      return;
    }

    await refresh?.();

    const local = await getFarmsForUser(userId);
    if (local.length > 0) {
      setBootstrapFarms(null);
      return;
    }

    try {
      setBootstrapFarms(await getFarmsForUserFromSupabase(userId));
    } catch (error) {
      console.error('Supabase farm bootstrap failed:', error);
      setBootstrapFarms([]);
    }
  }, [user, session, refresh]);

  useEffect(() => {
    staleSyncRecoveryAttemptedRef.current = false;
    setBootstrapFarms(null);
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (!userId || !session) {
      return;
    }

    let cancelled = false;

    void getFarmsForUser(userId).then((local) => {
      if (!cancelled && local.length > 0) {
        setBootstrapFarms(local);
      }
    });

    withTimeout(getFarmsForUserFromSupabase(userId), 8000, 'farm bootstrap')
      .then((serverFarms) => {
        if (!cancelled) {
          setBootstrapFarms(serverFarms);
        }
      })
      .catch((error) => {
        console.error('Supabase farm bootstrap failed:', error);
        if (!cancelled) {
          setBootstrapFarms((previous) => previous ?? []);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, session]);

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

  useEffect(() => {
    if (localFarms.length > 0) {
      setBootstrapFarms(null);
    }
  }, [localFarms.length]);

  useEffect(() => {
    if (farms.length === 0) {
      return;
    }
    if (!activeFarmId || !farms.some((f) => f.id === activeFarmId)) {
      setActiveFarmId(farms[0].id);
    }
  }, [farms, activeFarmId, setActiveFarmId]);

  useEffect(() => {
    if (!activeFarmId) {
      setFallbackFarm(null);
      return;
    }
    if (farms.some((f) => f.id === activeFarmId)) {
      setFallbackFarm(null);
      return;
    }

    getFarmById(activeFarmId).then(setFallbackFarm);
  }, [activeFarmId, farms]);

  const activeFarm =
    farms.find((farm) => farm.id === activeFarmId) ?? fallbackFarm ?? null;

  const value = useMemo(
    () => ({
      farms,
      activeFarm,
      isLoading,
      setActiveFarmId,
      refreshFarms,
    }),
    [farms, activeFarm, isLoading, setActiveFarmId, refreshFarms],
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
