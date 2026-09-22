import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import { mapFeedLog, mapPasture } from '@/lib/db/mappers';
import {
  formatForageType,
  formatPastureStatus,
  pastureStatusTone,
} from '@/lib/ui/pasture-labels';
import { useFarm } from '@/providers/FarmProvider';

export default function LandScreen() {
  const { activeFarm } = useFarm();

  const { data: pastureRows, isLoading: pasturesLoading } = useQuery(
    activeFarm
      ? `SELECT p.*,
            (SELECT COUNT(*) FROM grazing_records g
             WHERE g.pasture_id = p.id AND g.end_date IS NULL) as occupant_count
         FROM pastures p
         WHERE p.farm_id = ?
         ORDER BY p.name COLLATE NOCASE`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: grazingCountRows, isLoading: grazingLoading } = useQuery(
    activeFarm
      ? `SELECT COUNT(*) as count FROM grazing_records
         WHERE farm_id = ? AND end_date IS NULL`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: feedRows, isLoading: feedLoading } = useQuery(
    activeFarm
      ? `SELECT * FROM feed_logs
         WHERE farm_id = ?
         ORDER BY date DESC, created_at DESC
         LIMIT 5`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  if (!activeFarm) {
    return (
      <View className="flex-1 bg-gray-50">
        <EmptyState title="No farm selected" />
      </View>
    );
  }

  if (pasturesLoading || grazingLoading || feedLoading) {
    return <LoadingState message="Loading pastures…" />;
  }

  const pastures = (pastureRows ?? []).map((row) => ({
    pasture: mapPasture(row as Record<string, unknown>),
    occupantCount: Number(
      (row as { occupant_count?: number }).occupant_count ?? 0,
    ),
  }));
  const grazingCount = Number(
    (grazingCountRows?.[0] as { count?: number } | undefined)?.count ?? 0,
  );
  const feedLogs = (feedRows ?? []).map((row) =>
    mapFeedLog(row as Record<string, unknown>),
  );

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="p-4 pb-8 gap-4">
      <Card>
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600">Pastures</Text>
          <Text className="text-gray-900 font-semibold">{pastures.length}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-gray-600">Animals on pasture</Text>
          <Text className="text-gray-900 font-semibold">{grazingCount}</Text>
        </View>
      </Card>

      <View className="gap-2">
        <Button
          title="Add Pasture"
          onPress={() => router.push('/(tabs)/land/add-pasture')}
        />
        <Button
          title="Move Animals"
          variant="secondary"
          onPress={() => router.push('/(tabs)/land/add-grazing')}
        />
        <Button
          title="Log Feed"
          variant="outline"
          onPress={() => router.push('/(tabs)/land/add-feed')}
        />
      </View>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">Pastures</Text>
        {pastures.length === 0 ? (
          <EmptyState
            title="No pastures yet"
            description="Add paddocks and move animals onto grass as you rotate grazing."
            actionLabel="Add Pasture"
            onAction={() => router.push('/(tabs)/land/add-pasture')}
          />
        ) : (
          pastures.map(({ pasture, occupantCount }) => (
            <Pressable
              key={pasture.id}
              onPress={() => router.push(`/(tabs)/land/${pasture.id}`)}
              className="border border-gray-200 rounded-xl p-4 mb-2 bg-white active:bg-gray-50">
              <View className="flex-row justify-between items-start mb-1">
                <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">
                  {pasture.name}
                </Text>
                <Badge
                  label={formatPastureStatus(pasture.status)}
                  tone={pastureStatusTone(pasture.status)}
                />
              </View>
              <Text className="text-gray-500 capitalize">
                {formatForageType(pasture.forageType)}
                {pasture.acres != null ? ` · ${pasture.acres} acres` : ''}
                {` · ${occupantCount} grazing`}
              </Text>
            </Pressable>
          ))
        )}
      </Card>

      <Card>
        <Text className="text-lg font-semibold text-gray-900 mb-3">
          Recent feed
        </Text>
        {feedLogs.length === 0 ? (
          <View>
            <Text className="text-gray-500 mb-3">
              No feed logs yet. Record hay, grain, or mineral offered.
            </Text>
            <Button
              title="Log Feed"
              variant="outline"
              onPress={() => router.push('/(tabs)/land/add-feed')}
            />
          </View>
        ) : (
          feedLogs.map((item) => (
            <View
              key={item.id}
              className="flex-row justify-between py-2 border-b border-gray-100">
              <View className="flex-1 pr-3">
                <Text className="text-gray-900 font-medium">{item.feedType}</Text>
                <Text className="text-gray-500 text-sm">
                  {formatDisplayDate(item.date)}
                </Text>
              </View>
              <Text className="text-gray-700">
                {item.quantity != null
                  ? `${item.quantity} ${item.unit}`
                  : item.unit}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
