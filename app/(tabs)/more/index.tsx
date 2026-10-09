import { useStatus } from '@powersync/react';
import { type Href, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { SyncBadge } from '@/components/SyncBadge';

import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chevron } from '@/components/ui/ListRow';
import { FormMessage } from '@/components/ui/FormMessage';
import { TEAM_INVITES_ENABLED } from '@/lib/config/features';
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
import { Text } from '@/components/ui/Text';

type MenuItem = { title: string; route: Href; symbol: string };

const BASE_MENU_ITEMS: MenuItem[] = [
  { title: 'Land', route: '/(tabs)/land', symbol: '⌂' },
  { title: 'Money', route: '/(tabs)/finances', symbol: '＄' },
  { title: 'Health log', route: '/(tabs)/more/health', symbol: '♡' },
  { title: 'Tasks', route: '/(tabs)/more/tasks', symbol: '✓' },
  { title: 'Papers', route: '/(tabs)/more/documents', symbol: '☰' },
  { title: 'Settings', route: '/(tabs)/more/settings', symbol: '⋯' },
  ...(TEAM_INVITES_ENABLED
    ? [{ title: 'Team', route: '/(tabs)/more/team' as Href, symbol: '☰' }]
    : []),
  { title: 'Help', route: '/(tabs)/more/help', symbol: 'ⓘ' },
];

const CHANGES_NOT_SAVED_ITEM: MenuItem = {
  title: 'Changes not saved',
  route: '/(tabs)/more/changes-not-saved',
  symbol: '⚠',
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
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-6 pb-10 gap-3.5">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row justify-between items-center">
        <Text className="text-[32px] leading-[36px] font-extrabold text-ink">More</Text>
        <SyncBadge />
      </View>

      {isHand ? <ReadOnlyFarmBanner /> : null}

      {activeFarm && (
        <Card className="px-[18px] py-4">
          <Text className="text-[22px] font-extrabold text-ink">
            {activeFarm.name}
          </Text>
          <Text className="text-base text-gray-500 mt-0.5 capitalize">
            {activeFarm.segment} · {activeFarm.currency} ·{' '}
            {activeFarm.weightUnit}
          </Text>
        </Card>
      )}

      <View className="bg-white border border-gray-200 rounded-[22px] overflow-hidden">
        {menuItems.map((item, index) => {
          const notSaved = item === CHANGES_NOT_SAVED_ITEM;
          return (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.route)}
              accessibilityRole="button"
              className={`flex-row items-center gap-3 min-h-[68px] px-4 py-2.5 active:bg-gray-50 ${
                index === menuItems.length - 1 ? '' : 'border-b border-gray-100'
              }`}>
              <Text
                className={`w-7 text-center text-2xl ${notSaved ? 'text-ink' : 'text-bloodline-600'}`}>
                {item.symbol}
              </Text>
              <Text className="flex-1 text-lg font-extrabold text-ink">
                {item.title}
              </Text>
              <Chevron />
            </Pressable>
          );
        })}
      </View>

      <FormMessage message={signOutMessage} tone="error" />

      <Button
        title={signOutBusy ? 'Signing out…' : 'Sign out'}
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
