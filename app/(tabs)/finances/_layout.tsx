import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function FinancesLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Finances' }} />
      <Stack.Screen name="add" options={{ title: 'Add Transaction' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Transaction' }} />
    </Stack>
  );
}
