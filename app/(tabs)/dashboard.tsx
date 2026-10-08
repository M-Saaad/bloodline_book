import { useQuery } from '@powersync/react';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { FarmWriteGate } from '@/components/FarmWriteGate';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { SyncBadge } from '@/components/SyncBadge';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chevron, ListCard, ListRow } from '@/components/ui/ListRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useLocalHerd } from '@/hooks/useLocalHerd';
import { preferLocalRows } from '@/lib/domain/offline-replica';
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

  const { data: taskRows } = useQuery(
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

  const { data: recentSessions } = useQuery(
    activeFarm
      ? `SELECT * FROM weigh_sessions WHERE farm_id = ?
         ORDER BY date DESC LIMIT 3`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { animals: localHerd, resolved: localHerdResolved } = useLocalHerd(
    activeFarm?.id,
    'all',
  );
  const queriedAnimals = useMemo(
    () => (animalRows ?? []).map((row) => mapAnimal(row as Record<string, unknown>)),
    [animalRows],
  );
  const animals = useMemo(
    () => preferLocalRows(queriedAnimals, localHerd),
    [queriedAnimals, localHerd],
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
      <View className="flex-1 bg-paper">
        <EmptyState
          title="No farm selected"
          description="Create or select a farm to see what needs doing."
        />
      </View>
    );
  }

  const herdStillReading =
    animals.length === 0 && (animalsLoading || !localHerdResolved);
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

  // What the hero card counts: due or overdue tasks, kidding soon, FAMACHA rechecks and the herd flag.
  const needCount =
    partitioned.dueNow.length +
    kiddingSoon.length +
    partitioned.famachaSoon.length +
    (herdFlag ? 1 : 0);

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

  const goatParts = (animalId: string, fallback: string) => {
    const animal = animals.find((a) => a.id === animalId);
    const name = animal?.name?.trim() ?? '';
    const tag = animal?.tagNumber?.trim() ?? '';
    if (name && tag) {
      return { name, tag: `#${tag}` };
    }
    return { name: labels.get(animalId) ?? fallback, tag: '' };
  };

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const longDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const choreTasks = [...partitioned.dueNow, ...partitioned.undated];
  const doTodayCount =
    kiddingSoon.length + withdrawalRows.length + partitioned.famachaSoon.length;

  async function tickTask(taskId: string) {
    if (!canWrite) {
      return;
    }
    await setTaskCompleted(taskId, true);
  }

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-6 gap-4 pb-10">
      <Stack.Screen options={{ headerShown: false }} />
      <EnvironmentBadge />
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text className="text-[15px] font-semibold text-gray-500">
            {longDate} · {activeFarm.name}
          </Text>
          <Text className="text-[32px] leading-[37px] font-extrabold text-ink mt-0.5">
            {greeting}
          </Text>
        </View>
        <SyncBadge />
      </View>
      {isHand ? <ReadOnlyFarmBanner /> : null}

      {animals.length > 0 ? (
        <View className="rounded-[22px] bg-bloodline-900 px-5 py-4 flex-row items-center gap-4">
          {needCount > 0 ? (
            <Text className="text-[56px] leading-[60px] font-extrabold text-white">
              {needCount}
            </Text>
          ) : null}
          <View className="flex-1">
            <Text className="text-[19px] font-bold text-white">
              {needCount === 0
                ? 'Nothing urgent today'
                : needCount === 1
                  ? 'thing needs you today'
                  : 'things need you today'}
            </Text>
            <Text className="text-[15px] text-bloodline-100 mt-0.5">
              {needCount === 0
                ? 'Good time to weigh or check your herd.'
                : withdrawals.size > 0
                  ? `${withdrawals.size} ${withdrawals.size === 1 ? 'goat is' : 'goats are'} in withdrawal`
                  : 'Start with the first card below.'}
            </Text>
          </View>
        </View>
      ) : null}

      {animals.length === 0 && !herdStillReading ? (
        <Card>
          <View className="items-center py-1">
            <View className="w-16 h-16 rounded-full bg-bloodline-100 items-center justify-center">
              <Text className="text-3xl text-bloodline-600">＋</Text>
            </View>
            <Text className="text-[22px] font-extrabold text-ink mt-3">Start here</Text>
            <Text className="text-base leading-[22px] text-gray-500 text-center mt-1.5 mb-4">
              Add your goats, then run your first Weigh Day.
            </Text>
          </View>
          <FarmWriteGate>
            <View className="gap-2">
              <Button
                title="Add goat"
                onPress={() => router.push('/(tabs)/livestock/add')}
                className="h-[60px]"
              />
              <Button
                title="Weigh Day"
                variant="outline"
                onPress={() => router.push('/(tabs)/livestock/weight')}
              />
            </View>
          </FarmWriteGate>
        </Card>
      ) : null}

      {herdFlag ? (
        <Banner
          tone="amber"
          title="FAMACHA"
          message={famachaHerdFlagMessage(herdFlag.high, herdFlag.scored)}
        />
      ) : null}

      {doTodayCount > 0 ? (
        <View className="gap-2.5">
          <Text className="text-xl font-extrabold text-ink">Do today</Text>

          {kiddingSoon.map((item) => {
            const goat = goatParts(item.event.damId, 'Doe');
            return (
              <TodayCard
                key={item.event.id}
                symbol="◔"
                tile="bg-[#fff1cc]"
                tileText="text-[#7a4300]"
                name={goat.name}
                tag={goat.tag}
                detail={
                  (item.category === 'past_due' ? 'Past due · ' : '') +
                  (item.window
                    ? formatDueWindowPhrase(item.window.windowStart, item.window.windowEnd)
                    : '')
                }
                pill={item.category === 'past_due' ? 'Past due' : 'Kidding soon'}
                pillBox="bg-[#fff1cc]"
                pillText="text-[#7a4300]"
                pillSymbol="◔ "
                onPress={() =>
                  router.push(`/(tabs)/more/breeding/edit-breeding/${item.event.id}`)
                }
              />
            );
          })}

          {withdrawalRows.map((row) => {
            const goat = goatParts(row.animalId, 'Goat');
            return (
              <TodayCard
                key={row.key}
                symbol="⚠"
                tile="bg-stop"
                tileText="text-white"
                name={goat.name}
                tag={goat.tag}
                detail={row.label}
                pill="In withdrawal"
                pillBox="bg-stop"
                pillText="text-white"
                pillSymbol="⚠ "
                onPress={() => router.push(`/(tabs)/livestock/${row.animalId}`)}
              />
            );
          })}

          {partitioned.famachaSoon.map((task) => (
            <TodayCard
              key={task.id}
              symbol="♡"
              tile="bg-bloodline-100"
              tileText="text-[#7a200f]"
              name={shownTaskTitle(task)}
              tag=""
              detail={
                task.dueDate ? `FAMACHA recheck · Due ${formatDisplayDate(task.dueDate)}` : 'FAMACHA recheck'
              }
              pill="FAMACHA"
              pillBox="bg-bloodline-100"
              pillText="text-[#7a200f]"
              pillSymbol=""
              onPress={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
        </View>
      ) : null}

      {choreTasks.length > 0 ? (
        <View>
          <Text className="text-xl font-extrabold text-ink mb-1">Chores</Text>
          {partitioned.dueNow.map((task) => (
            <TaskRow
              key={task.id}
              title={shownTaskTitle(task)}
              detail={task.dueDate ? `Due ${formatDisplayDate(task.dueDate)}` : ''}
              onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
          {partitioned.undated.map((task) => (
            <TaskRow
              key={task.id}
              title={shownTaskTitle(task)}
              detail="No date"
              onOpen={() => router.push(`/(tabs)/more/tasks/${task.id}`)}
              onTick={() => tickTask(task.id)}
            />
          ))}
        </View>
      ) : null}

      {partitioned.comingWeek.length > 0 ? (
        <View>
          <Pressable
            onPress={() => setWeekOpen((value) => !value)}
            accessibilityRole="button"
            className="min-h-[52px] justify-center">
            <Text className="text-xl font-extrabold text-ink">
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
        </View>
      ) : null}

      <Card>
        <Text className="text-xl font-extrabold text-ink mb-3">Quick actions</Text>
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

      <View>
        <Text className="text-xl font-extrabold text-ink mb-2">Herd</Text>
        <ListCard>
          <ListRow
            title={`${activeCount} active goats`}
            subtitle={`${doesBred} does bred · ${kidsBornThisYear} kids born this year`}
            right={<Chevron />}
            last
            onPress={() =>
              router.push({
                pathname: '/(tabs)/livestock',
                params: { status: 'all' },
              })
            }
          />
        </ListCard>
      </View>

      <View>
        <Text className="text-xl font-extrabold text-ink mb-2">Recent weigh sessions</Text>
        {(recentSessions ?? []).length === 0 ? (
          <Text className="text-base text-gray-500">No weigh sessions yet.</Text>
        ) : (
          <ListCard>
            {(recentSessions ?? []).map((row, index, all) => {
              const session = row as {
                id: string;
                date: string;
                weigh_point: string;
              };
              return (
                <ListRow
                  key={session.id}
                  title={session.date}
                  right={<Badge label={session.weigh_point.replace('_', ' ')} />}
                  last={index === all.length - 1}
                  onPress={() =>
                    router.push(`/(tabs)/livestock/weigh-session/${session.id}`)
                  }
                />
              );
            })}
          </ListCard>
        )}
      </View>
    </ScrollView>
  );
}

function TodayCard({
  symbol,
  tile,
  tileText,
  name,
  tag,
  detail,
  pill,
  pillBox,
  pillText,
  pillSymbol,
  onPress,
  onTick,
}: {
  symbol: string;
  tile: string;
  tileText: string;
  name: string;
  tag: string;
  detail: string;
  pill: string;
  pillBox: string;
  pillText: string;
  pillSymbol: string;
  onPress: () => void;
  onTick?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3.5 bg-white border border-gray-200 rounded-[20px] px-4 py-3.5 min-h-[84px]">
      <Pressable onPress={onPress} className="flex-1 flex-row items-center gap-3.5">
        <View className={`w-[52px] h-[52px] rounded-2xl items-center justify-center ${tile}`}>
          <Text className={`text-2xl font-bold ${tileText}`}>{symbol}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink">
            {name}
            {tag ? <Text className="text-bloodline-600 font-semibold"> {tag}</Text> : null}
          </Text>
          <Text className="text-base text-gray-500">{detail}</Text>
          <View className={`self-start rounded-full px-3 py-1 mt-1.5 ${pillBox}`}>
            <Text className={`text-sm font-bold ${pillText}`}>
              {pillSymbol}
              {pill}
            </Text>
          </View>
        </View>
      </Pressable>
      {onTick ? <CheckCircle onPress={onTick} /> : null}
    </View>
  );
}

function CheckCircle({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Complete task"
      accessibilityRole="button"
      className="w-12 h-12 items-center justify-center">
      <View className="w-8 h-8 rounded-full border-[2.5px] border-bloodline-600 bg-white" />
    </Pressable>
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
    <View className="flex-row items-center gap-2 min-h-[56px]">
      <CheckCircle onPress={onTick} />
      <Pressable onPress={onOpen} className="flex-1 flex-row items-center gap-2 min-h-[52px]">
        <Text className="flex-1 text-[17px] font-medium text-ink">{title}</Text>
        {detail ? (
          <View className="rounded-full bg-gray-100 px-2.5 py-1">
            <Text className="text-[13px] font-bold text-gray-500">{detail}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
