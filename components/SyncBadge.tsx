import { useQuery, useStatus } from '@powersync/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { powersync } from '@/lib/powersync/system';

type SyncBadgeState =
  | { kind: 'all_saved'; label: 'All saved' }
  | { kind: 'saving'; label: 'Saving…' }
  | { kind: 'offline_waiting'; label: string; count: number }
  | { kind: 'not_saved'; label: string; count: number };

export function SyncBadge() {
  const status = useStatus();
  const [queueCount, setQueueCount] = useState(0);

  const { data: failureRows } = useQuery<{ c: number }>(
    'SELECT COUNT(*) AS c FROM upload_failures',
  );

  const failureCount = failureRows?.[0]?.c ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function refreshQueue() {
      try {
        const stats = await powersync.getUploadQueueStats();
        if (!cancelled) {
          setQueueCount(stats.count);
        }
      } catch {
        if (!cancelled) {
          setQueueCount(0);
        }
      }
    }

    refreshQueue();
    const interval = setInterval(refreshQueue, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status.uploading, status.connected]);

  const badge = useMemo((): SyncBadgeState => {
    if (failureCount > 0) {
      return {
        kind: 'not_saved',
        count: failureCount,
        label: `${failureCount} not saved`,
      };
    }

    const online = status.connected === true;
    const uploading = status.uploading === true || queueCount > 0;

    if (!online && queueCount > 0) {
      return {
        kind: 'offline_waiting',
        count: queueCount,
        label: `Offline · ${queueCount} waiting`,
      };
    }

    if (uploading) {
      return { kind: 'saving', label: 'Saving…' };
    }

    return { kind: 'all_saved', label: 'All saved' };
  }, [failureCount, queueCount, status.connected, status.uploading]);

  const toneClass =
    badge.kind === 'not_saved'
      ? 'text-red-700 bg-red-50 border-red-200'
      : badge.kind === 'offline_waiting'
        ? 'text-amber-800 bg-amber-50 border-amber-200'
        : badge.kind === 'saving'
          ? 'text-bloodline-800 bg-bloodline-50 border-bloodline-200'
          : 'text-gray-700 bg-white border-gray-200';

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
      className={`rounded-full border px-2.5 py-1 mr-2 ${toneClass}`}
      accessibilityRole={pressable ? 'button' : 'text'}
      accessibilityLabel={badge.label}>
      <Text className="text-xs font-semibold text-gray-800">{badge.label}</Text>
    </Pressable>
  );
}

export function syncBadgeHeaderRight() {
  return () => <SyncBadge />;
}
