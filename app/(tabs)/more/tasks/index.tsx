import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { todayIso } from '@/lib/dates';
import { mapTask } from '@/lib/db/mappers';
import { setTaskCompleted } from '@/lib/db/documents';
import { taskTitleWithGoatName } from '@/lib/domain/health';
import { hideOldCompletedTask } from '@/lib/domain/today';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useFarm } from '@/providers/FarmProvider';

export default function TasksScreen() {
  const { activeFarm } = useFarm();
  const { canWrite } = useFarmRole();
  const [tab, setTab] = useState<'open' | 'done'>('open');

  const { data: healthNameRows } = useQuery(
    activeFarm
      ? `SELECT h.id as id, a.name as name, a.tag_number as tag_number, a.id as animal_id
         FROM health_records h
         JOIN animals a ON a.id = h.animal_id
         WHERE h.farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const goatNameByHealthId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of healthNameRows ?? []) {
      const record = row as {
        id: string;
        name: string | null;
        tag_number: string | null;
        animal_id: string;
      };
      map.set(
        String(record.id),
        animalDisplayLabel({
          id: String(record.animal_id),
          name: record.name,
          tagNumber: record.tag_number,
        }),
      );
    }
    return map;
  }, [healthNameRows]);

  const { data, isLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM tasks
         WHERE farm_id = ?
         ORDER BY completed ASC, due_date ASC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const tasks = useMemo(() => {
    const today = todayIso();
    return (data ?? [])
      .map((row) => mapTask(row as Record<string, unknown>))
      .filter((task) => {
        if (tab === 'open') {
          return !task.completed;
        }
        return (
          task.completed &&
          !hideOldCompletedTask(task.completed, task.updatedAt, today)
        );
      });
  }, [data, tab]);

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
      <View className="px-4 py-3 gap-3">
        <View className="flex-row gap-2">
          {(['open', 'done'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              className={`flex-1 rounded-full border py-2 items-center ${
                tab === value
                  ? 'border-bloodline-600 bg-bloodline-50'
                  : 'border-gray-300 bg-white'
              }`}>
              <Text
                className={`text-sm font-medium capitalize ${
                  tab === value ? 'text-bloodline-700' : 'text-gray-700'
                }`}>
                {value}
              </Text>
            </Pressable>
          ))}
        </View>
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
                  {taskTitleWithGoatName(
                    item.title,
                    item.sourceId ? goatNameByHealthId.get(item.sourceId) : null,
                  )}
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
