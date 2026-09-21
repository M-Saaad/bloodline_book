import { useQuery, useStatus, useSyncStream } from '@powersync/react';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { FARMS_FOR_USER_SQL, getFarmById } from '@/lib/db/farms';
import { mapFarm } from '@/lib/db/mappers';
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
  streams: [{ name: FARMS_SYNC_STREAM, waitForStream: true }],
  reportFetching: true,
};

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const activeFarmId = useUiStore((s) => s.activeFarmId);
  const setActiveFarmId = useUiStore((s) => s.setActiveFarmId);
  const [fallbackFarm, setFallbackFarm] = useState<Farm | null>(null);

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
    (!syncSettledForEmptyFarmCheck || farmsQueryFetching);

  const isLoading = Boolean(
    session && user && (farmsQueryLoading || awaitingFarmMembership),
  );

  const refreshFarms = useCallback(async () => {
    if (!user || !session) {
      return;
    }
    await refresh?.();
  }, [user, session, refresh]);

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
