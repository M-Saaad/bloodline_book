import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function HealthLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Health log' }} />
      <Stack.Screen name="add" options={{ title: 'Health record' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Health record' }} />
    </Stack>
  );
}
