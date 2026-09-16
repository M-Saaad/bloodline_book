import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal } from '@/lib/db/mappers';
import {
  formatAnimalStatus,
  formatLifecycleStage,
  statusBadgeTone,
} from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();

  const { data: animalRows, isLoading: animalLoading } = useQuery(
    id ? 'SELECT * FROM animals WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: breedRows } = useQuery(
    animalRows?.[0]?.breed_primary_id
      ? 'SELECT name FROM breeds WHERE id = ?'
      : 'SELECT 1 WHERE 0',
    animalRows?.[0]?.breed_primary_id
      ? [animalRows[0].breed_primary_id]
      : [],
  );

  const { data: weightRows, isLoading: weightsLoading } = useQuery(
    id
      ? `SELECT wl.id, ws.date, ws.weigh_point, wl.weight_value, wl.weight_unit
         FROM weight_logs wl
         JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
         WHERE wl.animal_id = ?
         ORDER BY ws.date DESC, wl.created_at DESC`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  if (!activeFarm || !id) {
    return null;
  }

  if (animalLoading) {
    return <LoadingState message="Loading animal…" />;
  }

  const animalRow = animalRows?.[0];
  if (!animalRow) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="Animal not found"
          description="This animal may have been removed or is not on this farm."
          actionLabel="Back to Livestock"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const animal = mapAnimal(animalRow as Record<string, unknown>);
  const breedName =
    breedRows?.[0]?.name != null ? String(breedRows[0].name) : null;
  const displayName = animal.name ?? animal.tagNumber ?? 'Unnamed';
  const weights = weightRows ?? [];

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 gap-4 pb-8">
      <Card>
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-bold text-gray-900">{displayName}</Text>
            {animal.tagNumber && animal.name ? (
              <Text className="text-gray-500 mt-1">Tag {animal.tagNumber}</Text>
            ) : null}
          </View>
          <Badge
            label={formatAnimalStatus(animal.status)}
            tone={statusBadgeTone(animal.status)}
          />
        </View>

        <View className="gap-2">
          <DetailRow label="Breed" value={breedName ?? 'Not set'} />
          <DetailRow label="Sex" value={animal.sex} capitalize />
          <DetailRow
            label="Lifecycle"
            value={formatLifecycleStage(animal.lifecycleStage)}
            capitalize
          />
          {animal.outDate ? (
            <DetailRow label="Out date" value={animal.outDate} />
          ) : null}
          {animal.notes ? (
            <View className="mt-2 pt-2 border-t border-gray-100">
              <Text className="text-sm text-gray-500 mb-1">Notes</Text>
              <Text className="text-gray-800">{animal.notes}</Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Button
        title="Edit Animal"
        variant="secondary"
        onPress={() => router.push(`/(tabs)/livestock/edit/${id}`)}
      />

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Weight history
        </Text>
        {weightsLoading ? (
          <Text className="text-gray-500">Loading weights…</Text>
        ) : weights.length === 0 ? (
          <Text className="text-gray-500">
            No weights recorded yet. Use Weigh Day to add entries.
          </Text>
        ) : (
          weights.map((row) => {
            const entry = row as {
              id: string;
              date: string;
              weigh_point: string;
              weight_value: number;
              weight_unit: string;
            };
            return (
              <View
                key={entry.id}
                className="flex-row justify-between items-center py-2 border-b border-gray-100">
                <View>
                  <Text className="text-gray-800 font-medium">{entry.date}</Text>
                  <Text className="text-gray-500 text-sm capitalize">
                    {entry.weigh_point.replace(/_/g, ' ')}
                  </Text>
                </View>
                <Text className="text-gray-900 font-semibold">
                  {entry.weight_value} {entry.weight_unit}
                </Text>
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-gray-500">{label}</Text>
      <Text className={`text-gray-900 font-medium ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </Text>
    </View>
  );
}
