import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { GoatName, SectionTitle } from '@/components/land/PageHeading';
import {
  PastureStatusBadge,
  pastureStatusLabel,
} from '@/components/land/PastureStatusBadge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, ChipRow } from '@/components/ui/Chip';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { ListCard } from '@/components/ui/ListRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormMessage } from '@/components/ui/FormMessage';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatDisplayDate, todayIso } from '@/lib/dates';
import { endGrazingRecords, updatePastureStatus } from '@/lib/db/land';
import { mapAnimal, mapFeedLog, mapGrazingRecord, mapPasture } from '@/lib/db/mappers';
import type { PastureStatus } from '@/lib/types/land';
import { animalDisplayLabel } from '@/lib/ui/animal-labels';
import { formatForageType } from '@/lib/ui/pasture-labels';
import { useFarm } from '@/providers/FarmProvider';
import { Text } from '@/components/ui/Text';

const PASTURE_STATUSES: PastureStatus[] = [
  'resting',
  'grazing',
  'hay',
  'overgrazed',
];

export default function PastureDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeFarm } = useFarm();
  const [errorMessage, setErrorMessage] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [endingIds, setEndingIds] = useState<string[]>([]);

  const { data: pastureRows, isLoading: pastureLoading } = useQuery(
    id ? 'SELECT * FROM pastures WHERE id = ?' : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: grazingRows, isLoading: grazingLoading } = useQuery(
    id
      ? `SELECT * FROM grazing_records
         WHERE pasture_id = ?
         ORDER BY (end_date IS NULL) DESC, start_date DESC, created_at DESC`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const { data: animalRows } = useQuery(
    activeFarm
      ? `SELECT * FROM animals WHERE farm_id = ?`
      : 'SELECT 1 WHERE 0',
    activeFarm ? [activeFarm.id] : [],
  );

  const { data: feedRows } = useQuery(
    id
      ? `SELECT * FROM feed_logs
         WHERE pasture_id = ?
         ORDER BY date DESC, created_at DESC
         LIMIT 8`
      : 'SELECT 1 WHERE 0',
    id ? [id] : [],
  );

  const animalsById = useMemo(() => {
    const map = new Map<string, { label: string; tag: string | null }>();
    for (const row of animalRows ?? []) {
      const animal = mapAnimal(row as Record<string, unknown>);
      map.set(animal.id, {
        label: animalDisplayLabel(animal),
        tag: animal.tagNumber?.trim() || null,
      });
    }
    return map;
  }, [animalRows]);

  if (!activeFarm || !id) {
    return null;
  }

  if (pastureLoading) {
    return <LoadingState message="Loading pasture…" />;
  }

  const pastureRow = pastureRows?.[0];
  if (!pastureRow) {
    return (
      <View className="flex-1 bg-paper">
        <EmptyState
          title="Pasture not found"
          description="This pasture may have been removed or is not on this farm."
          actionLabel="Back to Land"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const pasture = mapPasture(pastureRow as Record<string, unknown>);
  const grazingRecords = (grazingRows ?? []).map((row) =>
    mapGrazingRecord(row as Record<string, unknown>),
  );
  const openRecords = grazingRecords.filter((record) => record.endDate == null);
  const historyRecords = grazingRecords.filter((record) => record.endDate != null);
  const feedLogs = (feedRows ?? []).map((row) =>
    mapFeedLog(row as Record<string, unknown>),
  );

  async function handleStatus(next: PastureStatus) {
    setErrorMessage('');
    setUpdatingStatus(true);
    try {
      await updatePastureStatus(pasture.id, next);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update status.',
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleMoveOut(recordId: string) {
    setErrorMessage('');
    setEndingIds((current) => [...current, recordId]);
    try {
      await endGrazingRecords([recordId], todayIso());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not move animal out.',
      );
    } finally {
      setEndingIds((current) => current.filter((item) => item !== recordId));
    }
  }

  const forage = formatForageType(pasture.forageType);
  const forageText = forage.charAt(0).toUpperCase() + forage.slice(1);
  const unknownAnimal = { label: 'Unknown animal', tag: null };

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 pt-2 pb-10 gap-3.5">
      <FormMessage message={errorMessage} tone="error" />

      <Card className="px-[18px] py-4">
        <View className="flex-row justify-between items-center">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-extrabold text-ink">{pasture.name}</Text>
            <Text className="text-[15px] text-gray-500">
              {forageText}
              {forageText.toLowerCase() === 'mixed' ? ' forage' : ''}
              {pasture.acres != null ? ` · ${pasture.acres} acres` : ''}
            </Text>
          </View>
          <PastureStatusBadge status={pasture.status} />
        </View>
        {pasture.notes ? (
          <Text className="text-base text-ink mt-3">{pasture.notes}</Text>
        ) : null}
        <View className="mt-3.5">
          <FieldLabel>Status</FieldLabel>
          <ChipRow>
            {PASTURE_STATUSES.map((option) => (
              <Chip
                key={option}
                label={pastureStatusLabel(option)}
                selected={pasture.status === option}
                disabled={updatingStatus}
                onPress={() => handleStatus(option)}
              />
            ))}
          </ChipRow>
        </View>
      </Card>

      <View className="flex-row gap-2.5">
        <Button
          className="flex-1"
          title="Move here"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/land/add-grazing',
              params: { pastureId: pasture.id },
            })
          }
        />
        <Button
          className="flex-1"
          title="Log feed"
          variant="outline"
          onPress={() =>
            router.push({
              pathname: '/(tabs)/land/add-feed',
              params: { pastureId: pasture.id },
            })
          }
        />
      </View>
      <Button
        title="Edit pasture details"
        variant="secondary"
        onPress={() => router.push(`/(tabs)/land/edit-pasture/${pasture.id}`)}
      />

      <SectionTitle>{`On this pasture now (${openRecords.length})`}</SectionTitle>
      {grazingLoading ? (
        <Text className="text-[17px] text-gray-500">Loading occupancy…</Text>
      ) : openRecords.length === 0 ? (
        <Card>
          <Text className="text-[17px] text-gray-500">No animals on this pasture now.</Text>
        </Card>
      ) : (
        <ListCard>
          {openRecords.map((record, index) => {
            const animal = animalsById.get(record.animalId) ?? unknownAnimal;
            const ending = endingIds.includes(record.id);
            return (
              <View
                key={record.id}
                className={`flex-row items-center gap-3 min-h-[72px] px-4 py-2.5 ${
                  index === openRecords.length - 1 ? '' : 'border-b border-gray-100'
                }`}>
                <Pressable
                  onPress={() => router.push(`/(tabs)/land/edit-grazing/${record.id}`)}
                  accessibilityRole="button"
                  className="flex-1">
                  <GoatName label={animal.label} tag={animal.tag} />
                  <Text className="text-[15px] text-gray-500 mt-0.5">
                    Since {formatDisplayDate(record.startDate)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleMoveOut(record.id)}
                  disabled={ending}
                  accessibilityRole="button"
                  className={`h-12 min-w-[110px] rounded-[18px] bg-bloodline-100 items-center justify-center px-3 active:bg-bloodline-200 ${
                    ending ? 'opacity-50' : ''
                  }`}>
                  <Text className="text-base font-extrabold text-bloodline-900">
                    {ending ? 'Moving…' : 'Move out'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ListCard>
      )}

      <SectionTitle>Last moves</SectionTitle>
      <Card className="py-3">
        {historyRecords.length === 0 ? (
          <Text className="text-base text-gray-500">No completed rotations yet.</Text>
        ) : (
          historyRecords.slice(0, 12).map((record) => {
            const animal = animalsById.get(record.animalId) ?? unknownAnimal;
            return (
              <Pressable
                key={record.id}
                onPress={() => router.push(`/(tabs)/land/edit-grazing/${record.id}`)}
                accessibilityRole="button"
                className="min-h-[48px] justify-center py-1">
                <Text className="text-base text-gray-500">
                  <Text className="font-bold text-ink">{animal.label}</Text>
                  {animal.tag && !animal.label.startsWith('#') ? (
                    <Text className="font-bold text-bloodline-600"> #{animal.tag}</Text>
                  ) : null}
                  {' · '}
                  {formatDisplayDate(record.startDate)} to{' '}
                  {record.endDate ? formatDisplayDate(record.endDate) : 'open'}
                </Text>
              </Pressable>
            );
          })
        )}
      </Card>

      <SectionTitle>Feed here</SectionTitle>
      <Card className="px-4 py-2.5">
        {feedLogs.length === 0 ? (
          <Text className="text-base text-gray-500 py-1">
            No feed logs tied to this pasture.
          </Text>
        ) : (
          feedLogs.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/(tabs)/land/edit-feed/${item.id}`)}
              accessibilityRole="button"
              className="flex-row justify-between items-center min-h-[48px]">
              <Text className="flex-1 pr-3 text-[17px] font-bold text-ink">
                {item.feedType} · {formatDisplayDate(item.date)}
              </Text>
              {item.quantity != null ? (
                <Text className="text-[17px] font-bold text-ink">
                  {item.quantity} {item.unit}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}
