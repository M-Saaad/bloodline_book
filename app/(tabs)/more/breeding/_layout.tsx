import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function BreedingLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Breeding', headerTitle: '' }} />
      <Stack.Screen name="add-breeding" options={{ title: 'Log breeding' }} />
      <Stack.Screen name="add-kidding" options={{ title: 'Log kidding' }} />
      <Stack.Screen name="kidding/[id]" options={{ title: 'Litter' }} />
      <Stack.Screen name="calendar" options={{ title: 'Breeding calendar' }} />
      <Stack.Screen
        name="edit-breeding/[id]"
        options={{ title: 'Breeding' }}
      />
      <Stack.Screen
        name="edit-kidding/[id]"
        options={{ title: 'Edit kidding' }}
      />
    </Stack>
  );
}
