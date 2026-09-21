import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import {
  mapAnimal,
  mapBreedingEvent,
  mapKiddingEvent,
} from '@/lib/db/mappers';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function BreedingScreen() {
  const { activeFarm } = useFarm();

  const { data: breedingRows, isLoading: breedingLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM breeding_events
         WHERE farm_id = ?
         ORDER BY due_date DESC NULLS LAST, bred_date DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: kiddingRows, isLoading: kiddingLoading } = useQuery(
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

  if (!activeFarm) {
    return null;
  }

  if (breedingLoading || kiddingLoading) {
    return <LoadingState message="Loading breeding records…" />;
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
      </View>

      {isEmpty ? (
        <EmptyState
          title="No breeding records yet"
          description="Track breedings with estimated due dates and log kidding litters. Linking kids to litters arrives in a follow-up."
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
            <View
              key={item.id}
              className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
              <View className="flex-row justify-between items-start">
                <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                  {animalLabels.get(item.damId) ?? 'Dam'}
                </Text>
                <Badge label={item.status} tone="default" />
              </View>
              <Text className="text-gray-600 text-sm mt-1">
                Bred {formatDisplayDate(item.bredDate)}
                {item.dueDate
                  ? ` · Due ${formatDisplayDate(item.dueDate)}`
                  : ''}
              </Text>
              {item.sireId || item.sireExternalName ? (
                <Text className="text-gray-600 text-sm mt-1">
                  Sire:{' '}
                  {item.sireId
                    ? animalLabels.get(item.sireId) ?? 'Sire'
                    : item.sireExternalName}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {kiddingEvents.length > 0 ? (
        <View className="px-4 mt-4">
          <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">
            Kiddings
          </Text>
          {kiddingEvents.map((item) => (
            <View
              key={item.id}
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
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
