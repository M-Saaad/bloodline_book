import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function DocumentsLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Papers' }} />
      <Stack.Screen name="add" options={{ title: 'Add paper' }} />
    </Stack>
  );
}
