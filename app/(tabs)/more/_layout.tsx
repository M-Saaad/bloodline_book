import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function MoreLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="changes-not-saved" options={{ title: 'Changes not saved' }} />
      <Stack.Screen name="documents" options={{ headerShown: false }} />
      <Stack.Screen name="tasks" options={{ headerShown: false }} />
      <Stack.Screen name="health" options={{ headerShown: false }} />
      <Stack.Screen name="breeding" options={{ headerShown: false }} />
    </Stack>
  );
}
