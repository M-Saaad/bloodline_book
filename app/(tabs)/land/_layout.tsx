import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';
import { useFarmScopeKey } from '@/providers/FarmProvider';

export default function LandLayout() {
  const farmScopeKey = useFarmScopeKey();
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack key={farmScopeKey} screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Land' }} />
      <Stack.Screen name="add-pasture" options={{ title: 'Add pasture' }} />
      <Stack.Screen name="add-grazing" options={{ title: 'Move goats' }} />
      <Stack.Screen name="add-feed" options={{ title: 'Log feed' }} />
      <Stack.Screen name="[id]" options={{ title: 'Pasture' }} />
      <Stack.Screen name="edit-pasture/[id]" options={{ title: 'Edit pasture' }} />
      <Stack.Screen name="edit-feed/[id]" options={{ title: 'Edit feed' }} />
      <Stack.Screen
        name="edit-grazing/[id]"
        options={{ title: 'Edit stay' }}
      />
    </Stack>
  );
}
