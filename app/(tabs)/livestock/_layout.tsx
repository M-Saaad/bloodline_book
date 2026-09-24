import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function LivestockLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Livestock' }} />
      <Stack.Screen name="add" options={{ title: 'Add Animal' }} />
      <Stack.Screen name="weight" options={{ title: 'Weigh Day' }} />
      <Stack.Screen name="[id]" options={{ title: 'Animal' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Animal' }} />
    </Stack>
  );
}
