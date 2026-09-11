import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useFarm } from '@/providers/FarmProvider';

export default function DashboardScreen() {
  const { activeFarm } = useFarm();

  const { data: herdStats } = useQuery(
    activeFarm
      ? `SELECT status, lifecycle_stage, COUNT(*) as count
         FROM animals WHERE farm_id = ?
         GROUP BY status, lifecycle_stage`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: recentSessions } = useQuery(
    activeFarm
      ? `SELECT * FROM weigh_sessions WHERE farm_id = ?
         ORDER BY date DESC LIMIT 3`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  if (!activeFarm) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-600">No farm selected.</Text>
      </View>
    );
  }

  const totalAnimals =
    herdStats?.reduce(
      (sum, row) => sum + Number((row as { count: number }).count),
      0,
    ) ?? 0;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      <EnvironmentBadge />
      <Card>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          {activeFarm.name}
        </Text>
        <View className="flex-row gap-2 mb-3">
          <Badge label={activeFarm.segment} />
          <Badge label={activeFarm.weightUnit} tone="success" />
        </View>
        <Text className="text-gray-600">
          {totalAnimals} animal{totalAnimals === 1 ? '' : 's'} on record
        </Text>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Quick actions
        </Text>
        <View className="gap-2">
          <Button
            title="Add Animal"
            onPress={() => router.push('/(tabs)/livestock/add')}
          />
          <Button
            title="Weigh Day"
            variant="secondary"
            onPress={() => router.push('/(tabs)/livestock/weight')}
          />
        </View>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Recent weigh sessions
        </Text>
        {(recentSessions ?? []).length === 0 ? (
          <Text className="text-gray-500">No weigh sessions yet.</Text>
        ) : (
          (recentSessions ?? []).map((row) => {
            const session = row as {
              id: string;
              date: string;
              weigh_point: string;
            };
            return (
              <View
                key={session.id}
                className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-800">{session.date}</Text>
                <Badge label={session.weigh_point.replace('_', ' ')} />
              </View>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}
