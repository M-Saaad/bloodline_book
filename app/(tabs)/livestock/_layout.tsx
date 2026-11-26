import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';
import { useFarmScopeKey } from '@/providers/FarmProvider';

export default function LivestockLayout() {
  const farmScopeKey = useFarmScopeKey();
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack key={farmScopeKey} screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Herd', headerShown: false }} />
      <Stack.Screen name="add" options={{ title: 'Add goat' }} />
      <Stack.Screen name="weight" options={{ title: 'Weigh Day', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Goat', headerShown: false }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Animal' }} />
      <Stack.Screen name="pedigree/[id]" options={{ title: 'Pedigree' }} />
      <Stack.Screen name="weight-log/[id]" options={{ title: 'Edit Weight' }} />
      <Stack.Screen
        name="weigh-session/[id]"
        options={{ title: 'Weigh Session' }}
      />
    </Stack>
  );
}
