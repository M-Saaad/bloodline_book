import { useQuery } from '@powersync/react';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { addDaysToIso, formatDisplayDate, todayIso } from '@/lib/dates';
import { mapAnimal, mapBreedingEvent } from '@/lib/db/mappers';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

const CALENDAR_WINDOW_DAYS = 120;

export default function BreedingCalendarScreen() {
  const { activeFarm } = useFarm();
  const today = todayIso();
  const windowEnd = addDaysToIso(today, CALENDAR_WINDOW_DAYS) ?? today;

  const {
    data: breedingRows,
    isLoading,
    error,
  } = useQuery(
    activeFarm
      ? `SELECT * FROM breeding_events
         WHERE farm_id = ?
           AND due_date IS NOT NULL
           AND due_date >= ?
           AND due_date <= ?
           AND status IN ('bred', 'confirmed', 'open')
         ORDER BY due_date ASC, bred_date DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id, today, windowEnd] : [],
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

  const events = useMemo(
    () =>
      (breedingRows ?? []).map((row) =>
        mapBreedingEvent(row as Record<string, unknown>),
      ),
    [breedingRows],
  );

  const grouped = useMemo(() => {
    const byMonth = new Map<string, typeof events>();
    for (const event of events) {
      if (!event.dueDate) {
        continue;
      }
      const monthKey = event.dueDate.slice(0, 7);
      const list = byMonth.get(monthKey) ?? [];
      list.push(event);
      byMonth.set(monthKey, list);
    }
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

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
          title="No upcoming due dates"
          description={`Open breedings with due dates in the next ${CALENDAR_WINDOW_DAYS} days will appear here. Log a breeding to get started.`}
        />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 pb-8 gap-4">
      <Text className="text-sm text-gray-600">
        Expected kiddings through {formatDisplayDate(windowEnd)}
      </Text>

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
            {monthEvents.map((event) => (
              <View
                key={event.id}
                className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
                <View className="flex-row justify-between items-start">
                  <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                    {animalLabels.get(event.damId) ?? 'Dam'}
                  </Text>
                  <Badge label={event.status} />
                </View>
                <Text className="text-gray-600 text-sm mt-1">
                  Due {formatDisplayDate(event.dueDate!)}
                </Text>
                <Text className="text-gray-500 text-sm mt-1">
                  Bred {formatDisplayDate(event.bredDate)}
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
