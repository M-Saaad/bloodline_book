import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';
import { useFarmScopeKey } from '@/providers/FarmProvider';

export default function BreedingLayout() {
  const farmScopeKey = useFarmScopeKey();
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack key={farmScopeKey} screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Breeding', headerTitle: '' }} />
      <Stack.Screen name="add-breeding" options={{ title: 'Log breeding' }} />
      <Stack.Screen name="add-kidding" options={{ title: 'Kidding' }} />
      <Stack.Screen name="not-kidded" options={{ title: 'Not kidded yet' }} />
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
