import { useStatus } from '@powersync/react';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { countUploadFailures } from '@/lib/powersync/upload-failures';
import {
  disconnectAndClearPowerSync,
  disconnectPowerSync,
  powersync,
} from '@/lib/powersync/system';
import { confirmAction } from '@/lib/ui/confirm';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useAuth } from '@/providers/AuthProvider';
import { useFarm } from '@/providers/FarmProvider';

type MenuItem = { title: string; route: Href };

const BASE_MENU_ITEMS: MenuItem[] = [
  { title: 'Health Log', route: '/(tabs)/more/health' },
  { title: 'Breeding & Kidding', route: '/(tabs)/more/breeding' },
  { title: 'Settings', route: '/(tabs)/more/settings' },
  { title: 'Help', route: '/(tabs)/more/help' },
  { title: 'Tasks', route: '/(tabs)/more/tasks' },
];

const CHANGES_NOT_SAVED_ITEM: MenuItem = {
  title: 'Changes not saved',
  route: '/(tabs)/more/changes-not-saved',
};

function changesPhrase(count: number): string {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

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
  const [showChangesNotSaved, setShowChangesNotSaved] = useState(false);

  const refreshUploadState = useCallback(async () => {
    const [failureCount, stats] = await Promise.all([
      countUploadFailures(),
      powersync.getUploadQueueStats(),
    ]);
    setShowChangesNotSaved(failureCount > 0 || stats.count > 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUploadState();
    }, [refreshUploadState]),
  );

  const menuItems = showChangesNotSaved
    ? [...BASE_MENU_ITEMS, CHANGES_NOT_SAVED_ITEM]
    : BASE_MENU_ITEMS;

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
        setSignOutMessage(`Uploading ${changesPhrase(stats.count)}…`);
        for (let attempt = 0; attempt < 30; attempt += 1) {
          await sleep(1000);
          const next = await powersync.getUploadQueueStats();
          if (next.count === 0) {
            await disconnectPowerSync();
            await signOut();
            router.replace('/(auth)/sign-in');
            return;
          }
          setSignOutMessage(`Uploading ${changesPhrase(next.count)}…`);
        }
      }

      const remaining = await powersync.getUploadQueueStats();
      setPendingQueueCount(remaining.count);
      const verb = remaining.count === 1 ? 'is' : 'are';
      setSignOutMessage(
        `${changesPhrase(remaining.count)} ${verb} only on this phone. Connect to the internet and wait for "All saved" before signing out.`,
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
        {menuItems.map((item) => (
          <Pressable
            key={item.title}
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
          title={`Sign out and delete ${changesPhrase(pendingQueueCount)}`}
          variant="outline"
          onPress={handleSignOutAndDiscard}
          disabled={signOutBusy}
        />
      ) : null}
    </ScrollView>
  );
}
