import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal, mapKiddingEvent } from '@/lib/db/mappers';
import { litterSummaryLabel } from '@/lib/domain/kidding';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function KiddingSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();

  const { data: kiddingRows, isLoading } = useQuery(
    id ? 'SELECT * FROM kidding_events WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: kidRows } = useQuery(
    id
      ? `SELECT a.*,
           (SELECT wl.weight_value
            FROM weight_logs wl
            JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
            WHERE wl.animal_id = a.id AND ws.weigh_point = 'birth'
            ORDER BY ws.date ASC
            LIMIT 1) AS weight_value,
           (SELECT wl.weight_unit
            FROM weight_logs wl
            JOIN weigh_sessions ws ON ws.id = wl.weigh_session_id
            WHERE wl.animal_id = a.id AND ws.weigh_point = 'birth'
            ORDER BY ws.date ASC
            LIMIT 1) AS weight_unit
         FROM animals a
         WHERE a.litter_id = ?
         ORDER BY a.created_at ASC`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  if (!activeFarm || !id) {
    return null;
  }

  if (isLoading) {
    return <LoadingState message="Loading litter…" />;
  }

  const kiddingRow = kiddingRows?.[0];
  if (!kiddingRow) {
    return (
      <EmptyState
        title="Kidding not found"
        description="This litter may have been removed."
      />
    );
  }

  const kidding = mapKiddingEvent(kiddingRow as Record<string, unknown>);
  const alive = kidding.kidsSurviving ?? kidding.kidsBorn;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      <Card>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          {litterSummaryLabel(kidding.kidsBorn, alive)}
        </Text>
        <Text className="text-gray-600">{kidding.kidDate}</Text>
      </Card>

      {(kidRows ?? []).length === 0 ? (
        <Text className="text-gray-500 px-1">
          No kids were registered in the herd.
        </Text>
      ) : (
        (kidRows ?? []).map((row) => {
          const kid = mapAnimal(row as Record<string, unknown>);
          const weight = (row as { weight_value?: number | null }).weight_value;
          const unit = (row as { weight_unit?: string | null }).weight_unit;
          return (
            <Pressable
              key={kid.id}
              onPress={() => router.push(`/(tabs)/livestock/${kid.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-4">
              <Text className="text-lg font-semibold text-gray-900">
                {animalDisplayLabel(kid)}
              </Text>
              <Text className="text-gray-600 capitalize mt-1">
                {kid.sex}
                {weight != null ? ` · ${weight} ${unit ?? ''}` : ' · no birth weight'}
              </Text>
            </Pressable>
          );
        })
      )}

      <View className="h-4" />
    </ScrollView>
  );
}
