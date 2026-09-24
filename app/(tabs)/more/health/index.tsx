import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import { mapAnimal, mapHealthRecord } from '@/lib/db/mappers';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function HealthLogScreen() {
  const { activeFarm } = useFarm();

  const { data: recordRows, isLoading: recordsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM health_records
         WHERE farm_id = ?
         ORDER BY date DESC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT id, name, tag_number FROM animals WHERE farm_id = ?`
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

  const records = (recordRows ?? []).map((row) =>
    mapHealthRecord(row as Record<string, unknown>),
  );

  if (!activeFarm) {
    return null;
  }

  if (recordsLoading) {
    return <LoadingState message="Loading health records…" />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3">
        <Button
          title="Add Health Record"
          onPress={() => router.push('/(tabs)/more/health/add')}
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          records.length === 0 ? 'flex-grow' : 'px-4 pb-6'
        }
        ListEmptyComponent={
          <EmptyState
            title="No health records yet"
            description="Log vaccinations, FAMACHA scores, treatments, and other herd health events."
            actionLabel="Add Health Record"
            onAction={() => router.push('/(tabs)/more/health/add')}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/(tabs)/more/health/edit/${item.id}`)
            }
            className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-lg font-semibold text-gray-900 capitalize flex-1 pr-2">
                {item.kind.replace(/_/g, ' ')}
              </Text>
              <Badge label={formatDisplayDate(item.date)} tone="default" />
            </View>
            <Text className="text-gray-700">
              {animalLabels.get(item.animalId) ?? 'Unknown animal'}
            </Text>
            {item.kind === 'famacha' && item.famachaScore != null ? (
              <Text className="text-gray-600 text-sm mt-1">
                FAMACHA score: {item.famachaScore}
              </Text>
            ) : null}
            {item.productName ? (
              <Text className="text-gray-600 text-sm mt-1">
                {item.productName}
                {item.dosage ? ` · ${item.dosage}` : ''}
              </Text>
            ) : null}
            {item.notes ? (
              <Text className="text-gray-500 text-sm mt-2">{item.notes}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
