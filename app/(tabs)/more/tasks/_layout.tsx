import { Stack } from 'expo-router';

import { stackWithSyncBadge } from '@/lib/navigation/stack-with-sync-badge';

export default function TasksLayout() {
  return (
    <Stack screenOptions={stackWithSyncBadge}>
      <Stack.Screen name="index" options={{ title: 'Tasks', headerTitle: '' }} />
      <Stack.Screen name="add" options={{ title: 'Add task' }} />
      <Stack.Screen name="[id]" options={{ title: 'Task' }} />
    </Stack>
  );
}
