import { PowerSyncContext } from '@powersync/react';
import React, { useEffect, useRef } from 'react';

import { isPowerSyncConfigured } from '@/lib/powersync/config';
import {
  connectPowerSyncBackend,
  disconnectAndClearPowerSync,
  disconnectPowerSync,
  preparePowerSync,
  powersync,
} from '@/lib/powersync/system';
import { useAuth } from '@/providers/AuthProvider';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session, isConfigured } = useAuth();
  const connectedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!isConfigured || !session) {
        connectedUserIdRef.current = null;
        try {
          await disconnectAndClearPowerSync();
        } catch {
          try {
            await disconnectPowerSync();
          } catch {
            // ignore when not connected
          }
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
        const userId = session.user.id;
        if (
          connectedUserIdRef.current != null &&
          connectedUserIdRef.current !== userId
        ) {
          await disconnectAndClearPowerSync();
        }
        connectedUserIdRef.current = userId;
        await preparePowerSync();
        if (!cancelled) {
          await connectPowerSyncBackend();
        }
      } catch (error) {
        console.error('PowerSync connection failed:', error);
      }
    }

    connect();

    return () => {
      cancelled = true;
      disconnectPowerSync().catch(() => undefined);
    };
  }, [session, isConfigured]);

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
}
