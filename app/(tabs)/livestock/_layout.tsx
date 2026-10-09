import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function LivestockLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Herd', headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add goat' }} />
      <Stack.Screen name="weight" options={{ title: 'Weigh Day', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Goat', headerShown: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Animal' }} />
      <Stack.Screen name="weight-log/[id]" options={{ title: 'Edit Weight' }} />
      <Stack.Screen
        name="weigh-session/[id]"
        options={{ title: 'Weigh Session' }}
      />
    </Stack>
  );
}
