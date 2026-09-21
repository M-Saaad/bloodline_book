import { PowerSyncContext } from '@powersync/react';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { isPowerSyncConfigured } from '@/lib/powersync/config';
import {
  disconnectAndClearPowerSync,
  disconnectPowerSync,
  initPowerSync,
  powersync,
} from '@/lib/powersync/system';
import { useAuth } from '@/providers/AuthProvider';

export function PowerSyncProvider({ children }: { children: React.ReactNode }) {
  const { session, isConfigured } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const connectedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      if (!isConfigured || !session) {
        setIsReady(false);
        setConnectError(null);
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
        setIsReady(false);
        setConnectError(
          'EXPO_PUBLIC_POWERSYNC_URL is missing. Run bash scripts/setup-env.sh and restart Expo (npm run web).',
        );
        return;
      }

      try {
        setConnectError(null);
        const userId = session.user.id;
        if (
          connectedUserIdRef.current != null &&
          connectedUserIdRef.current !== userId
        ) {
          await disconnectAndClearPowerSync();
        }
        connectedUserIdRef.current = userId;
        await initPowerSync();
        if (!cancelled) {
          setIsReady(true);
        }
      } catch (error) {
        console.error('PowerSync connection failed:', error);
        if (!cancelled) {
          setIsReady(false);
          setConnectError(
            error instanceof Error
              ? error.message
              : 'PowerSync connection failed.',
          );
        }
      }
    }

    connect();

    return () => {
      cancelled = true;
      disconnectPowerSync().catch(() => undefined);
    };
  }, [session, isConfigured]);

  if (session && isConfigured && connectError) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Text className="text-lg font-semibold text-bloodline-800 mb-2">
          PowerSync not connected
        </Text>
        <Text className="text-center text-gray-600">{connectError}</Text>
      </View>
    );
  }

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
