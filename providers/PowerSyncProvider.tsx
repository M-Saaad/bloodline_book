import { PowerSyncContext } from '@powersync/react';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  disconnectPowerSync,
  initPowerSync,
  powersync,
} from '@/lib/powersync/system';
import { useAuth } from '@/providers/AuthProvider';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session, isConfigured } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!isConfigured || !session) {
        setIsReady(false);
        try {
          await disconnectPowerSync();
        } catch {
          // ignore when not connected
        }
        return;
      }

      try {
        await initPowerSync();
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('PowerSync connection failed:', error);
        if (!cancelled) {
          setIsReady(false);
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      disconnectPowerSync().catch(() => undefined);
    };
  }, [session, isConfigured]);

  if (session && isConfigured && !isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#ca4034" />
      </View>
    );
  }

  return (
    <PowerSyncContext.Provider value={powersync}>
      {children}
    </PowerSyncContext.Provider>
  );
}
