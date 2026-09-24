import { useStatus } from '@powersync/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import {
  disconnectAndClearPowerSync,
  disconnectPowerSync,
  powersync,
} from '@/lib/powersync/system';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

const MENU_ITEMS = [
  { title: 'Health Log', route: '/(tabs)/more/health' as const },
  { title: 'Breeding & Kidding', route: '/(tabs)/more/breeding' as const },
  { title: 'Settings', route: '/(tabs)/more/settings' as const },
  { title: 'Tasks', route: '/(tabs)/more/tasks' as const },
  { title: 'Changes not saved', route: '/(tabs)/more/changes-not-saved' as const },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function MoreScreen() {
  const { signOut } = useAuth();
  const { activeFarm } = useFarm();
  const { isHand } = useFarmRole();
  const syncStatus = useStatus();
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutMessage, setSignOutMessage] = useState('');
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

  async function handleSignOut() {
    setSignOutMessage('');
    setSignOutBusy(true);
    try {
      const stats = await powersync.getUploadQueueStats();
      if (stats.count === 0) {
        await disconnectPowerSync();
        await signOut();
        router.replace('/(auth)/sign-in');
        return;
      }

      if (syncStatus.connected) {
        setSignOutMessage(`Uploading ${stats.count} changes…`);
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await sleep(1000);
          const next = await powersync.getUploadQueueStats();
          if (next.count === 0) {
            await disconnectPowerSync();
            await signOut();
            router.replace('/(auth)/sign-in');
            return;
          }
          setSignOutMessage(`Uploading ${next.count} changes…`);
        }
      }

      const remaining = await powersync.getUploadQueueStats();
      setPendingQueueCount(remaining.count);
      setSignOutMessage(
        `${remaining.count} changes are only on this phone. Connect to the internet and wait for "All saved" before signing out.`,
      );
    } finally {
      setSignOutBusy(false);
    }
  }

  async function handleSignOutAndDiscard() {
    const stats = await powersync.getUploadQueueStats();
    const confirmed = await confirmAction(
      'Sign out and delete local changes?',
      `${stats.count} change${stats.count === 1 ? '' : 's'} on this phone will be permanently deleted.`,
      'Sign out and delete',
    );
    if (!confirmed) {
      return;
    }

    setSignOutBusy(true);
    try {
      await disconnectAndClearPowerSync();
      await signOut();
      router.replace('/(auth)/sign-in');
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      {isHand ? <ReadOnlyFarmBanner /> : null}

      {activeFarm && (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-1">
            {activeFarm.name}
          </Text>
          <Text className="text-gray-600 capitalize">
            {activeFarm.segment} · {activeFarm.currency} ·{' '}
            {activeFarm.weightUnit}
          </Text>
        </Card>
      )}

      <Card>
        {MENU_ITEMS.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => router.push(item.route)}
            className="py-3 border-b border-gray-100 active:bg-gray-50">
            <Text className="text-base font-medium text-gray-900">
              {item.title}
            </Text>
          </Pressable>
        ))}
      </Card>

      <FormMessage message={signOutMessage} tone="error" />

      <Button
        title={signOutBusy ? 'Signing out…' : 'Sign Out'}
        variant="outline"
        onPress={handleSignOut}
        disabled={signOutBusy}
      />

      {pendingQueueCount > 0 ? (
        <Button
          title={`Sign out and delete ${pendingQueueCount} changes`}
          variant="outline"
          onPress={handleSignOutAndDiscard}
          disabled={signOutBusy}
        />
      ) : null}
    </ScrollView>
  );
}
