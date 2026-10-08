import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { CardRowShell, ScreenHeading, TextWithTags } from '@/components/breeding/parts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Segmented } from '@/components/ui/Segmented';
import { formatDisplayDate, todayIso } from '@/lib/dates';
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

  const today = todayIso();
  const openCount = (data ?? []).filter(
    (row) => !mapTask(row as Record<string, unknown>).completed,
  ).length;

  return (
    <View className="flex-1 bg-paper">
      <View className="px-5 pb-3.5 gap-3.5">
        <ScreenHeading title="Tasks" subtitle={`${openCount} open`} />
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ]}
        />
        <FarmWriteGate>
          <Button
            title="＋ Add task"
            onPress={() => router.push('/(tabs)/more/tasks/add')}
          />
        </FarmWriteGate>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerClassName={tasks.length === 0 ? 'flex-grow' : 'px-5 pb-10'}
        ListEmptyComponent={
          <EmptyState
            title="No tasks yet"
            description="Track chores, health follow-ups, and other farm to-dos."
            actionLabel="Add Task"
            onAction={() => router.push('/(tabs)/more/tasks/add')}
          />
        }
        renderItem={({ item, index }) => (
          <CardRowShell index={index} count={tasks.length}>
            <View
              className={`flex-row items-center gap-3 min-h-[76px] px-4 py-2.5 ${
                index === tasks.length - 1 ? '' : 'border-b border-gray-100'
              }`}>
              <Pressable
                onPress={() => toggleTask(item.id, item.completed)}
                accessibilityLabel={
                  item.completed ? 'Mark task incomplete' : 'Complete task'
                }
                hitSlop={4}
                className={`w-10 h-10 rounded-full border-[2.5px] items-center justify-center ${
                  item.completed
                    ? 'border-[#0f5a33] bg-[#0f5a33]'
                    : 'border-bloodline-600 bg-white'
                }`}>
                {item.completed ? (
                  <Text className="text-white text-xl font-extrabold">✓</Text>
                ) : null}
              </Pressable>
              <Pressable
                onPress={() => router.push(`/(tabs)/more/tasks/${item.id}`)}
                className="flex-1 flex-row items-center gap-3">
                <View className="flex-1">
                  <Text
                    className={`text-lg font-extrabold ${
                      item.completed ? 'text-gray-500 line-through' : 'text-ink'
                    }`}>
                    <TextWithTags
                      text={taskTitleWithGoatName(
                        item.title,
                        item.sourceId ? goatNameByHealthId.get(item.sourceId) : null,
                      )}
                    />
                  </Text>
                  <Text className="text-[15px] text-gray-500">
                    {item.dueDate
                      ? item.dueDate === today
                        ? 'Due today'
                        : `Due ${formatDisplayDate(item.dueDate)}`
                      : 'No date'}
                  </Text>
                </View>
                <Badge
                  label={`${item.priority.charAt(0).toUpperCase()}${item.priority.slice(1)}`}
                  tone={
                    item.priority === 'high'
                      ? 'danger'
                      : item.priority === 'medium'
                        ? 'warning'
                        : 'default'
                  }
                />
              </Pressable>
            </View>
          </CardRowShell>
        )}
      />
    </View>
  );
}
