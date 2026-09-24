import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import {
  formatDueWindowPhrase,
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
    const map = new Map<string, string>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, animalDisplayLabel(animal));
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
      <View className="flex-1 bg-gray-50 p-4">
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

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="pb-8">
      <View className="px-4 py-3 gap-2">
        <Button
          title="Log Breeding"
          onPress={() => router.push('/(tabs)/more/breeding/add-breeding')}
        />
        <Button
          title="Log Kidding"
          variant="outline"
          onPress={() => router.push('/(tabs)/more/breeding/add-kidding')}
        />
        <Button
          title="Breeding Calendar"
          variant="secondary"
          onPress={() => router.push('/(tabs)/more/breeding/calendar')}
        />
      </View>

      {isEmpty ? (
        <EmptyState
          title="No breeding records yet"
          description="Track breedings with estimated due dates, log kiddings, and register kids in the herd. Due-date tasks are added automatically."
          actionLabel="Log Breeding"
          onAction={() => router.push('/(tabs)/more/breeding/add-breeding')}
        />
      ) : null}

      {breedingEvents.length > 0 ? (
        <View className="px-4 mt-2">
          <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Breedings
          </Text>
          {breedingEvents.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push(`/(tabs)/more/breeding/edit-breeding/${item.id}`)
              }
              className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
              <View className="flex-row justify-between items-start">
                <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                  {animalLabels.get(item.damId) ?? 'Dam'}
                </Text>
                <Badge label={item.status} tone="default" />
              </View>
              <Text className="text-gray-600 text-sm mt-1">
                {item.exposureEndDate
                  ? `Exposed ${formatDisplayDate(item.bredDate)}–${formatDisplayDate(item.exposureEndDate)}`
                  : `Bred ${formatDisplayDate(item.bredDate)}`}
                {(() => {
                  const window = resolveBreedingWindow(
                    item,
                    activeFarm.gestationDays,
                  );
                  return window
                    ? ` · ${formatDueWindowPhrase(window.windowStart, window.windowEnd)}`
                    : '';
                })()}
              </Text>
              {item.sireId || item.sireExternalName ? (
                <Text className="text-gray-600 text-sm mt-1">
                  Sire:{' '}
                  {item.sireId
                    ? animalLabels.get(item.sireId) ?? 'Sire'
                    : item.sireExternalName}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      {kiddingEvents.length > 0 ? (
        <View className="px-4 mt-4">
          <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Kiddings
          </Text>
          {kiddingEvents.map((item) => (
            <Pressable
              key={item.id}
              onPress={() =>
                router.push(`/(tabs)/more/breeding/edit-kidding/${item.id}`)
              }
              className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
              <Text className="text-lg font-semibold text-gray-900">
                {animalLabels.get(item.damId) ?? 'Dam'}
              </Text>
              <Text className="text-gray-600 text-sm mt-1">
                {formatDisplayDate(item.kidDate)} · {item.kidsBorn} born
                {item.kidsSurviving != null
                  ? ` · ${item.kidsSurviving} surviving`
                  : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
