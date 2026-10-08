import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { goatParts, SectionTitle } from '@/components/breeding/parts';
import { breedingStatusTone } from '@/components/breeding/status';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { ListCard, ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { mapAnimal, mapBreedingEvent } from '@/lib/db/mappers';
import {
  formatBreedingStatus,
  formatDueWindowPhrase,
  resolveBreedingWindow,
} from '@/lib/domain/breeding';
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
    const map = new Map<string, { name: string; tag: string | null }>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, goatParts(animal));
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
      <View className="flex-1 bg-paper p-4">
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
      <View className="flex-1 bg-paper">
        <EmptyState
          title="No open breedings"
          description="Bred and confirmed does show here until they kid, are marked open, or are marked lost."
        />
      </View>
    );
  }

  function eventSubtitle(item: (typeof events)[number]) {
    return `${formatDueWindowPhrase(item.window.windowStart, item.window.windowEnd)} · ${
      item.event.exposureEndDate
        ? `Exposed ${formatDisplayDate(item.event.bredDate)}–${formatDisplayDate(item.event.exposureEndDate)}`
        : `Bred ${formatDisplayDate(item.event.bredDate)}`
    }`;
  }

  function openEvent(item: (typeof events)[number]) {
    router.push(`/(tabs)/more/breeding/edit-breeding/${item.event.id}`);
  }

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerClassName="px-5 pt-2 pb-10 gap-3">
      {pastDue.length > 0 ? (
        <>
          <Banner
            tone="stop"
            title="Past due: check these does"
            message="Their due window has ended. Open each one."
          />
          {pastDue.map((item) => {
            const dam = animalLabels.get(item.event.damId);
            return (
              <Pressable
                key={item.event.id}
                onPress={() => openEvent(item)}
                accessibilityRole="button"
                className="bg-white rounded-[22px] border-[2.5px] border-stop px-4 py-3">
                <Text className="text-lg font-extrabold text-ink">
                  {dam?.name ?? 'Dam'}
                  {dam?.tag ? <Text className="text-bloodline-600"> {dam.tag}</Text> : null}
                </Text>
                <Text className="text-[15px] text-gray-500">{eventSubtitle(item)}</Text>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {grouped.map(([monthKey, monthEvents]) => {
        const [year, month] = monthKey.split('-').map(Number);
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(
          undefined,
          { month: 'long', year: 'numeric' },
        );
        return (
          <View key={monthKey}>
            <SectionTitle>{monthLabel}</SectionTitle>
            <ListCard>
              {monthEvents.map((item, index) => {
                const dam = animalLabels.get(item.event.damId);
                return (
                  <ListRow
                    key={item.event.id}
                    title={dam?.name ?? 'Dam'}
                    tag={dam?.tag}
                    subtitle={eventSubtitle(item)}
                    last={index === monthEvents.length - 1}
                    onPress={() => openEvent(item)}
                    right={
                      <Badge
                        label={formatBreedingStatus(item.event.status)}
                        tone={breedingStatusTone(item.event.status)}
                      />
                    }
                  />
                );
              })}
            </ListCard>
          </View>
        );
      })}
    </ScrollView>
  );
}
