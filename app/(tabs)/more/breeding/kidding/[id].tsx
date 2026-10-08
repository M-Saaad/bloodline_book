import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { goatParts, SectionTitle } from '@/components/breeding/parts';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Chevron, ListCard, ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { mapAnimal, mapKiddingEvent } from '@/lib/db/mappers';
import { formatDisplayDate } from '@/lib/dates';
import { litterSummaryLabel } from '@/lib/domain/kidding';
import { formatSex } from '@/lib/ui/animal-labels';
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
  const kids = kidRows ?? [];

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-2 pb-10 gap-3">
      <Card className="px-[18px] py-4">
        <Text className="text-[26px] font-extrabold text-ink">
          {litterSummaryLabel(kidding.kidsBorn, alive)}
        </Text>
        <Text className="text-base text-gray-500 mt-0.5">
          {formatDisplayDate(kidding.kidDate)}
        </Text>
      </Card>

      <View>
        <SectionTitle>Kids</SectionTitle>
        {kids.length === 0 ? (
          <Text className="text-[15px] text-gray-500 px-1">
            No kids were registered in the herd.
          </Text>
        ) : (
          <ListCard>
            {kids.map((row, index) => {
              const kid = mapAnimal(row as Record<string, unknown>);
              const parts = goatParts(kid);
              const weight = (row as { weight_value?: number | null }).weight_value;
              const unit = (row as { weight_unit?: string | null }).weight_unit;
              return (
                <ListRow
                  key={kid.id}
                  title={parts.name}
                  tag={parts.tag}
                  subtitle={`${formatSex(kid.sex)}${
                    weight != null
                      ? ` · ${weight} ${unit ?? activeFarm.weightUnit}`
                      : ' · no birth weight'
                  }`}
                  last={index === kids.length - 1}
                  onPress={() => router.push(`/(tabs)/livestock/${kid.id}`)}
                  right={<Chevron />}
                />
              );
            })}
          </ListCard>
        )}
      </View>
    </ScrollView>
  );
}
