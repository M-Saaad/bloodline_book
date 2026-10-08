import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function FinancesLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Money' }} />
      <Stack.Screen name="add" options={{ title: 'Add transaction' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit transaction' }} />
    </Stack>
  );
}
