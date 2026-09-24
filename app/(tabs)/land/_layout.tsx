import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function LandLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Land' }} />
      <Stack.Screen name="add-pasture" options={{ title: 'Add Pasture' }} />
      <Stack.Screen name="add-grazing" options={{ title: 'Move Animals' }} />
      <Stack.Screen name="add-feed" options={{ title: 'Log Feed' }} />
      <Stack.Screen name="[id]" options={{ title: 'Pasture' }} />
      <Stack.Screen name="edit-pasture/[id]" options={{ title: 'Edit Pasture' }} />
      <Stack.Screen name="edit-feed/[id]" options={{ title: 'Edit Feed Log' }} />
      <Stack.Screen
        name="edit-grazing/[id]"
        options={{ title: 'Edit Grazing Stay' }}
      />
    </Stack>
  );
}
