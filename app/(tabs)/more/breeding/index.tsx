import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { goatParts, ScreenHeading, SectionTitle } from '@/components/breeding/parts';
import { breedingStatusTone } from '@/components/breeding/status';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { Chevron, ListCard, ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import {
  formatBreedingStatus,
  formatDueWindowPhrase,
  kiddingSoonCategory,
  resolveBreedingWindow,
} from '@/lib/domain/breeding';
import {
  mapAnimal,
  mapBreedingEvent,
  mapKiddingEvent,
} from '@/lib/db/mappers';
import { ensureBreedingDueTask } from '@/lib/db/breeding';
import { isBreedingOpenForKidding } from '@/lib/domain/breeding';
import { ORDER_DUE_DATE_DESC } from '@/lib/sql/portableOrder';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function BreedingScreen() {
  const { activeFarm } = useFarm();

  const {
    data: breedingRows,
    isLoading: breedingLoading,
    error: breedingError,
  } = useQuery(
    activeFarm
      ? `SELECT * FROM breeding_events
         WHERE farm_id = ?
         ORDER BY ${ORDER_DUE_DATE_DESC}`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const {
    data: kiddingRows,
    isLoading: kiddingLoading,
    error: kiddingError,
  } = useQuery(
    activeFarm
      ? `SELECT * FROM kidding_events
         WHERE farm_id = ?
         ORDER BY kid_date DESC, created_at DESC`
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

  const breedingEvents = (breedingRows ?? []).map((row) =>
    mapBreedingEvent(row as Record<string, unknown>),
  );
  const kiddingEvents = (kiddingRows ?? []).map((row) =>
    mapKiddingEvent(row as Record<string, unknown>),
  );

  const ensuredBreedingTasks = useRef(new Set<string>());

  useEffect(() => {
    for (const event of breedingEvents) {
      if (
        !event.dueDate ||
        !isBreedingOpenForKidding(event.status) ||
        ensuredBreedingTasks.current.has(event.id)
      ) {
        continue;
      }
      ensuredBreedingTasks.current.add(event.id);
      void ensureBreedingDueTask(event.id);
    }
  }, [breedingEvents]);

  if (!activeFarm) {
    return null;
  }

  const queryError = breedingError ?? kiddingError;

  if (breedingLoading || kiddingLoading) {
    return <LoadingState message="Loading breeding records…" />;
  }

  if (queryError) {
    return (
      <View className="flex-1 bg-paper p-4">
        <FormMessage
          message={
            queryError instanceof Error
              ? queryError.message
              : 'Could not load breeding records.'
          }
          tone="error"
        />
      </View>
    );
  }

  const isEmpty = breedingEvents.length === 0 && kiddingEvents.length === 0;
  const today = todayIso();
  const openCount = breedingEvents.filter((event) =>
    isBreedingOpenForKidding(event.status),
  ).length;

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pb-10 gap-3">
      <ScreenHeading
        title="Breeding"
        subtitle={`${openCount} open breeding${openCount === 1 ? '' : 's'}`}
      />
      <View className="flex-row gap-2.5 mt-1">
        <Button
          title="Log breeding"
          className="flex-1"
          onPress={() => router.push('/(tabs)/more/breeding/add-breeding')}
        />
        <Button
          title="Log kidding"
          variant="outline"
          className="flex-1"
          onPress={() => router.push('/(tabs)/more/breeding/add-kidding')}
        />
      </View>
      <Button
        title="Breeding calendar"
        variant="secondary"
        onPress={() => router.push('/(tabs)/more/breeding/calendar')}
      />

      {isEmpty ? (
        <EmptyState
          title="No breeding records yet"
          description="Track breedings with estimated due dates, log kiddings, and register kids in the herd. Due-date tasks are added automatically."
          actionLabel="Log Breeding"
          onAction={() => router.push('/(tabs)/more/breeding/add-breeding')}
        />
      ) : null}

      {breedingEvents.length > 0 ? (
        <View>
          <SectionTitle>Bred does</SectionTitle>
          <ListCard>
            {breedingEvents.map((item, index) => {
              const dam = animalLabels.get(item.damId);
              const window = resolveBreedingWindow(item, activeFarm.gestationDays);
              const category =
                window && isBreedingOpenForKidding(item.status)
                  ? kiddingSoonCategory(window.windowStart, window.windowEnd, today)
                  : null;
              const sire = item.sireId
                ? animalLabels.get(item.sireId)?.name || 'Sire'
                : item.sireExternalName;
              const subtitle =
                (item.exposureEndDate
                  ? `Exposed ${formatDisplayDate(item.bredDate)}–${formatDisplayDate(item.exposureEndDate)}`
                  : `Bred ${formatDisplayDate(item.bredDate)}`) +
                (window
                  ? ` · ${formatDueWindowPhrase(window.windowStart, window.windowEnd)}`
                  : '') +
                (sire ? ` · Sire ${sire}` : '');
              return (
                <ListRow
                  key={item.id}
                  title={dam?.name ?? 'Dam'}
                  tag={dam?.tag}
                  subtitle={subtitle}
                  last={index === breedingEvents.length - 1}
                  onPress={() =>
                    router.push(`/(tabs)/more/breeding/edit-breeding/${item.id}`)
                  }
                  right={
                    category === 'soon' ? (
                      <Badge label="Kidding soon" tone="warning" />
                    ) : category === 'past_due' ? (
                      <Badge label="Past due" tone="danger" />
                    ) : (
                      <Badge
                        label={formatBreedingStatus(item.status)}
                        tone={breedingStatusTone(item.status)}
                      />
                    )
                  }
                />
              );
            })}
          </ListCard>
        </View>
      ) : null}

      {kiddingEvents.length > 0 ? (
        <View>
          <SectionTitle>Recent kiddings</SectionTitle>
          <ListCard>
            {kiddingEvents.map((item, index) => {
              const dam = animalLabels.get(item.damId);
              return (
                <ListRow
                  key={item.id}
                  title={dam?.name ?? 'Dam'}
                  tag={dam?.tag}
                  subtitle={`${formatDisplayDate(item.kidDate)} · ${item.kidsBorn} born${
                    item.kidsSurviving != null
                      ? ` · ${item.kidsSurviving} surviving`
                      : ''
                  }`}
                  last={index === kiddingEvents.length - 1}
                  onPress={() =>
                    router.push(`/(tabs)/more/breeding/edit-kidding/${item.id}`)
                  }
                  right={<Chevron />}
                />
              );
            })}
          </ListCard>
        </View>
      ) : null}
    </ScrollView>
  );
}
