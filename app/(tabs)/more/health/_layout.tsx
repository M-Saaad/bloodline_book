import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function HealthLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Health log' }} />
      <Stack.Screen name="add" options={{ title: 'Health record' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Health record' }} />
    </Stack>
  );
}
