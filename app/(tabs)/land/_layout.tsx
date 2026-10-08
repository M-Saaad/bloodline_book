import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function LandLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
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
