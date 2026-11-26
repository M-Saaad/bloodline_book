import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';
import { useFarmScopeKey } from '@/providers/FarmProvider';

export default function FinancesLayout() {
  const farmScopeKey = useFarmScopeKey();
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack key={farmScopeKey} screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Money' }} />
      <Stack.Screen name="add" options={{ title: 'Add transaction' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit transaction' }} />
    </Stack>
  );
}
