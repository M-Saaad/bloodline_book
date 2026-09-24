import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function BreedingLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Breeding & Kidding' }} />
      <Stack.Screen name="add-breeding" options={{ title: 'Log Breeding' }} />
      <Stack.Screen name="add-kidding" options={{ title: 'Log Kidding' }} />
      <Stack.Screen name="calendar" options={{ title: 'Breeding Calendar' }} />
      <Stack.Screen
        name="edit-breeding/[id]"
        options={{ title: 'Edit Breeding' }}
      />
      <Stack.Screen
        name="edit-kidding/[id]"
        options={{ title: 'Edit Kidding' }}
      />
    </Stack>
  );
}
