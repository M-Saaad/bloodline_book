import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { mapAnimal } from '@/lib/db/mappers';
import { useFarm } from '@/providers/FarmProvider';

export default function LivestockListScreen() {
  const { activeFarm } = useFarm();

  const { data } = useQuery(
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

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 py-3 flex-row gap-2">
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

      <FlatList
        data={animals}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-6"
        ListEmptyComponent={
          <Text className="text-center text-gray-500 mt-12">
            No active animals. Add your first goat to get started.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable className="bg-white border border-gray-200 rounded-xl p-4 mb-2">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-lg font-semibold text-gray-900">
                  {item.name ?? item.tagNumber ?? 'Unnamed'}
                </Text>
                <Text className="text-gray-500 capitalize">
                  {item.sex} · {item.lifecycleStage.replace('_', ' ')}
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
