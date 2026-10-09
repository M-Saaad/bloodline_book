import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function FinancesLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Money' }} />
      <Stack.Screen name="add" options={{ title: 'Add transaction' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit transaction' }} />
    </Stack>
  );
}
