import { Stack } from 'expo-router';

import { useStackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function TasksLayout() {
  const stackOptions = useStackWithSyncBadge();
  return (
    <Stack screenOptions={stackOptions}>
      <Stack.Screen name="index" options={{ title: 'Tasks', headerTitle: '' }} />
      <Stack.Screen name="add" options={{ title: 'Add task' }} />
      <Stack.Screen name="[id]" options={{ title: 'Task' }} />
    </Stack>
  );
}
