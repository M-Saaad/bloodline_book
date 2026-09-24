import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EnvironmentBadge } from '@/components/EnvironmentBadge';
import { FarmWriteGate } from '@/components/FarmWriteGate';
import { ReadOnlyFarmBanner } from '@/components/ReadOnlyFarmBanner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { useFarmRole } from '@/hooks/useFarmRole';
import { useFarm } from '@/providers/FarmProvider';

export default function DashboardScreen() {
  const { activeFarm, isLoading: farmLoading } = useFarm();
  const { isHand } = useFarmRole();

  const { data: herdStats, isLoading: statsLoading } = useQuery(
    activeFarm
      ? `SELECT status, lifecycle_stage, COUNT(*) as count
         FROM animals WHERE farm_id = ?
         GROUP BY status, lifecycle_stage`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: recentSessions, isLoading: sessionsLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM weigh_sessions WHERE farm_id = ?
         ORDER BY date DESC LIMIT 3`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  if (farmLoading) {
    return <LoadingState message="Loading farm…" />;
  }

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState
          title="No farm selected"
          description="Create or select a farm to see your dashboard."
        />
      </View>
    );
  }

  const isDataLoading = statsLoading || sessionsLoading;

  const totalAnimals =
    herdStats?.reduce(
      (sum, row) => sum + Number((row as { count: number }).count),
      0,
    ) ?? 0;

  const activeCount =
    herdStats
      ?.filter((row) => (row as { status: string }).status === 'active')
      .reduce(
        (sum, row) => sum + Number((row as { count: number }).count),
        0,
      ) ?? 0;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-4 gap-4">
      <EnvironmentBadge />
      {isHand ? <ReadOnlyFarmBanner /> : null}
      <Card>
        <Text className="text-xl font-bold text-gray-900 mb-1">
          {activeFarm.name}
        </Text>
        <View className="flex-row gap-2 mb-3">
          <Badge label={activeFarm.segment} />
          <Badge label={activeFarm.weightUnit} tone="success" />
        </View>
        {isDataLoading ? (
          <Text className="text-gray-500">Loading herd stats…</Text>
        ) : (
          <Text className="text-gray-600">
            {activeCount} active · {totalAnimals} total on record
          </Text>
        )}
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Quick actions
        </Text>
        <View className="gap-2">
          <FarmWriteGate>
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
          </FarmWriteGate>
          <Button
            title="Land"
            variant="outline"
            onPress={() => router.push('/(tabs)/land')}
          />
        </View>
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Recent weigh sessions
        </Text>
        {sessionsLoading ? (
          <Text className="text-gray-500">Loading sessions…</Text>
        ) : (recentSessions ?? []).length === 0 ? (
          <View>
            <Text className="text-gray-500 mb-3">
              No weigh sessions yet. Record your first batch on Weigh Day.
            </Text>
            <FarmWriteGate>
              <Button
                title="Start Weigh Day"
                variant="outline"
                onPress={() => router.push('/(tabs)/livestock/weight')}
              />
            </FarmWriteGate>
          </View>
        ) : (
          (recentSessions ?? []).map((row) => {
            const session = row as {
              id: string;
              date: string;
              weigh_point: string;
            };
            return (
              <Pressable
                key={session.id}
                onPress={() =>
                  router.push(`/(tabs)/livestock/weigh-session/${session.id}`)
                }
                className="flex-row justify-between py-2 border-b border-gray-100">
                <Text className="text-gray-800">{session.date}</Text>
                <Badge label={session.weigh_point.replace('_', ' ')} />
              </Pressable>
            );
          })
        )}
      </Card>
    </ScrollView>
  );
}
