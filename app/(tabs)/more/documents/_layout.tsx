import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function DocumentsLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Papers' }} />
      <Stack.Screen name="add" options={{ title: 'Add paper' }} />
    </Stack>
  );
}
