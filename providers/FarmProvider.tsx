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

import { FARMS_FOR_USER_SQL, getFarmById } from '@/lib/db/farms';
import { mapFarm } from '@/lib/db/mappers';
import { reconnectPowerSync } from '@/lib/powersync/system';
import { useUiStore } from '@/lib/store/ui';
import type { Farm } from '@/lib/types/tenancy';
import { supabase } from '@/lib/supabase/client';
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
  streams: [{ name: FARMS_SYNC_STREAM, waitForStream: true }],
  reportFetching: true,
};

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const activeFarmId = useUiStore((s) => s.activeFarmId);
  const setActiveFarmId = useUiStore((s) => s.setActiveFarmId);
  const [fallbackFarm, setFallbackFarm] = useState<Farm | null>(null);
  const staleSyncRecoveryAttemptedRef = useRef(false);
  const [isRecoveringStaleSync, setIsRecoveringStaleSync] = useState(false);

  const syncStatus = useStatus();
  const farmStreamStatus = useSyncStream({ name: FARMS_SYNC_STREAM });
  const farmDataStreamSynced =
    farmStreamStatus?.subscription?.hasSynced === true;

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

  const farms = useMemo(
    () => (user ? (farmRows ?? []).map(mapFarm) : []),
    [farmRows, user],
  );

  const syncSettledForEmptyFarmCheck =
    farmDataStreamSynced &&
    !syncStatus.downloading &&
    !syncStatus.connecting;

  // waitForStream can flip before replicated rows are visible in the farms JOIN, and
  // global SyncStatus.hasSynced can be true before the farm_data stream finishes — gate
  // on stream-specific sync plus reportFetching (PR #16 omitted reportFetching on web).
  const awaitingFarmMembership =
    Boolean(session && user) &&
    farms.length === 0 &&
    (!syncSettledForEmptyFarmCheck ||
      farmsQueryFetching ||
      isRecoveringStaleSync);

  const isLoading = Boolean(
    session &&
      user &&
      (farmsQueryLoading || awaitingFarmMembership || isRecoveringStaleSync),
  );

  const refreshFarms = useCallback(async () => {
    if (!user || !session) {
      return;
    }
    await refresh?.();
  }, [user, session, refresh]);

  useEffect(() => {
    staleSyncRecoveryAttemptedRef.current = false;
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id;
    if (
      !userId ||
      !session ||
      farms.length > 0 ||
      farmsQueryFetching ||
      !syncSettledForEmptyFarmCheck ||
      staleSyncRecoveryAttemptedRef.current
    ) {
      return;
    }

    let cancelled = false;

    async function recoverStaleLocalReplica() {
      const { data, error } = await supabase
        .from('farm_members')
        .select('farm_id')
        .eq('user_id', userId)
        .limit(1);

      if (cancelled || error || !data?.length) {
        return;
      }

      staleSyncRecoveryAttemptedRef.current = true;
      setIsRecoveringStaleSync(true);
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
      } finally {
        if (!cancelled) {
          setIsRecoveringStaleSync(false);
        }
      }
    }

    recoverStaleLocalReplica();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    session,
    farms.length,
    farmsQueryFetching,
    syncSettledForEmptyFarmCheck,
    refresh,
  ]);

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
