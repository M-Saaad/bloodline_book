import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { FarmWriteGate } from '@/components/FarmWriteGate';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal } from '@/lib/db/mappers';
import { formatLifecycleStage } from '@/lib/ui/animal-labels';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useFarm } from '@/providers/FarmProvider';

export default function LivestockListScreen() {
  const { activeFarm, isLoading: farmLoading } = useFarm();
  const { isHand } = useFarmRole();

  const { data, isLoading: animalsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM animals
         WHERE farm_id = ? AND status = 'active'
         ORDER BY COALESCE(name, tag_number, id)`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const animals = (data ?? []).map((row) =>
    mapAnimal(row as Record<string, unknown>),
  );

  if (farmLoading || (activeFarm && animalsLoading)) {
    return <LoadingState message="Loading livestock…" />;
  }

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="No farm selected"
          description="Create or select a farm to manage your herd."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {isHand ? (
        <View className="px-4 pt-3">
          <ReadOnlyFarmBanner />
        </View>
      ) : null}
      <View className="px-4 py-3">
        <FarmWriteGate>
          <View className="flex-row gap-2">
            <Button
              title="Add Animal"
              onPress={() => router.push('/(tabs)/livestock/add')}
              className="flex-1"
            />
            <Button
              title="Weigh Day"
              variant="secondary"
              onPress={() => router.push('/(tabs)/livestock/weight')}
              className="flex-1"
            />
          </View>
        </FarmWriteGate>
      </View>

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          animals.length === 0 ? 'flex-grow' : 'px-4 pb-6'
        }
        ListEmptyComponent={
          <EmptyState
            title="No active animals"
            description="Add your first goat to start tracking weights and records."
            actionLabel="Add Animal"
            onAction={() => router.push('/(tabs)/livestock/add')}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/livestock/${item.id}`)}
            className="bg-white border border-gray-200 rounded-xl p-4 mb-2 active:bg-gray-50">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  {item.name ?? item.tagNumber ?? 'Unnamed'}
                </Text>
                <Text className="text-gray-500 capitalize">
                  {item.sex} · {formatLifecycleStage(item.lifecycleStage)}
                </Text>
              </View>
              <Badge label={item.status} tone="success" />
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
