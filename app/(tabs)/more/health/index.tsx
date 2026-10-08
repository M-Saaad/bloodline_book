import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { CardRowShell, goatParts } from '@/components/breeding/parts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListRow } from '@/components/ui/ListRow';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate } from '@/lib/dates';
import { mapAnimal, mapHealthRecord } from '@/lib/db/mappers';
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
    const map = new Map<string, { name: string; tag: string | null }>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, goatParts(animal));
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
    <View className="flex-1 bg-paper">
      <View className="px-5 pt-2 pb-3 items-end">
        <Button
          title="＋ Add"
          className="w-[104px] min-h-[48px] py-0"
          onPress={() => router.push('/(tabs)/more/health/add')}
        />
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerClassName={
          records.length === 0 ? 'flex-grow' : 'px-5 pb-10'
        }
        ListEmptyComponent={
          <EmptyState
            title="No health records yet"
            description="Log vaccinations, FAMACHA scores, treatments, and other herd health events."
            actionLabel="Add Health Record"
            onAction={() => router.push('/(tabs)/more/health/add')}
          />
        }
        renderItem={({ item, index }) => {
          const goat = animalLabels.get(item.animalId);
          const kindLabel = item.kind.replace(/_/g, ' ');
          const details = [
            `${kindLabel.charAt(0).toUpperCase()}${kindLabel.slice(1)}`,
            item.kind === 'famacha' && item.famachaScore != null
              ? `FAMACHA score ${item.famachaScore}`
              : null,
            item.productName
              ? `${item.productName}${item.dosage ? ` · ${item.dosage}` : ''}`
              : null,
            item.meatWithdrawalDays != null && item.meatWithdrawalDays > 0
              ? `${item.meatWithdrawalDays} day meat withdrawal`
              : null,
            item.notes || null,
          ].filter(Boolean);
          const needsLook =
            item.kind === 'famacha' &&
            item.famachaScore != null &&
            item.famachaScore >= 3;
          return (
            <CardRowShell index={index} count={records.length}>
              <ListRow
                title={goat?.name ?? 'Unknown animal'}
                tag={goat?.tag}
                subtitle={details.join(' · ')}
                last={index === records.length - 1}
                onPress={() => router.push(`/(tabs)/more/health/edit/${item.id}`)}
                right={
                  <Badge
                    label={formatDisplayDate(item.date)}
                    tone={needsLook ? 'warning' : 'default'}
                  />
                }
              />
            </CardRowShell>
          );
        }}
      />
    </View>
  );
}
