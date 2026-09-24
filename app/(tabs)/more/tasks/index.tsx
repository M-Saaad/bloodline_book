import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapTask } from '@/lib/db/mappers';
import { setTaskCompleted } from '@/lib/db/documents';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useFarm } from '@/providers/FarmProvider';

export default function TasksScreen() {
  const { activeFarm } = useFarm();
  const { canWrite } = useFarmRole();

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM tasks
         WHERE farm_id = ?
         ORDER BY completed ASC, due_date ASC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const tasks = (data ?? []).map((row) =>
    mapTask(row as Record<string, unknown>),
  );

  async function toggleTask(taskId: string, completed: boolean) {
    if (!canWrite) {
      return;
    }
    await setTaskCompleted(taskId, !completed);
  }

  if (!activeFarm) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading tasks…" />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3">
        <FarmWriteGate>
          <Button
            title="Add Task"
            onPress={() => router.push('/(tabs)/more/tasks/add')}
          />
        </FarmWriteGate>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerClassName={tasks.length === 0 ? 'flex-grow' : 'px-4 pb-6'}
        ListEmptyComponent={
          <EmptyState
            title="No tasks yet"
            description="Track chores, health follow-ups, and other farm to-dos."
            actionLabel="Add Task"
            onAction={() => router.push('/(tabs)/more/tasks/add')}
          />
        }
        renderItem={({ item }) => (
          <View
            className={`flex-row items-start border rounded-xl p-4 mb-2 ${
              item.completed
                ? 'bg-gray-100 border-gray-200 opacity-70'
                : 'bg-white border-gray-200'
            }`}>
            <Pressable
              onPress={() => toggleTask(item.id, item.completed)}
              accessibilityLabel={
                item.completed ? 'Mark task incomplete' : 'Complete task'
              }
              className={`w-7 h-7 rounded-full border-2 mr-3 mt-0.5 items-center justify-center ${
                item.completed
                  ? 'border-green-600 bg-green-600'
                  : 'border-gray-400 bg-white'
              }`}>
              {item.completed ? (
                <Text className="text-white text-xs font-bold">✓</Text>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => router.push(`/(tabs)/more/tasks/${item.id}`)}
              className="flex-1">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-3">
                <Text
                  className={`text-lg font-semibold ${
                    item.completed
                      ? 'text-gray-500 line-through'
                      : 'text-gray-900'
                  }`}>
                  {item.title}
                </Text>
                {item.dueDate ? (
                  <Text className="text-gray-500 text-sm mt-1">
                    Due {item.dueDate}
                  </Text>
                ) : null}
              </View>
              <Badge
                label={item.priority}
                tone={item.priority === 'high' ? 'danger' : 'default'}
              />
            </View>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
