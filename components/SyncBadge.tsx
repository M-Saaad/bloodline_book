import { useQuery, useStatus } from '@powersync/react';
import { router } from 'expo-router';
import { useNetworkState } from 'expo-network';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { deviceHasSignal, resolveSyncBadge } from '@/lib/domain/sync-badge';
import { powersync } from '@/lib/powersync/system';

export function SyncBadge() {
  const status = useStatus();
  const network = useNetworkState();
  const [queueCount, setQueueCount] = useState(0);

  const { data: failureRows } = useQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM upload_failures',
    [],
  );

  const failureCount = failureRows?.[0]?.c ?? 0;
  const deviceOnline = deviceHasSignal(network);

  useEffect(() => {
    let cancelled = false;

    async function refreshQueue() {
      try {
        const stats = await powersync.getUploadQueueStats();
        if (!cancelled) {
          setQueueCount(stats.count);
        }
      } catch {
        // Keep the last count. Clearing it while offline left the badge on "Saving…".
      }
    }

    refreshQueue();
    const interval = setInterval(refreshQueue, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status.uploading, status.connected, deviceOnline]);

  const badge = useMemo(
    () =>
      resolveSyncBadge({
        failureCount,
        queueCount,
        connected: status.connected === true,
        uploading: status.uploading === true,
        deviceOnline,
      }),
    [
      deviceOnline,
      failureCount,
      queueCount,
      status.connected,
      status.uploading,
    ],
  );

  // Icon + word + color, never color alone. Black means a problem needs you.
  const tone =
    badge.kind === 'not_saved'
      ? { box: 'bg-stop border-stop', text: 'text-white', symbol: '⚠' }
      : badge.kind === 'offline_waiting'
        ? { box: 'bg-[#fff1cc] border-[#e5c77a]', text: 'text-[#6b3a00]', symbol: '◔' }
        : badge.kind === 'saving'
          ? { box: 'bg-[#e1edf8] border-[#b9d3ec]', text: 'text-[#17476f]', symbol: '↻' }
          : { box: 'bg-[#ddf0e4] border-[#b7dcc4]', text: 'text-[#0f5a33]', symbol: '✓' };

  function handlePress() {
    if (badge.kind === 'not_saved') {
      router.push('/(tabs)/more/changes-not-saved');
    }
  }

  const pressable = badge.kind === 'not_saved';

  return (
    <Pressable
      onPress={pressable ? handlePress : undefined}
      disabled={!pressable}
      className={`rounded-full border px-3 py-1.5 mr-2 ${tone.box}`}
      accessibilityRole={pressable ? 'button' : 'text'}
      accessibilityLabel={badge.label}>
      <Text className={`text-sm font-bold ${tone.text}`}>
        {tone.symbol} {badge.label}
      </Text>
    </Pressable>
  );
}

export function syncBadgeHeaderRight() {
  return () => <SyncBadge />;
}
