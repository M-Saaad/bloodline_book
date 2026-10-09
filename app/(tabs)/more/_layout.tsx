import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function MoreLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'More', headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="help" options={{ title: 'Help' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="changes-not-saved" options={{ title: 'Changes not saved' }} />
      <Stack.Screen name="documents" options={{ headerShown: false }} />
      <Stack.Screen name="tasks" options={{ headerShown: false }} />
      <Stack.Screen name="health" options={{ headerShown: false }} />
      <Stack.Screen name="breeding" options={{ headerShown: false }} />
    </Stack>
  );
}
