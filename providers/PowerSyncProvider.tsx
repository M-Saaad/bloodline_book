import { PowerSyncContext } from '@powersync/react';
import React, { useEffect } from 'react';

import { isPowerSyncConfigured } from '@/lib/powersync/config';
import {
  connectPowerSyncBackend,
  disconnectPowerSync,
  preparePowerSync,
  powersync,
} from '@/lib/powersync/system';
import { useAuth } from '@/providers/AuthProvider';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session, isConfigured, isLoading } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    let cancelled = false;

    async function connect() {
      if (!isConfigured || userId == null) {
        try {
          await disconnectPowerSync();
        } catch {
          // ignore when not connected
        }
        return;
      }

      if (!isPowerSyncConfigured()) {
        console.error(
          'EXPO_PUBLIC_POWERSYNC_URL is missing. Run bash scripts/setup-env.sh and restart Expo (npm run web).',
        );
        return;
      }

      try {
        await preparePowerSync();
        if (!cancelled) {
          await connectPowerSyncBackend();
        }
      } catch (error) {
        console.error('PowerSync connection failed:', error);
      }
    }

    void connect();

    return () => {
      cancelled = true;
    };
  }, [userId, isConfigured, isLoading]);

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
}
