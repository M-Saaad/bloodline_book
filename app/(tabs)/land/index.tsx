import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { PageHeading, SectionTitle } from '@/components/land/PageHeading';
import { PastureStatusBadge } from '@/components/land/PastureStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ListCard, ListRow } from '@/components/ui/ListRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import { mapFeedLog, mapPasture } from '@/lib/db/mappers';
import { formatForageType } from '@/lib/ui/pasture-labels';
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
      <View className="flex-1 bg-paper">
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

  const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-5 pb-10 gap-3.5">
      <PageHeading
        title="Land"
        subtitle={`${pastures.length} ${pastures.length === 1 ? 'pasture' : 'pastures'} · ${grazingCount} goats out`}
      />

      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          title="Move goats"
          onPress={() => router.push('/(tabs)/land/add-grazing')}
        />
        <Button
          className="flex-1"
          title="Log feed"
          variant="outline"
          onPress={() => router.push('/(tabs)/land/add-feed')}
        />
      </View>

      {pastures.length === 0 ? (
        <Card>
          <EmptyState
            title="No pastures yet"
            description="Add paddocks and move animals onto grass as you rotate grazing."
            actionLabel="Add pasture"
            onAction={() => router.push('/(tabs)/land/add-pasture')}
          />
        </Card>
      ) : (
        <ListCard>
          {pastures.map(({ pasture, occupantCount }, index) => (
            <ListRow
              key={pasture.id}
              title={pasture.name}
              subtitle={`${cap(formatForageType(pasture.forageType))}${
                pasture.acres != null ? ` · ${pasture.acres} acres` : ''
              }${pasture.status === 'grazing' || occupantCount > 0 ? ` · ${occupantCount} grazing` : ''}`}
              right={<PastureStatusBadge status={pasture.status} />}
              onPress={() => router.push(`/(tabs)/land/${pasture.id}`)}
              last={index === pastures.length - 1}
            />
          ))}
        </ListCard>
      )}

      {pastures.length > 0 ? (
        <Button
          title="＋ Add pasture"
          variant="secondary"
          onPress={() => router.push('/(tabs)/land/add-pasture')}
        />
      ) : null}

      <SectionTitle>Recent feed</SectionTitle>
      <Card className="px-4 py-2.5">
        {feedLogs.length === 0 ? (
          <View className="py-1.5">
            <Text className="text-[17px] text-gray-500 mb-3">
              No feed logs yet. Record hay, grain, or mineral offered.
            </Text>
            <Button
              title="Log feed"
              variant="outline"
              onPress={() => router.push('/(tabs)/land/add-feed')}
            />
          </View>
        ) : (
          feedLogs.map((item) => (
            <View key={item.id} className="flex-row justify-between py-1">
              <Text className="flex-1 pr-3 text-[17px] font-bold text-ink">
                {item.feedType} · {formatDisplayDate(item.date)}
              </Text>
              {item.quantity != null ? (
                <Text className="text-[17px] font-bold text-ink">
                  {item.quantity} {item.unit}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
