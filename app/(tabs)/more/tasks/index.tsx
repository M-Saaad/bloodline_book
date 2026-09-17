import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapTask } from '@/lib/db/mappers';
import { setTaskCompleted } from '@/lib/db/documents';
import { useFarm } from '@/providers/FarmProvider';

export default function TasksScreen() {
  const { activeFarm } = useFarm();

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
        <Button
          title="Add Task"
          onPress={() => router.push('/(tabs)/more/tasks/add')}
        />
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
          <Pressable
            onPress={() => toggleTask(item.id, item.completed)}
            className={`border rounded-xl p-4 mb-2 ${
              item.completed
                ? 'bg-gray-100 border-gray-200 opacity-70'
                : 'bg-white border-gray-200'
            }`}>
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
        )}
      />
    </View>
  );
}
