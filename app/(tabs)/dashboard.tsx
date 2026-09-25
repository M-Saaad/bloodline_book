import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { FarmWriteGate } from '@/components/FarmWriteGate';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useFarmRole } from '@/hooks/useFarmRole';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { setTaskCompleted } from '@/lib/db/documents';
import { mapAnimal, mapBreedingEvent, mapHealthRecord, mapTask } from '@/lib/db/mappers';
import {
  formatDueWindowPhrase,
  kiddingSoonCategory,
  resolveBreedingWindow,
} from '@/lib/domain/breeding';
import {
  activeWithdrawalsByAnimal,
  famachaHerdFlag,
  famachaHerdFlagMessage,
  taskTitleWithGoatName,
  withdrawalBadgeLabel,
} from '@/lib/domain/health';
import { partitionOpenTasks } from '@/lib/domain/today';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function DashboardScreen() {
  const { activeFarm, isLoading: farmLoading } = useFarm();
  const { isHand, canWrite } = useFarmRole();
  const [weekOpen, setWeekOpen] = useState(false);
  const today = todayIso();

  const { data: animalRows, isLoading: animalsLoading } = useQuery(
    activeFarm
      ? 'SELECT * FROM animals WHERE farm_id = ?'
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: taskRows, isLoading: tasksLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM tasks WHERE farm_id = ? AND completed = 0`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: healthRows } = useQuery(
    activeFarm
      ? `SELECT * FROM health_records WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: breedingRows } = useQuery(
    activeFarm
      ? `SELECT * FROM breeding_events
         WHERE farm_id = ? AND status IN ('bred', 'confirmed')`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: kiddingRows } = useQuery(
    activeFarm
      ? `SELECT kids_born, kid_date FROM kidding_events WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: recentSessions, isLoading: sessionsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM weigh_sessions WHERE farm_id = ?
         ORDER BY date DESC LIMIT 3`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );
  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const animal of animals) {
      map.set(animal.id, animalDisplayLabel(animal));
    }
    return map;
  }, [animals]);

  const tasks = useMemo(
    () => (taskRows ?? []).map((row) => mapTask(row as Record<string, unknown>)),
    [taskRows],
  );
  const partitioned = useMemo(
    () => partitionOpenTasks(tasks, today),
    [tasks, today],
  );

  const health = useMemo(
    () =>
      (healthRows ?? []).map((row) => mapHealthRecord(row as Record<string, unknown>)),
    [healthRows],
  );
  const goatNameByHealthId = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of health) {
      const label = labels.get(record.animalId);
      if (label) {
        map.set(record.id, label);
      }
    }
    return map;
  }, [health, labels]);

  function shownTaskTitle(task: { title: string; sourceId: string | null }) {
    return taskTitleWithGoatName(
      task.title,
      task.sourceId ? goatNameByHealthId.get(task.sourceId) : null,
    );
  }

  const withdrawals = useMemo(
    () =>
      activeWithdrawalsByAnimal(
        health.map((record) => ({
          animalId: record.animalId,
          date: record.date,
          productName: record.productName,
          meatDays: record.meatWithdrawalDays,
          milkDays: record.milkWithdrawalDays,
          legacyDays: record.withdrawalDays,
        })),
        today,
      ),
    [health, today],
  );
  const herdFlag = useMemo(
    () =>
      famachaHerdFlag(
        health
          .filter((record) => record.kind === 'famacha' && record.famachaScore != null)
          .map((record) => ({
            animalId: record.animalId,
            date: record.date,
            score: record.famachaScore ?? 0,
          })),
        today,
      ),
    [health, today],
  );

  const kiddingSoon = useMemo(() => {
    const gestation = activeFarm?.gestationDays ?? 150;
    return (breedingRows ?? [])
      .map((row) => mapBreedingEvent(row as Record<string, unknown>))
      .map((event) => ({
        event,
        window: resolveBreedingWindow(event, gestation),
      }))
      .filter((item) => item.window != null)
      .map((item) => ({
        ...item,
        category: kiddingSoonCategory(
          item.window!.windowStart,
          item.window!.windowEnd,
          today,
        ),
      }))
      .filter((item) => item.category != null);
  }, [activeFarm?.gestationDays, breedingRows, today]);

  if (farmLoading) {
    return <LoadingState message="Loading farm…" />;
  }

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="No farm selected"
          description="Create or select a farm to see what needs doing."
        />
      </View>
    );
  }

  const loading = animalsLoading || tasksLoading || sessionsLoading;
  const activeCount = animals.filter((animal) => animal.status === 'active').length;
  const doesBred = new Set(
    (breedingRows ?? []).map((row) => String((row as { dam_id: string }).dam_id)),
  ).size;
  const year = today.slice(0, 4);
  const kidsBornThisYear = (kiddingRows ?? []).reduce((sum, row) => {
    const kidDate = String((row as { kid_date: string }).kid_date ?? '');
    if (!kidDate.startsWith(year)) {
      return sum;
    }
    return sum + Number((row as { kids_born: number }).kids_born ?? 0);
  }, 0);

  const withdrawalRows = [...withdrawals.entries()].flatMap(([animalId, badge]) => {
    const rows: {
      key: string;
      animalId: string;
      label: string;
    }[] = [];
    if (badge.meat) {
      rows.push({
        key: `${animalId}-meat`,
        animalId,
        label: withdrawalBadgeLabel('meat', badge.meat.clearDate),
      });
    }
    if (
      badge.milk &&
      (activeFarm.segment === 'dairy' || activeFarm.segment === 'both')
    ) {
      rows.push({
        key: `${animalId}-milk`,
        animalId,
        label: withdrawalBadgeLabel('milk', badge.milk.clearDate),
      });
    }
    return rows;
  });

  async function tickTask(taskId: string) {
    if (!canWrite) {
      return;
    }
    await setTaskCompleted(taskId, true);
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4 pb-8">
      <EnvironmentBadge />
      {isHand ? <ReadOnlyFarmBanner /> : null}
      <Text className="text-2xl font-bold text-gray-900">{activeFarm.name}</Text>
      <Text className="text-gray-500 -mt-2">Today · {formatDisplayDate(today)}</Text>

      {animals.length === 0 && !loading ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">Start here</Text>
          <Text className="text-gray-600 mb-3">
            Add your goats, then run your first Weigh Day.
          </Text>
          <FarmWriteGate>
            <View className="gap-2">
              <Button
                title="Add goat"
                onPress={() => router.push('/(tabs)/livestock/add')}
              />
              <Button
                title="Weigh Day"
                variant="secondary"
                onPress={() => router.push('/(tabs)/livestock/weight')}
              />
            </View>
          </FarmWriteGate>
        </Card>
      ) : null}

      {partitioned.dueNow.length > 0 ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">
            Overdue and due today
          </Text>
          {partitioned.dueNow.map((task) => (
            <TaskRow
              key={task.id}
              title={shownTaskTitle(task)}
              detail={task.dueDate ? `Due ${formatDisplayDate(task.dueDate)}` : ''}
              onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
        </Card>
      ) : null}

      {partitioned.undated.length > 0 ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">No date</Text>
          {partitioned.undated.map((task) => (
            <TaskRow
              key={task.id}
              title={shownTaskTitle(task)}
              detail="No due date"
              onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
        </Card>
      ) : null}

      {withdrawalRows.length > 0 ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">In withdrawal</Text>
          {withdrawalRows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => router.push(`/(tabs)/livestock/${row.animalId}`)}
              className="py-2 border-b border-gray-100">
              <Text className="text-gray-900 font-medium">
                {labels.get(row.animalId) ?? 'Goat'}
              </Text>
              <Text className="text-amber-800 text-sm mt-1">{row.label}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {kiddingSoon.length > 0 ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">Kidding soon</Text>
          {kiddingSoon.map((item) => (
            <Pressable
              key={item.event.id}
              onPress={() =>
                router.push(`/(tabs)/more/breeding/edit-breeding/${item.event.id}`)
              }
              className="py-2 border-b border-gray-100">
              <Text className="text-gray-900 font-medium">
                {labels.get(item.event.damId) ?? 'Doe'}
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                {item.category === 'past_due' ? 'Past due · ' : ''}
                {item.window
                  ? formatDueWindowPhrase(item.window.windowStart, item.window.windowEnd)
                  : ''}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {partitioned.famachaSoon.length > 0 || herdFlag ? (
        <Card>
          <Text className="text-lg font-semibold text-gray-900 mb-2">FAMACHA</Text>
          {herdFlag ? (
            <Text className="text-amber-800 mb-2">
              {famachaHerdFlagMessage(herdFlag.high, herdFlag.scored)}
            </Text>
          ) : null}
          {partitioned.famachaSoon.map((task) => (
            <TaskRow
              key={task.id}
              title={shownTaskTitle(task)}
              detail={task.dueDate ? `Due ${formatDisplayDate(task.dueDate)}` : ''}
              onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
        </Card>
      ) : null}

      {partitioned.comingWeek.length > 0 ? (
        <Card>
          <Pressable onPress={() => setWeekOpen((value) => !value)}>
            <Text className="text-lg font-semibold text-gray-900">
              Coming this week ({partitioned.comingWeek.length})
              {weekOpen ? '' : ' · show'}
            </Text>
          </Pressable>
          {weekOpen
            ? partitioned.comingWeek.map((task) => (
                <TaskRow
                  key={task.id}
                  title={shownTaskTitle(task)}
                  detail={task.dueDate ? formatDisplayDate(task.dueDate) : ''}
                  onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
                  onTick={() => tickTask(task.id)}
                />
              ))
            : null}
        </Card>
      ) : null}

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">Quick actions</Text>
        <FarmWriteGate>
          <View className="gap-2">
            <Button
              title="Weigh Day"
              onPress={() => router.push('/(tabs)/livestock/weight')}
            />
            <Button
              title="Log health"
              variant="secondary"
              onPress={() => router.push('/(tabs)/more/health/add')}
            />
            <Button
              title="Log kidding"
              variant="outline"
              onPress={() => router.push('/(tabs)/more/breeding/add-kidding')}
            />
            <Button
              title="Add goat"
              variant="outline"
              onPress={() => router.push('/(tabs)/livestock/add')}
            />
          </View>
        </FarmWriteGate>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-2">Herd</Text>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/(tabs)/livestock',
              params: { status: 'all' },
            })
          }>
          <Text className="text-gray-700">
            {activeCount} active goats · {doesBred} does bred · {kidsBornThisYear}{' '}
            kids born this year
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Recent weigh sessions
        </Text>
        {(recentSessions ?? []).length === 0 ? (
          <Text className="text-gray-500">No weigh sessions yet.</Text>
        ) : (
          (recentSessions ?? []).map((row) => {
            const session = row as {
              id: string;
              date: string;
              weigh_point: string;
            };
            return (
              <Pressable
                key={session.id}
                onPress={() =>
                  router.push(`/(tabs)/livestock/weigh-session/${session.id}`)
                }
                className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-800">{session.date}</Text>
                <Badge label={session.weigh_point.replace('_', ' ')} />
              </Pressable>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

function TaskRow({
  title,
  detail,
  onOpen,
  onTick,
}: {
  title: string;
  detail: string;
  onOpen: () => void;
  onTick: () => void;
}) {
  return (
    <View className="flex-row items-start py-2 border-b border-gray-100">
      <Pressable
        onPress={onTick}
        accessibilityLabel="Complete task"
        className="w-7 h-7 rounded-full border-2 border-gray-400 mr-3 mt-0.5"
      />
      <Pressable onPress={onOpen} className="flex-1">
        <Text className="text-gray-900 font-medium">{title}</Text>
        {detail ? <Text className="text-gray-500 text-sm mt-1">{detail}</Text> : null}
      </Pressable>
    </View>
  );
}
