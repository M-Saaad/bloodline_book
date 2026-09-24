import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { mapAnimal, mapBreedingEvent } from '@/lib/db/mappers';
import {
  formatDueWindowPhrase,
  resolveBreedingWindow,
} from '@/lib/domain/breeding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function BreedingCalendarScreen() {
  const { activeFarm } = useFarm();
  const today = todayIso();

  const { data: breedingRows, isLoading, error } = useQuery(
    activeFarm
      ? `SELECT * FROM breeding_events
         WHERE farm_id = ? AND status IN ('bred', 'confirmed')
         ORDER BY COALESCE(due_window_start, due_date, bred_date) ASC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT id, name, tag_number, sex FROM animals WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animalLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, animalDisplayLabel(animal));
    }
    return map;
  }, [animalRows]);

  const gestationDays = activeFarm?.gestationDays ?? 150;

  const events = useMemo(() => {
    return (breedingRows ?? [])
      .map((row) => mapBreedingEvent(row as Record<string, unknown>))
      .map((event) => ({
        event,
        window: resolveBreedingWindow(event, gestationDays),
      }))
      .filter(
        (
          item,
        ): item is {
          event: (typeof item)['event'];
          window: NonNullable<(typeof item)['window']>;
        } => item.window != null,
      );
  }, [breedingRows, gestationDays]);

  const pastDue = events.filter((item) => item.window.windowEnd < today);
  const upcoming = events.filter((item) => item.window.windowEnd >= today);

  const grouped = useMemo(() => {
    const byMonth = new Map<string, typeof upcoming>();
    for (const item of upcoming) {
      const monthKey = item.window.windowStart.slice(0, 7);
      const list = byMonth.get(monthKey) ?? [];
      list.push(item);
      byMonth.set(monthKey, list);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [upcoming]);

  if (!activeFarm) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading breeding calendar…" />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <FormMessage
          message={
            error instanceof Error
              ? error.message
              : 'Could not load breeding calendar.'
          }
          tone="error"
        />
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="No open breedings"
          description="Bred and confirmed does show here until they kid, are marked open, or are marked lost."
        />
      </View>
    );
  }

  function CardRow({
    item,
  }: {
    item: (typeof events)[number];
  }) {
    return (
      <Pressable
        onPress={() =>
          router.push(`/(tabs)/more/breeding/edit-breeding/${item.event.id}`)
        }
        className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
        <View className="flex-row justify-between items-start">
          <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
            {animalLabels.get(item.event.damId) ?? 'Dam'}
          </Text>
          <Badge label={item.event.status} />
        </View>
        <Text className="text-gray-600 text-sm mt-1">
          {formatDueWindowPhrase(item.window.windowStart, item.window.windowEnd)}
        </Text>
        <Text className="text-gray-500 text-sm mt-1">
          {item.event.exposureEndDate
            ? `Exposed ${formatDisplayDate(item.event.bredDate)}–${formatDisplayDate(item.event.exposureEndDate)}`
            : `Bred ${formatDisplayDate(item.event.bredDate)}`}
        </Text>
      </Pressable>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 pb-8 gap-4">
      {pastDue.length > 0 ? (
        <View>
          <Text className="text-sm font-semibold text-amber-800 uppercase mb-2">
            Past due — check these does
          </Text>
          {pastDue.map((item) => (
            <CardRow key={item.event.id} item={item} />
          ))}
        </View>
      ) : null}

      {grouped.map(([monthKey, monthEvents]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
          undefined,
          { month: 'long', year: 'numeric' },
        );
        return (
          <View key={monthKey}>
            <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
              {monthLabel}
            </Text>
            {monthEvents.map((item) => (
              <CardRow key={item.event.id} item={item} />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
